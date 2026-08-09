-- review_gradings RPC 실행 권한·선점 세대 보강
--
-- 20260809000000_harden_review_gradings.sql이 남긴 두 가지를 닫는다.
--
--   1. 실행 권한 — finalize_review_grading은 전달받은 score/feedback을 그대로 저장하면서
--      authenticated 전체에 EXECUTE를 열어 두었다. 사용자가 PostgREST로
--      claim → finalize(100점)를 직접 호출하면 AI를 거치지 않고 점수를 확정할 수 있어,
--      "클라이언트가 자기 점수를 덮어쓰지 못하게 한다"는 원래 의도와 정면으로 어긋난다.
--      → 두 함수 모두 service_role 전용으로 바꾸고 서버 액션이 admin 클라이언트로 호출한다.
--      claim도 함께 옮긴다. 클라이언트에서 부를 이유가 없고, 열어 두면 사용자가 임의의
--      user_answer로 선점 행을 덮어써 진행 중인 채점을 무효화할 수 있다.
--
--   2. 선점 세대 — 60초가 지난 선점 행은 다음 요청이 이어받아 user_answer를 덮어쓰지만,
--      선점을 빼앗긴 이전 요청도 아무 확인 없이 결과를 확정할 수 있었다.
--      결과적으로 "답안 B + 답안 A 기준 피드백"이 한 행에 남는다.
--      → claim이 claim_token을 발급하고 finalize가 compare-and-set으로 확인한다.
--
-- auth.uid() 대신 p_user_id를 인자로 받는다. service_role로 호출하면 auth.uid()가 NULL이라
-- 기존 본문은 전부 not_found로 떨어진다. 인증 사용자는 이 함수를 실행할 수 없으므로
-- 호출자가 넘긴 user_id를 신뢰해도 우회 경로가 생기지 않는다.
-- 같은 이유로 이메일 인증 확인도 is_current_user_email_confirmed()(auth.uid() 기반) 대신
-- auth.users를 p_user_id로 직접 조회한다.

-- --------------------------------------------------------------------------
-- 1. 선점 세대를 식별할 토큰 컬럼
-- --------------------------------------------------------------------------

-- 이 마이그레이션 이전에 만들어진 선점 행은 claim_token이 NULL이라 확정되지 않는다.
-- 60초 뒤 재선점 대상이 되어 새 토큰을 받으므로 별도 백필은 하지 않는다.
alter table public.review_gradings add column claim_token uuid;

-- --------------------------------------------------------------------------
-- 2. 채점 권한 선점
-- --------------------------------------------------------------------------

-- 인자 구성이 바뀌므로 create or replace로는 갈아끼울 수 없다.
drop function if exists public.claim_review_grading(uuid, text);
drop function if exists public.finalize_review_grading(uuid, integer, jsonb);

/**
 * 복습 1회(review_log)에 대한 AI 채점 권한을 선점한다.
 * 반드시 Gemini를 호출하기 "전에" 부른다.
 *
 * 반환값은 jsonb다.
 *   {"status": "ok", "claimToken": "<uuid>"}
 *                    : 선점 성공. 호출자는 Gemini를 호출한 뒤 이 토큰으로 확정한다.
 *   {"status": "already_graded"} : 이미 채점이 끝났다. 호출자는 저장된 결과를 다시 읽는다.
 *   {"status": "in_flight"}      : 다른 요청이 채점 중이다.
 *   {"status": "not_found"}      : 본인의 진행 중인 복습 로그가 아니거나 이메일 미인증이다.
 *
 * review_log_id 단위 advisory lock으로 "조회 → 선점" 경합을 막는다.
 * lock이 없으면 동시 요청 두 건이 모두 "선점 가능"을 보고 통과한다.
 *
 * note_id와 round는 인자로 받지 않고 review_logs에서 직접 읽는다.
 *
 * 선점 행을 되돌리는 함수는 두지 않는다. c_stale_window가 지난 선점 행이
 * 자동으로 재선점 대상이 되고, Gemini 호출이 실패하면 사용자는 그만큼 기다린 뒤 재시도한다.
 */
create function public.claim_review_grading(
  p_user_id uuid,
  p_review_log_id uuid,
  p_user_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Gemini 호출이 이 시간을 넘기면 실패한 것으로 보고 재선점을 허용한다.
  c_stale_window constant interval := interval '60 seconds';

  v_note_id uuid;
  v_round integer;
  v_existing_score integer;
  v_existing_created_at timestamptz;
  v_claim_token uuid := gen_random_uuid();
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'not_found');
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

  if found then
    if v_existing_score is not null then
      return jsonb_build_object('status', 'already_graded');
    end if;

    if v_existing_created_at > now() - c_stale_window then
      return jsonb_build_object('status', 'in_flight');
    end if;

    -- 선점만 하고 끝내지 못한 행이다. 이번 요청이 이어받는다.
    -- 토큰을 새로 발급해 이전 요청이 늦게 도착해도 확정하지 못하게 한다.
    update public.review_gradings
    set user_answer = p_user_answer,
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
    claim_token
  )
  values (
    p_review_log_id,
    v_note_id,
    p_user_id,
    v_round,
    p_user_answer,
    null,
    null,
    v_claim_token
  );

  return jsonb_build_object('status', 'ok', 'claimToken', v_claim_token);
end;
$$;

revoke all on function public.claim_review_grading(uuid, uuid, text) from public;
grant execute on function public.claim_review_grading(uuid, uuid, text) to service_role;

-- --------------------------------------------------------------------------
-- 3. 채점 결과 확정
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
 * score/feedback을 여기서 검증한다. 클라이언트가 UPDATE 정책으로 직접 쓰게 두면
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

revoke all on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb) from public;
grant execute on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb) to service_role;
