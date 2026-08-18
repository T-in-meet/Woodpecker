-- 퀴즈 선점의 동시성 구멍을 막는다 (additive)
--
-- 문제: claim_quiz_generation의 in-flight 검사는 "최근 10초 내 같은 요청이 있었는가"일 뿐
-- 작업 잠금이 아니다. Cloudflare Workers AI(gpt-oss-120b)로 교체한 뒤 실측한 퀴즈 생성
-- 지연은 최대 126초(2026-08-13 canary Day 2, #3)로 이 창을 훨씬 넘긴다. 그러면
--   1. 첫 요청이 응답 대기 중 → 2. 10초 뒤 재시도도 ok → 3. 호출 2건이 실행되고
--   나중 응답이 먼저 저장된 결과를 덮어쓴다.
--
-- CREATE OR REPLACE로 기존 claim_quiz_generation(text 반환)을 고칠 수 없다.
--   1. PostgreSQL은 반환형 변경(text → jsonb)을 CREATE OR REPLACE로 허용하지 않는다
--      ("cannot change return type of existing function").
--   2. drop 후 재생성하면, 운영 코드가 여전히 data === "ok"(text)를 기대하는 동안
--      (quiz/actions.ts:292) 모든 퀴즈 선점이 실패한다. 이전 배포로 롤백해도 DB가
--      이미 바뀌었으므로 같은 이유로 깨진다.
--
-- 그래서 기존 함수는 그대로 두고 v2 함수 두 개를 나란히 추가한다. DB와 애플리케이션을
-- 독립적으로 롤백할 수 있다. 기존 claim_quiz_generation 제거는 안정화 후 별도 마이그레이션으로
-- 분리한다.
--
-- v1과 v2가 만드는 행을 완료 상태로 구분한다(completed_at). 완료되지 않은 채 in-flight
-- 창을 넘긴 행은 자연히 재선점 대상이 된다 — 별도 정리 작업이 필요 없다.
-- 완료 여부와 무관하게 모든 선점 행이 버스트·일일 한도에 잡힌다. 완료 표시가 한도 우회
-- 수단이 되면 안 되기 때문이다.

alter table public.quiz_generations
  add column completed_at timestamptz,
  add column claim_token uuid;

-- --------------------------------------------------------------------------
-- 1. 퀴즈 생성 권한 선점 (v2)
-- --------------------------------------------------------------------------

/**
 * 퀴즈 생성 1회를 선점한다 (v2). claim_quiz_generation과 달리 jsonb + claim token을 반환해
 * 뒤에서 finalize_quiz_generation_v2로 완료를 확정할 수 있게 한다.
 *
 * 반환값은 jsonb다.
 *   {"status": "ok", "claimToken": "<uuid>"}
 *                       : 선점 성공. 호출자는 AI를 호출한 뒤 이 토큰으로 확정한다.
 *   {"status": "in_flight"}         : 같은 노트·유형을 다른 요청이 아직 완료하지 못했다.
 *   {"status": "too_many_requests"} : 짧은 시간에 너무 많이 요청했다.
 *   {"status": "daily_exceeded"}    : 오늘 한도를 모두 사용했다.
 *   {"status": "not_found"}         : 본인 노트가 아니거나 존재하지 않는다.
 *
 * authenticated에는 열지 않는다. claim_quiz_generation(v1)은 authenticated에 열려 있어
 * 사용자가 PostgREST로 직접 호출해 토큰을 읽을 수 있는데, 그러면 authenticated finalizer가
 * 잠금의 보안 경계가 되지 못한다(채점이 이미 이 이유로 service_role 전용이 된 전례가 있다).
 * service_role로 호출하면 auth.uid()가 없으므로 p_user_id를 인자로 받고, RLS가 우회되므로
 * 노트 소유권을 함수 안에서 반드시 재검증한다 — 호출부가 이미 확인했더라도 별개의 방어선이다.
 *
 * 한도 값은 반드시 이 함수 안에 상수로 둔다. 인자로 받으면 호출자가 큰 값을 넘겨 우회할 수 있다.
 * 사용 기록·선점을 되돌리는 함수는 두지 않는다 — 그런 함수가 있으면 선점 → 해제를 반복해
 * AI를 무제한으로 호출할 수 있다. 대신 in-flight 창이 지난 미완료 행은 자동으로 재선점된다.
 */
create function public.claim_quiz_generation_v2(
  p_user_id uuid,
  p_note_id uuid,
  p_quiz_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily_limit constant integer := 30;
  c_burst_limit constant integer := 5;
  c_burst_window constant interval := interval '60 seconds';

  -- AI 호출이 이 시간을 넘기면 실패한 것으로 보고 재선점을 허용한다.
  -- 채점의 c_stale_window(300초, 20260812130000)와 같은 근거를 쓴다 — 두 기능 모두
  -- Vercel Hobby(Fluid Compute) 함수 실행 상한 300초 안에서 움직인다.
  -- 정확한 QUIZ_DEADLINE_MS·페이지 maxDuration은 canary Day 3(stress case: 20문항 강제,
  -- 재생성 temperature 1.2)로 확정한 뒤 필요하면 이 값을 다시 조정한다.
  c_in_flight_window constant interval := interval '300 seconds';

  v_count integer;
  v_claim_token uuid := gen_random_uuid();
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if not exists (
    select 1
    from public.notes n
    where n.id = p_note_id
      and n.user_id = p_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (
    select 1
    from public.quiz_generations g
    where g.user_id = p_user_id
      and g.note_id = p_note_id
      and g.quiz_type = p_quiz_type
      and g.completed_at is null
      and g.created_at > now() - c_in_flight_window
  ) then
    return jsonb_build_object('status', 'in_flight');
  end if;

  select count(*) into v_count
  from public.quiz_generations g
  where g.user_id = p_user_id
    and g.created_at > now() - c_burst_window;

  if v_count >= c_burst_limit then
    return jsonb_build_object('status', 'too_many_requests');
  end if;

  select count(*) into v_count
  from public.quiz_generations g
  where g.user_id = p_user_id
    and public.kst_date(g.created_at) = public.kst_date(now());

  if v_count >= c_daily_limit then
    return jsonb_build_object('status', 'daily_exceeded');
  end if;

  insert into public.quiz_generations (user_id, note_id, quiz_type, claim_token)
  values (p_user_id, p_note_id, p_quiz_type, v_claim_token);

  return jsonb_build_object('status', 'ok', 'claimToken', v_claim_token);
end;
$$;

-- PUBLIC만 revoke하면 안 된다. Supabase는 public 스키마 함수에 ALTER DEFAULT PRIVILEGES로
-- anon·authenticated·service_role에게 EXECUTE를 직접 부여하므로, 세 역할을 각각 명시해서
-- 회수해야 실제로 닫힌다 (claim_review_grading·finalize_review_grading과 같은 패턴).
revoke all on function public.claim_quiz_generation_v2(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_quiz_generation_v2(uuid, uuid, text) to service_role;

-- --------------------------------------------------------------------------
-- 2. 퀴즈 생성 완료 확정 (v2)
-- --------------------------------------------------------------------------

/**
 * 선점해 둔 행을 완료로 표시한다. saveQuiz()의 게이트다 — 이 호출이 'ok'나
 * 'already_completed'를 반환할 때만 캐시에 저장한다. 그러지 않으면 stale된 요청이
 * 최신 요청의 결과를 뒤늦게 덮어쓸 수 있다.
 *
 * 반환값
 *   'ok'                : 완료 표시 성공
 *   'already_completed' : 최신 선점이며 이미 완료됨 (같은 세대의 재호출 — 멱등 성공으로 다룬다)
 *   'stale_claim'       : 더 새로운 선점이 생겼다 — 이 응답은 버려진 세대다
 *   'not_found'         : 해당 선점 행이 없다
 *
 * quiz_generations는 사용량 집계용 append-only 로그라 같은 (user, note, quiz_type)에
 * 선점 행이 여러 개 쌓인다. review_gradings(복습 로그당 1행)와 달리 토큰 일치만으로는
 * "이게 최신 선점인가"를 판정할 수 없다 — stale된 요청도 자기 과거 행에는 정상적으로
 * 일치해 버린다. 그래서 "같은 키에 더 새 행이 있는가"부터 확인한다.
 *
 * 판정 순서(stale_claim이 already_completed보다 먼저)를 반드시 지킨다. 반대로 두면
 * "과거에 완료된 A + 지금 진행 중인 B" 상태에서 A의 재호출이 already_completed로
 * 오인된다. 이 순서 덕분에 already_completed는 "최신 선점이며 이미 완료됨"으로 뜻이
 * 명확해지고, 호출부가 멱등 성공으로 다뤄도 안전하다.
 *
 * claim과 같은 키(p_user_id)로 advisory lock을 잡는다. "최신 선점 확인 → 완료 갱신"
 * 사이에 새 claim이 끼어드는 경합을 막기 위해서다.
 */
create function public.finalize_quiz_generation_v2(
  p_user_id uuid,
  p_note_id uuid,
  p_quiz_type text,
  p_claim_token uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_completed_at timestamptz;
begin
  if p_user_id is null or p_claim_token is null then
    return 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select g.id, g.created_at, g.completed_at
    into v_id, v_created_at, v_completed_at
  from public.quiz_generations g
  where g.user_id = p_user_id
    and g.note_id = p_note_id
    and g.quiz_type = p_quiz_type
    and g.claim_token = p_claim_token;

  if not found then
    return 'not_found';
  end if;

  if exists (
    select 1
    from public.quiz_generations g
    where g.user_id = p_user_id
      and g.note_id = p_note_id
      and g.quiz_type = p_quiz_type
      and g.created_at > v_created_at
  ) then
    return 'stale_claim';
  end if;

  if v_completed_at is not null then
    return 'already_completed';
  end if;

  update public.quiz_generations
  set completed_at = now()
  where id = v_id;

  return 'ok';
end;
$$;

revoke all on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid) to service_role;
