-- finalize_quiz_generation_v2가 완료 표시와 퀴즈 캐시(quizzes) 저장을 같은 트랜잭션 안에서
-- 함께 처리하도록, 7개 인자를 받는 오버로드를 additive로 추가한다 (additive)
--
-- 문제: 20260813070000의 finalize_quiz_generation_v2(4인자)는 completed_at 갱신만 하고,
-- quizzes 캐시 저장(quiz/actions.ts의 saveQuiz)은 별도 왕복으로 처리했다. 그 사이에 경합이
-- 있었다 — A가 이 함수로 completed_at을 찍은 직후, "완료 표시 후 즉시 재선점 가능" 규칙에
-- 따라 B가 새로 선점·생성·확정까지 끝내고 캐시에 먼저 저장할 수 있다. 그 뒤에야 A의
-- (더 오래된) 캐시 저장이 도착하면 B의 최신 결과를 덮어쓴다 — completed_at 갱신만으로는
-- 막지 못하는 경로다.
--
-- 처음에는 이 문제를 20260813070000의 finalize_quiz_generation_v2를 직접 고쳐서(4인자 →
-- 7인자 시그니처 변경) 해결하려 했다. 이건 실수였다 — 그 마이그레이션은 이미 개발 DB에
-- 적용된 뒤였다. 마이그레이션 파일을 고쳐도 이미 적용된 DB에는 다시 반영되지 않으므로,
-- 파일(7인자를 기대)과 실제 DB(4인자만 존재)가 어긋나 finalize 호출이 전부 실패할
-- 뻔했다. 그래서 20260813070000은 실제 적용됐던 4인자 버전으로 되돌리고, 여기서 7인자
-- 오버로드를 새로 추가한다.
--
-- PostgreSQL은 이름이 같아도 인자 타입이 다르면 별개 함수로 취급하므로(오버로드),
-- 4인자·7인자 finalize_quiz_generation_v2가 충돌 없이 공존한다. 4인자 버전은 이 배포가
-- 안정화될 때까지 남겨 둔다 — 직전 커밋(캐시 저장을 별도로 처리하던 버전)으로 롤백해도
-- 여전히 동작해야 하기 때문이다. quiz/actions.ts는 이제 7인자 버전만 부른다. 4인자 버전
-- 제거는 안정화 후 별도 마이그레이션으로 분리한다.

/**
 * 선점해 둔 행을 완료로 표시하고, 같은 트랜잭션 안에서 퀴즈 캐시(quizzes)까지 upsert한다.
 * 20260813070000의 4인자 버전을 대체한다(quiz/actions.ts는 이 버전만 부른다).
 *
 * 반환값
 *   'ok'                : 완료 표시 + 캐시 저장 성공
 *   'already_completed' : 최신 선점이며 이미 완료됨 (같은 세대의 재호출) — 캐시도 다시 저장한다(멱등)
 *   'stale_claim'       : 더 새로운 선점이 생겼다 — 이 응답은 버려진 세대다. 캐시에 손대지 않는다
 *   'not_found'         : 해당 선점 행이 없다. 캐시에 손대지 않는다
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
 * claim과 같은 키(p_user_id)로 advisory lock을 잡는다. "최신 선점 확인 → 완료 갱신 →
 * 캐시 저장" 전체가 새 claim과 경합하지 않도록 하기 위해서다.
 *
 * upsert가 제약 위반 등으로 실패하면 함수 전체가 예외로 롤백된다 — completed_at도
 * 함께 되돌아가 선점이 미완료로 남는다. 캐시 저장 실패를 조용히 넘기던 이전 동작보다
 * 엄격해진 것은 의도된 트레이드오프다. 미완료 행은 in-flight 창(300초)이 지나면
 * 자연히 재선점 대상이 되므로 사용자는 그만큼 기다린 뒤 재시도한다. 호출부는 이 예외를
 * PostgREST 에러로 받아 "저장은 실패했지만 이미 받은 퀴즈는 반환한다"로 처리한다.
 */
create function public.finalize_quiz_generation_v2(
  p_user_id uuid,
  p_note_id uuid,
  p_quiz_type text,
  p_claim_token uuid,
  p_questions jsonb,
  p_history jsonb,
  p_content_hash text
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
  v_result text;
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
    v_result := 'already_completed';
  else
    update public.quiz_generations
    set completed_at = now()
    where id = v_id;

    v_result := 'ok';
  end if;

  -- completed_at 갱신과 같은 트랜잭션·같은 advisory lock 안에서 실행된다.
  -- 여기서 실패하면 위 completed_at 갱신도 함께 롤백된다(주석 참고).
  insert into public.quizzes (
    note_id, user_id, quiz_type, questions, recent_questions, note_content_hash
  )
  values (
    p_note_id, p_user_id, p_quiz_type, p_questions, p_history, p_content_hash
  )
  on conflict (note_id, quiz_type) do update
  set questions = excluded.questions,
      recent_questions = excluded.recent_questions,
      note_content_hash = excluded.note_content_hash,
      user_id = excluded.user_id;

  return v_result;
end;
$$;

revoke all on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text) to service_role;
