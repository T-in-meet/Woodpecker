-- review_gradings 보안·동시성 보강
--
-- 20260808000000_create_review_gradings_table.sql이 남긴 세 가지 구멍을 닫는다.
--
--   1. DELETE 정책 — 사용자가 REST로 자기 채점 결과를 지운 뒤 다시 채점을 요청할 수 있었다.
--      "복습 1회당 채점 1회" 계약이 무력화되고 Gemini 호출도 무제한이 된다.
--      앱에는 채점 삭제 기능이 없고 노트·복습 로그 삭제는 FK cascade가 처리하므로 정책을 없앤다.
--
--   2. INSERT 정책 — user_id와 이메일 인증만 검사해서, review_log_id·note_id가 본인 것인지
--      확인하지 않았다. 또 feedback JSON 구조를 DB가 검증하지 않아
--      feedback = '{}' 같은 행을 직접 넣으면 앱의 Zod 파싱이 null로 떨어지고,
--      액션은 미채점으로 오판해 Gemini를 다시 부르지만 INSERT는 23505로 실패하는
--      "영구 재채점" 상태가 만들어졌다.
--      → 클라이언트 직접 INSERT를 막고 아래 SECURITY DEFINER 함수만 쓰기를 허용한다.
--
--   3. 동시 요청 — 앱이 "기존 결과 없음"을 확인한 뒤 Gemini를 호출하고 그 다음에야 INSERT해서,
--      동시 요청 N건이 모두 Gemini를 호출했다. 유니크 제약은 저장 중복만 막을 뿐
--      이미 나간 API 비용은 되돌리지 못한다.
--      → Gemini 호출 "전에" claim_review_grading으로 채점 권한을 원자적으로 선점한다.
--
-- quizzes도 같은 클래스의 버그를 20260806000001에서 한 번 고쳤다(타인 노트 UUID로 unique 선점).
-- review_gradings는 review_log_id가 unique라 구조가 같으므로 동일한 방식으로 막는다.

-- --------------------------------------------------------------------------
-- 1. 정책 정리: 읽기만 남기고 쓰기는 함수로 일원화
-- --------------------------------------------------------------------------

drop policy if exists "Users can delete own review gradings" on public.review_gradings;
drop policy if exists "Users can insert own review gradings" on public.review_gradings;

-- --------------------------------------------------------------------------
-- 2. 선점(pending) 행을 표현할 수 있도록 컬럼을 nullable로 바꾸고 정합성 제약을 건다
-- --------------------------------------------------------------------------

-- score/feedback이 NULL인 행 = "채점 진행 중" 선점 행.
-- 채점이 끝나면 finalize_review_grading이 두 값을 함께 채운다.
alter table public.review_gradings alter column score drop not null;
alter table public.review_gradings alter column feedback drop not null;

-- 반쪽짜리 행(점수만 있고 피드백이 없는 등)을 금지한다.
alter table public.review_gradings
  add constraint review_gradings_completion_check check (
    (score is null and feedback is null)
    or (score is not null and feedback is not null)
  );

-- feedback JSON 구조를 DB에서도 검증한다. 앱 Zod 스키마(gradingFeedbackSchema)와 같은 모양이다.
--
-- 조건 전체를 IS TRUE로 감싸는 것이 핵심이다.
-- 키가 없으면 `feedback -> 'summary'`가 SQL NULL이 되고 jsonb_typeof(NULL)도 NULL이라
-- AND 체인 전체가 NULL로 떨어지는데, CHECK 제약은 결과가 FALSE일 때만 거부하고
-- NULL은 통과시킨다. IS TRUE가 없으면 feedback = '{}'가 그대로 저장된다.
--
-- 원소 타입은 jsonpath로 본다. CHECK 제약 안에서는 서브쿼리가 금지라
-- jsonb_array_elements를 쓸 수 없다. jsonb_typeof만으로는 missedConcepts: [1]이 통과한다.
alter table public.review_gradings
  add constraint review_gradings_feedback_shape_check check (
    feedback is null
    or (
      jsonb_typeof(feedback) = 'object'
      and jsonb_typeof(feedback -> 'summary') = 'string'
      and jsonb_typeof(feedback -> 'missedConcepts') = 'array'
      and jsonb_typeof(feedback -> 'incorrectPoints') = 'array'
      and not jsonb_path_exists(feedback, '$.missedConcepts[*] ? (@.type() != "string")')
      and not jsonb_path_exists(feedback, '$.incorrectPoints[*] ? (@.type() != "string")')
    ) is true
  );

-- --------------------------------------------------------------------------
-- 3. 채점 권한 선점
-- --------------------------------------------------------------------------

