-- AI 백지테스트 채점: 결과 저장 + 채점 권한 선점 + 사용량 한도
--
-- 복습 1회(review_log)당 채점 1건을 저장한다. 채점은 Gemini 호출이라 비용이 붙고,
-- 점수는 사용자가 자기 학습을 평가받는 값이라 클라이언트가 만들면 안 된다.
-- 그래서 이 테이블은 "읽기만 RLS로 열고, 쓰기는 아래 두 SECURITY DEFINER 함수만" 구조다.
--
-- 이 파일이 닫는 것들과 그 이유:
--
--   1. INSERT/UPDATE/DELETE 정책을 만들지 않는다
--      - INSERT를 열면 사용자가 feedback = '{}' 같은 행을 직접 넣을 수 있다. 그러면 앱의 Zod 파싱이
--        null로 떨어져 액션이 "미채점"으로 오판하고 Gemini를 다시 부르지만, review_log_id 유니크
--        제약 때문에 저장은 계속 23505로 실패한다. 빠져나올 수 없는 "영구 재채점" 상태가 된다.
--      - UPDATE를 열면 자기 점수를 임의 값으로 덮어쓸 수 있다.
--      - DELETE를 열면 지운 뒤 다시 채점을 요청해 "복습 1회당 채점 1회" 계약과 비용 한도를
--        무력화할 수 있다. 앱에 채점 삭제 기능은 없고, 노트·복습 로그 삭제는 FK cascade가 처리한다.
--
--   2. 동시 요청 — 유니크 제약은 저장 중복만 막고 이미 나간 API 비용은 되돌리지 못한다.
--      "조회 → Gemini 호출 → INSERT" 순서로는 동시 요청 N건이 모두 과금된다.
--      그래서 Gemini 호출 "전에" claim_review_grading으로 채점 권한을 원자적으로 선점한다.
--      quizzes도 같은 클래스의 버그를 20260806000001에서 한 번 고쳤다.
--
--   3. 사용자 단위 총량 — review_log_id 유니크 제약은 "복습 1회당 1번"만 막는다.
--      노트 생성은 무제한이고 create_note_with_initial_review_log가 노트마다 즉시 1차 로그를
--      만들어서 "노트 N개 = 채점 N회"가 그대로 가능하다. review_grading_generations로 카운트한다.
--
-- 길이 제약(notes.content / user_answer)은 관심사가 달라 20260808000001에 따로 둔다.

-- --------------------------------------------------------------------------
-- 1. 채점 결과 테이블
-- --------------------------------------------------------------------------

