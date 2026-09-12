/**
 * Review Grading finalizer가 이번 호출에서 확정한 grading UUID를 상태와 함께 반환합니다.
 *
 * 기존 score/feedback 검증, application user ownership, Review Log advisory lock,
 * 이미 확정된 결과 검사, claim token 검사와 UPDATE 조건을 모두 유지합니다.
 * 이미 완료된 결과나 stale claim에는 과거 행의 ID를 현재 실행 결과로 반환하지 않습니다.
 */
drop function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb);

create function public.finalize_review_grading(
  p_user_id uuid,
  p_review_log_id uuid,
  p_claim_token uuid,
  p_score integer,
  p_feedback jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_score integer;
  v_existing_claim_token uuid;
  v_grading_id uuid;
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'not_found', 'gradingId', null);
  end if;

  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  -- Table CHECK와 동일한 feedback 구조를 finalizer에서도 검증합니다.
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

  -- Review Log 단위 직렬화 뒤 현재 사용자의 선점 상태를 읽습니다.
  perform pg_advisory_xact_lock(hashtext(p_review_log_id::text));

  select g.score, g.claim_token
    into v_existing_score, v_existing_claim_token
  from public.review_gradings g
  where g.review_log_id = p_review_log_id
    and g.user_id = p_user_id;

  if not found then
    return jsonb_build_object('status', 'not_found', 'gradingId', null);
  end if;

  if v_existing_score is not null then
    return jsonb_build_object('status', 'already_graded', 'gradingId', null);
  end if;

  -- 이어받기 이후 도착한 이전 요청은 현재 답안에 결과를 쓸 수 없습니다.
  if p_claim_token is null or v_existing_claim_token is distinct from p_claim_token then
    return jsonb_build_object('status', 'stale_claim', 'gradingId', null);
  end if;

  -- 기존 ownership 조건을 유지하며 이 호출이 확정한 행의 UUID만 반환합니다.
  update public.review_gradings
  set score = p_score,
      feedback = p_feedback
  where review_log_id = p_review_log_id
    and user_id = p_user_id
  returning id into v_grading_id;

  return jsonb_build_object('status', 'ok', 'gradingId', v_grading_id);
end;
$$;

-- 함수 재생성 뒤 service_role 전용 실행 권한을 기존 계약대로 복원합니다.
revoke all on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb)
  to service_role;

comment on function public.finalize_review_grading(uuid, uuid, uuid, integer, jsonb) is
  '선점 token과 소유권을 검증해 Review Grading을 확정하고 이번 호출이 저장한 grading UUID를 상태와 함께 반환합니다.';