/**
 * 복습 1회(review_log)에 대한 AI 채점 권한을 선점한다.
 * 반드시 Gemini를 호출하기 "전에" 부른다.
 *
 * 반환값
 *   'ok'             : 선점 성공. 호출자는 Gemini를 호출하고 finalize_review_grading으로 마무리한다.
 *   'already_graded' : 이미 채점이 끝났다. 호출자는 저장된 결과를 다시 읽어 반환한다.
 *   'in_flight'      : 다른 요청이 채점 중이다.
 *   'not_found'      : 본인의 진행 중인 복습 로그가 아니거나 이메일 미인증이다.
 *
 * review_log_id 단위 advisory lock으로 "조회 → 선점" 경합을 막는다.
 * lock이 없으면 동시 요청 두 건이 모두 "선점 가능"을 보고 통과한다.
 *
 * note_id와 round는 인자로 받지 않고 review_logs에서 직접 읽는다.
 * 인증 사용자가 PostgREST로 직접 호출할 수 있으므로 클라이언트 값을 믿지 않는다.
 *
 * 선점 행을 되돌리는 함수는 두지 않는다. 인증 사용자가 실행할 수 있으면
 * 선점 → 해제를 반복해 Gemini를 무제한으로 호출할 수 있기 때문이다.
 * 대신 c_stale_window가 지난 선점 행은 자동으로 재선점 대상이 된다.
 * Gemini 호출이 실패하면 사용자는 이 시간만큼 기다린 뒤 재시도한다.
 */
create or replace function public.claim_review_grading(
  p_review_log_id uuid,
  p_user_answer text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Gemini 호출이 이 시간을 넘기면 실패한 것으로 보고 재선점을 허용한다.
  c_stale_window constant interval := interval '60 seconds';

  v_user_id uuid := auth.uid();
  v_note_id uuid;
  v_round integer;
  v_existing_score integer;
  v_existing_created_at timestamptz;
begin
  if v_user_id is null then
    return 'not_found';
  end if;

  if not public.is_current_user_email_confirmed() then
    return 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_review_log_id::text));

  select l.note_id, l.round
    into v_note_id, v_round
  from public.review_logs l
  where l.id = p_review_log_id
    and l.user_id = v_user_id
    and l.completed_at is null;

  if v_note_id is null then
    return 'not_found';
  end if;

  select g.score, g.created_at
    into v_existing_score, v_existing_created_at
  from public.review_gradings g
  where g.review_log_id = p_review_log_id;

  if found then
    if v_existing_score is not null then
      return 'already_graded';
    end if;

    if v_existing_created_at > now() - c_stale_window then
      return 'in_flight';
    end if;

    -- 선점만 하고 끝내지 못한 행이다. 이번 요청이 이어받는다.
    update public.review_gradings
    set user_answer = p_user_answer,
        created_at = now()
    where review_log_id = p_review_log_id;

    return 'ok';
  end if;

  insert into public.review_gradings (
    review_log_id,
    note_id,
    user_id,
    round,
    user_answer,
    score,
    feedback
  )
  values (
    p_review_log_id,
    v_note_id,
    v_user_id,
    v_round,
    p_user_answer,
    null,
    null
  );

  return 'ok';
end;
$$;

revoke all on function public.claim_review_grading(uuid, text) from public;
grant execute on function public.claim_review_grading(uuid, text) to authenticated;

-- --------------------------------------------------------------------------
-- 4. 채점 결과 확정
-- --------------------------------------------------------------------------

/**
 * 선점해 둔 행에 채점 결과를 채운다.
 *
 * 반환값
 *   'ok'             : 저장 성공
 *   'already_graded' : 이미 확정된 행이다 (동시 요청이 먼저 저장함)
 *   'not_found'      : 선점 행이 없거나 본인 것이 아니다
 *
 * score/feedback을 여기서 검증한다. 클라이언트가 UPDATE 정책으로 직접 쓰게 두면
 * 자기 채점 점수를 임의 값으로 덮어쓸 수 있으므로 UPDATE 정책은 만들지 않는다.
 */
create or replace function public.finalize_review_grading(
  p_review_log_id uuid,
  p_score integer,
  p_feedback jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_score integer;
begin
  if v_user_id is null then
    return 'not_found';
  end if;

  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  -- 위 CHECK 제약과 같은 조건을 뒤집은 것이다.
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

  select g.score into v_existing_score
  from public.review_gradings g
  where g.review_log_id = p_review_log_id
    and g.user_id = v_user_id;

  if not found then
    return 'not_found';
  end if;

  if v_existing_score is not null then
    return 'already_graded';
  end if;

  update public.review_gradings
  set score = p_score,
      feedback = p_feedback
  where review_log_id = p_review_log_id
    and user_id = v_user_id;

  return 'ok';
end;
$$;

revoke all on function public.finalize_review_grading(uuid, integer, jsonb) from public;
grant execute on function public.finalize_review_grading(uuid, integer, jsonb) to authenticated;
