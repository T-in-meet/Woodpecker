-- 채점 기준 원본 해시 + AI 채점 사용량 한도
--
-- 두 가지를 닫는다. 둘 다 claim_review_grading을 고쳐야 해서 한 파일에 담는다.
--
--   1. 채점 기준 원본 — 지금은 notes.updated_at으로 "화면의 원본 == 채점할 원본"을 확인하는데
--      tr_notes_updated_at 트리거가 notes 행의 모든 UPDATE에 붙는다.
--      update_notification_time_of_day처럼 본문과 무관한 수정에도 값이 올라가서,
--      알림 시간만 바꿔도 채점이 거부되고 사용자는 아직 저장되지 않은 답안(최대 5만 자)을 잃는다.
--      저장된 채점에도 어느 본문을 기준으로 했는지 남지 않아, 채점 후 노트를 고치고 다시 들어오면
--      "현재 본문 + 과거 채점"이 아무 안내 없이 한 화면에 놓인다.
--      → 본문 해시(sha256)를 선점 시점에 함께 저장하고, 앱은 updated_at 대신 이 해시로 대조한다.
--
--   2. 사용량 한도 — review_log_id 유니크 제약은 "복습 1회당 1번"만 막는다.
--      노트 생성은 무제한이고 create_note_with_initial_review_log가 노트마다 즉시 1차 로그를 만들어서
--      "노트 N개 = 채점 N회"가 그대로 가능하다. advisory lock도 review_log 단위라
--      서로 다른 노트로 동시에 쏘면 전부 통과한다.
--      퀴즈는 20260806000002에서 같은 클래스를 이미 막았는데(일 30회 / 60초 5회) 채점에는 없었다.
--      채점 프롬프트는 노트 5만 자 + 답안 5만 자라 호출 1회의 비용이 퀴즈보다 크다.
--      → claim_quiz_generation과 같은 방식으로 사용 기록 테이블 + 일일·버스트 한도를 붙인다.

-- --------------------------------------------------------------------------
-- 1. 채점 기준 원본 해시
-- --------------------------------------------------------------------------

-- 이 마이그레이션 이전에 저장된 채점은 NULL이다. 어느 본문을 기준으로 했는지 알 수 없으므로
-- 앱은 NULL을 "판단 불가"로 보고 불일치 안내를 띄우지 않는다. 백필하지 않는다.
alter table public.review_gradings add column graded_content_hash text;

-- src/features/review/lib/contentHash.ts의 hashNoteContent와 같은 형식이다(sha256 hex).
alter table public.review_gradings
  add constraint review_gradings_graded_content_hash_check check (
    graded_content_hash is null
    or graded_content_hash ~ '^[0-9a-f]{64}$'
  );

-- --------------------------------------------------------------------------
-- 2. AI 채점 사용 기록
-- --------------------------------------------------------------------------

-- review_log_id는 nullable + on delete set null이다.
-- cascade로 두면 사용자가 노트를 지워 사용 기록까지 함께 없앨 수 있다.
-- 노트가 사라져도 사용량은 남아야 한다. (quiz_generations와 같은 이유)
--
-- review_gradings 자체를 카운터로 쓸 수 없는 이유도 같다. note_id·review_log_id가
-- on delete cascade라 노트를 지우면 채점 행이 통째로 사라진다.
create table public.review_grading_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_log_id uuid references public.review_logs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index review_grading_generations_user_created_idx
  on public.review_grading_generations (user_id, created_at desc);

alter table public.review_grading_generations enable row level security;

-- 조회만 허용한다. 쓰기는 아래 SECURITY DEFINER 함수만 할 수 있다.
create policy "Users can read own review grading generations"
  on public.review_grading_generations for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 3. 채점 권한 선점 (해시 저장 + 한도 검사 추가)
-- --------------------------------------------------------------------------

-- 인자 구성이 바뀌므로 create or replace로는 갈아끼울 수 없다.
drop function if exists public.claim_review_grading(uuid, uuid, text);