-- score/feedback이 NULL인 행 = "채점 진행 중" 선점 행.
-- 채점이 끝나면 finalize_review_grading이 두 값을 함께 채운다.
create table public.review_gradings (
  id uuid primary key default gen_random_uuid(),
  review_log_id uuid not null references public.review_logs(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round integer not null,
  user_answer text not null,
  score integer,
  feedback jsonb,
  -- 선점 세대를 식별한다. 아래 "선점 이어받기" 참고.
  claim_token uuid,
  -- 채점 기준이 된 노트 본문의 해시. src/features/review/lib/contentHash.ts와 같은 형식(sha256 hex).
  -- 이게 없으면 채점 뒤 노트를 고치고 다시 들어왔을 때 "현재 본문 + 과거 채점"이
  -- 아무 안내 없이 한 화면에 놓인다.
  graded_content_hash text,
  created_at timestamptz not null default now(),
  constraint review_gradings_round_check check (round >= 1 and round <= 3),
  constraint review_gradings_score_check check (score >= 0 and score <= 100),
  constraint review_gradings_graded_content_hash_check check (
    graded_content_hash is null
    or graded_content_hash ~ '^[0-9a-f]{64}$'
  ),
  -- 반쪽짜리 행(점수만 있고 피드백이 없는 등)을 금지한다.
  constraint review_gradings_completion_check check (
    (score is null and feedback is null)
    or (score is not null and feedback is not null)
  ),
  -- feedback JSON 구조를 DB에서도 검증한다. 앱 Zod 스키마(gradingFeedbackSchema)와 같은 모양이다.
  --
  -- 조건 전체를 IS TRUE로 감싸는 것이 핵심이다.
  -- 키가 없으면 `feedback -> 'summary'`가 SQL NULL이 되고 jsonb_typeof(NULL)도 NULL이라
  -- AND 체인 전체가 NULL로 떨어지는데, CHECK 제약은 결과가 FALSE일 때만 거부하고
  -- NULL은 통과시킨다. IS TRUE가 없으면 feedback = '{}'가 그대로 저장된다.
  --
  -- 원소 타입은 jsonpath로 본다. CHECK 제약 안에서는 서브쿼리가 금지라
  -- jsonb_array_elements를 쓸 수 없다. jsonb_typeof만으로는 missedConcepts: [1]이 통과한다.
  constraint review_gradings_feedback_shape_check check (
    feedback is null
    or (
      jsonb_typeof(feedback) = 'object'
      and jsonb_typeof(feedback -> 'summary') = 'string'
      and jsonb_typeof(feedback -> 'missedConcepts') = 'array'
      and jsonb_typeof(feedback -> 'incorrectPoints') = 'array'
      and not jsonb_path_exists(feedback, '$.missedConcepts[*] ? (@.type() != "string")')
      and not jsonb_path_exists(feedback, '$.incorrectPoints[*] ? (@.type() != "string")')
    ) is true
  )
);

-- 복습 1회당 채점 1회 (재채점 방지 + 멱등성)
create unique index review_gradings_review_log_id_idx on public.review_gradings (review_log_id);
create index review_gradings_note_id_idx on public.review_gradings (note_id);
create index review_gradings_user_id_idx on public.review_gradings (user_id);

alter table public.review_gradings enable row level security;

-- 읽기만 연다. 쓰기 정책은 위 1번 이유로 만들지 않는다.
create policy "Users can read own review gradings"
  on public.review_gradings for select
  to authenticated
  using (auth.uid() = user_id);

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

-- 조회만 허용한다. 쓰기는 아래 claim_review_grading만 할 수 있다.
create policy "Users can read own review grading generations"
  on public.review_grading_generations for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 3. 채점 권한 선점
-- --------------------------------------------------------------------------

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
 * note_id와 round는 인자로 받지 않고 review_logs에서 직접 읽는다.
 *
 * auth.uid() 대신 p_user_id를 인자로 받는다. service_role로 호출하면 auth.uid()가 NULL이라
 * 기존 방식으로는 전부 not_found로 떨어진다. 인증 사용자는 이 함수를 실행할 수 없으므로
 * 호출자가 넘긴 user_id를 신뢰해도 우회 경로가 생기지 않는다.
 * 같은 이유로 이메일 인증도 is_current_user_email_confirmed()가 아니라 auth.users를 직접 조회한다.
 *
 * 한도 값은 반드시 이 함수 안에 상수로 둔다. 인자로 받으면 호출자가 큰 값을 넘겨 우회할 수 있다.
 * 같은 이유로 사용 기록을 되돌리는 함수도, 선점을 되돌리는 함수도 두지 않는다.
 * 선점 → 해제를 반복하면 Gemini를 무제한으로 호출할 수 있기 때문이다.
 * 대신 c_stale_window가 지난 선점 행은 자동으로 재선점 대상이 되고,
 * Gemini 호출이 실패하면 사용자는 그만큼 기다린 뒤 재시도한다.
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
  -- 앱의 채점 deadline(45초) < 페이지 maxDuration(55초) < 이 값 순서를 지켜야 한다.
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

  -- review_log_id 단위 advisory lock으로 "조회 → 선점" 경합을 막는다.
  -- lock이 없으면 동시 요청 두 건이 모두 "선점 가능"을 보고 통과한다.
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
    -- 답안만 덮고 기준 해시를 두면 "답안 B + A 기준 원본"이 한 행에 남는다.
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

-- authenticated에 열어 두면 사용자가 PostgREST로 임의의 user_answer로 선점 행을 덮어써
-- 진행 중인 채점을 무효화할 수 있다. 클라이언트에서 부를 이유도 없다.
--
-- PUBLIC만 revoke하면 안 된다. Supabase는 public 스키마에 ALTER DEFAULT PRIVILEGES로
-- anon·authenticated·service_role에게 함수 EXECUTE를 "직접" 부여하므로, 새로 만든 함수의
-- proacl에 세 역할이 그대로 들어간다. PUBLIC revoke는 이 직접 grant를 건드리지 않는다.
-- 역할을 명시해서 회수해야 실제로 닫힌다. (update_notification_time_of_day와 같은 패턴)
revoke all on function public.claim_review_grading(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_review_grading(uuid, uuid, text, text) to service_role;

-- --------------------------------------------------------------------------
-- 4. 채점 결과 확정
-- --------------------------------------------------------------------------

/**
 * 선점해 둔 행에 채점 결과를 채운다.
 *
 * 반환값
 *   'ok'             : 저장 성공
 *   'already_graded' : 이미 확정된 행이다 (동시 요청이 먼저 저장함)
 *   'stale_claim'    : 선점을 빼앗긴 요청이다 (아래 참고)
 *   'not_found'      : 선점 행이 없거나 본인 것이 아니다
 *
 * score/feedback은 여기서 검증한다. 클라이언트가 UPDATE 정책으로 직접 쓰게 두면
 * 자기 채점 점수를 임의 값으로 덮어쓸 수 있으므로 UPDATE 정책은 만들지 않는다.
 */
create function public.finalize_review_grading(
  p_user_id uuid,
  p_review_log_id uuid,
  p_claim_token uuid,
  p_score integer,
  p_feedback jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_score integer;
  v_existing_claim_token uuid;
begin
  if p_user_id is null then
    return 'not_found';
  end if;

  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  -- review_gradings_feedback_shape_check와 같은 조건을 뒤집은 것이다.
  -- OR 체인으로 쓰면 키가 없을 때 NULL이 섞여 IF 본문이 실행되지 않으므로
  -- 긍정형으로 조립한 뒤 IS NOT TRUE로 판정한다.
  if p_feedback is null
    or (
      jsonb_typeof(p_feedback) = 'object'
      and jsonb_typeof(p_feedback -> 'summary') = 'string'
      and jsonb_typeof(p_feedback -> 'missedConcepts') = 'array'
      and jsonb_typeof(p_feedback -> 'incorrectPoints') = 'array'
      and not jsonb_path_exists(p_feedback, '$.missedConcepts[*] ? (@.type() != "string")')
      and not jsonb_path_exists(p_feedback, '$.incorrectPoints[*] ? (@.type() != "string")')
    ) is not true
  then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_review_log_id::text));

  select g.score, g.claim_token
    into v_existing_score, v_existing_claim_token
  from public.review_gradings g
  where g.review_log_id = p_review_log_id
    and g.user_id = p_user_id;

  if not found then
    return 'not_found';
  end if;

  if v_existing_score is not null then
    return 'already_graded';
  end if;

  -- 선점이 만료된 사이 다른 요청이 이어받은 경우다.
  -- 지금 행에 저장된 user_answer는 그 요청의 답안이므로,
  -- 이 요청의 피드백을 함께 남기면 답안과 채점 기준이 어긋난 행이 된다.
  if p_claim_token is null or v_existing_claim_token is distinct from p_claim_token then
    return 'stale_claim';
  end if;

  update public.review_gradings
  set score = p_score,
      feedback = p_feedback
  where review_log_id = p_review_log_id
    and user_id = p_user_id;

  return 'ok';
end;
$$;

-- authenticated에 열어 두면 사용자가 PostgREST로 claim → finalize(100점)를 직접 호출해
-- AI를 거치지 않고 점수를 확정할 수 있다. 서버 액션이 세션·이메일 인증·노트 소유권·
-- pending 복습 로그 일치를 모두 확인한 뒤에만 admin 클라이언트로 호출한다.
-- 역할을 명시해 회수하는 이유는 위 claim_review_grading과 같다.
revoke all on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb) to service_role;
