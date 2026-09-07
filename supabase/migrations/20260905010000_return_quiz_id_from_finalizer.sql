-- token-aware 7인자 Quiz finalizer가 같은 upsert에서 확정한 Quiz UUID를 반환한다.
-- 4인자 compatibility overload는 시그니처와 동작을 그대로 유지한다.

drop function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text);

/**
 * 최신 Quiz 생성 claim을 완료하고 캐시를 upsert한 뒤 status와 Quiz UUID를 반환한다.
 *
 * advisory lock, 최신 claim 판정, completed 상태 및 stale/not-found 의미는 기존
 * 7인자 함수와 동일하다. ok와 최신 세대의 멱등 재호출인 already_completed만
 * 같은 upsert의 RETURNING id를 결과 UUID로 제공한다.
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
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_completed_at timestamptz;
  v_quiz_id uuid;
  v_status text;
begin
  -- 필수 식별자가 없으면 어떤 행도 조회하거나 변경하지 않는다.
  if p_user_id is null or p_claim_token is null then
    return jsonb_build_object('status', 'not_found', 'quizId', null);
  end if;

  -- claim과 같은 사용자 단위 advisory lock으로 최신 세대 판정을 보호한다.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select g.id, g.created_at, g.completed_at
    into v_id, v_created_at, v_completed_at
  from public.quiz_generations g
  where g.user_id = p_user_id
    and g.note_id = p_note_id
    and g.quiz_type = p_quiz_type
    and g.claim_token = p_claim_token;

  if not found then
    return jsonb_build_object('status', 'not_found', 'quizId', null);
  end if;

  -- 이미 완료된 과거 세대도 최신 claim보다 우선하지 못하게 stale을 먼저 판정한다.
  if exists (
    select 1
    from public.quiz_generations g
    where g.user_id = p_user_id
      and g.note_id = p_note_id
      and g.quiz_type = p_quiz_type
      and g.created_at > v_created_at
  ) then
    return jsonb_build_object('status', 'stale_claim', 'quizId', null);
  end if;

  -- 최신 claim의 완료 여부에 따라 기존 status 의미를 유지한다.
  if v_completed_at is not null then
    v_status := 'already_completed';
  else
    update public.quiz_generations
    set completed_at = now()
    where id = v_id;

    v_status := 'ok';
  end if;

  -- 완료 표시와 같은 트랜잭션에서 캐시를 저장하고 그 행의 UUID를 즉시 확보한다.
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
      user_id = excluded.user_id
  returning id into v_quiz_id;

  return jsonb_build_object('status', v_status, 'quizId', v_quiz_id);
end;
$$;

comment on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text)
  is '최신 Quiz 생성 claim을 완료하고 캐시 UUID와 처리 상태를 반환한다.';

revoke all on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_quiz_generation_v2(uuid, uuid, text, uuid, jsonb, jsonb, text)
  to service_role;