/**
 * 복습 1회(review_log)에 대한 AI 채점 권한을 선점한다.
 * 반드시 Gemini를 호출하기 "전에" 부른다.
 *
 * 반환값은 jsonb다.
 *   {"status": "ok", "claimToken": "<uuid>"}
 *                       : 선점 성공. 호출자는 Gemini를 호출한 뒤 이 토큰으로 확정한다.
 *   {"status": "already_graded"}    : 이미 채점이 끝났다. 호출자는 저장된 결과를 다시 읽는다.
 *   {"status": "in_flight"}         : 다른 요청이 채점 중이다.
 *   {"status": "too_many_requests"} : 짧은 시간에 너무 많이 요청했다.
 *   {"status": "daily_exceeded"}    : 오늘 한도를 모두 사용했다.
 *   {"status": "not_found"}         : 본인의 진행 중인 복습 로그가 아니거나 이메일 미인증이다.
 *
 * 한도 값은 반드시 이 함수 안에 상수로 둔다. 인자로 받으면 호출자가 큰 값을 넘겨 우회할 수 있다.
 * 같은 이유로 사용 기록을 되돌리는 함수는 두지 않는다.
 * Gemini 호출이 실패해도 사용량은 그대로 차감된다.
 *
 * 락은 review_log → user 순서로만 잡는다. finalize_review_grading은 앞의 것만 잡으므로
 * 이 순서를 지키는 한 두 함수 사이에 교착이 생기지 않는다.
 */
create function public.claim_review_grading(
  p_user_id uuid,
  p_review_log_id uuid,
  p_user_answer text,
  p_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Gemini 호출이 이 시간을 넘기면 실패한 것으로 보고 재선점을 허용한다.
  c_stale_window constant interval := interval '60 seconds';

  -- 채점은 복습 회차당 1회뿐이라 정상 사용자가 하루에 이 값을 넘길 일은 거의 없다.
  -- 노트를 대량으로 만들어 연속 호출하는 경로를 막는 것이 목적이다.
  c_daily_limit constant integer := 30;
  c_burst_limit constant integer := 10;
  c_burst_window constant interval := interval '60 seconds';

  v_note_id uuid;
  v_round integer;
  v_existing_score integer;
  v_existing_created_at timestamptz;
  v_count integer;
  v_claim_token uuid := gen_random_uuid();
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid content hash' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_review_log_id::text));

  select l.note_id, l.round
    into v_note_id, v_round
  from public.review_logs l
  where l.id = p_review_log_id
    and l.user_id = p_user_id
    and l.completed_at is null;

  if v_note_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select g.score, g.created_at
    into v_existing_score, v_existing_created_at
  from public.review_gradings g
  where g.review_log_id = p_review_log_id;

  -- 한도 검사보다 앞에 둔다. 저장된 결과를 다시 읽거나 다른 요청을 기다리는 건
  -- Gemini를 부르지 않으므로 사용량을 깎을 이유가 없다.
  if found then
    if v_existing_score is not null then
      return jsonb_build_object('status', 'already_graded');
    end if;

    if v_existing_created_at > now() - c_stale_window then
      return jsonb_build_object('status', 'in_flight');
    end if;
  end if;

  -- 여기부터는 Gemini를 부르는 경로다. 사용량을 검사하고 기록한다.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into v_count
  from public.review_grading_generations rg
  where rg.user_id = p_user_id
    and rg.created_at > now() - c_burst_window;

  if v_count >= c_burst_limit then
    return jsonb_build_object('status', 'too_many_requests');
  end if;

  select count(*) into v_count
  from public.review_grading_generations rg
  where rg.user_id = p_user_id
    and public.kst_date(rg.created_at) = public.kst_date(now());

  if v_count >= c_daily_limit then
    return jsonb_build_object('status', 'daily_exceeded');
  end if;

  insert into public.review_grading_generations (user_id, review_log_id)
  values (p_user_id, p_review_log_id);

  -- created_at은 NOT NULL이라, 값이 채워졌다는 건 위 SELECT가 행을 찾았다는 뜻이다.
  -- 중간에 다른 SELECT를 거쳐서 FOUND는 더 이상 그 조회의 결과가 아니다.
  if v_existing_created_at is not null then
    -- 선점만 하고 끝내지 못한 행이다. 이번 요청이 이어받는다.
    -- 토큰을 새로 발급해 이전 요청이 늦게 도착해도 확정하지 못하게 한다.
    update public.review_gradings
    set user_answer = p_user_answer,
        graded_content_hash = p_content_hash,
        created_at = now(),
        claim_token = v_claim_token
    where review_log_id = p_review_log_id;

    return jsonb_build_object('status', 'ok', 'claimToken', v_claim_token);
  end if;

  insert into public.review_gradings (
    review_log_id,
    note_id,
    user_id,
    round,
    user_answer,
    score,
    feedback,
    claim_token,
    graded_content_hash
  )
  values (
    p_review_log_id,
    v_note_id,
    p_user_id,
    v_round,
    p_user_answer,
    null,
    null,
    v_claim_token,
    p_content_hash
  );

  return jsonb_build_object('status', 'ok', 'claimToken', v_claim_token);
end;
$$;

revoke all on function public.claim_review_grading(uuid, uuid, text, text) from public;
grant execute on function public.claim_review_grading(uuid, uuid, text, text) to service_role;
