-- 도달할 수 없게 된 백지 테스트 채점 버스트 한도만 제거한다.
--
-- 20260815212746에서 일일 한도를 낮추면서(채점 30 -> 5, 퀴즈 30 -> 3) 버스트 한도는
-- 그대로 뒀다. 채점은 KST 자정 양쪽에서 일일 최대치를 모두 써도 60초 안에 최대
-- 10회이므로 11번째 요청은 새 날짜의 일일 한도에도 막힌다. 버스트 분기가 호출 허용량을
-- 줄이는 경우가 없어 제거한다.
--
-- 퀴즈는 다르다. KST 자정 직전 3회 + 직후 3회로 60초 안에 6회까지 일일 검사를
-- 통과할 수 있다. 기존 5회/60초 버스트가 여섯 번째 호출을 막으므로 그대로 유지한다.
--
-- 계정 전체 한도(Cloudflare 무료 플랜 하루 10,000 Neurons)는 per-user 버스트로는
-- 애초에 막을 수 없다. 사용자 100명이 각자 1회씩 동시에 쏘면 버스트는 아무것도
-- 걸러내지 못한다. 그 실패 모드는 앱에서 Cloudflare 오류 코드 3036·4006을
-- quotaExhausted로 옮겨 전용 문구로 안내한다(src/lib/ai/failureReason.ts).
--
-- **채점 일일 한도를 다시 올린다면(유료 플랜 전환 등) 버스트 재도입을 함께 검토한다.**
--
-- 이미 개발 DB에 적용된 마이그레이션은 수정하지 않는다.
-- 두 함수의 시그니처와 반환형은 그대로이므로 본문만 교체한다.
-- v1 claim_quiz_generation(20260806000002)의 한도·권한 정리는 별도 마이그레이션으로 분리한다.

create or replace function public.claim_review_grading(
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
  c_stale_window constant interval := interval '120 seconds';
  c_daily_limit constant integer := 5;

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

  if found then
    if v_existing_score is not null then
      return jsonb_build_object('status', 'already_graded');
    end if;

    if v_existing_created_at > now() - c_stale_window then
      return jsonb_build_object('status', 'in_flight');
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into v_count
  from public.review_grading_generations rg
  where rg.user_id = p_user_id
    and public.kst_date(rg.created_at) = public.kst_date(now());

  if v_count >= c_daily_limit then
    return jsonb_build_object('status', 'daily_exceeded');
  end if;

  insert into public.review_grading_generations (user_id, review_log_id)
  values (p_user_id, p_review_log_id);

  if v_existing_created_at is not null then
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

revoke all on function public.claim_review_grading(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_review_grading(uuid, uuid, text, text)
  to service_role;

create or replace function public.claim_quiz_generation_v2(
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
  c_daily_limit constant integer := 3;
  c_burst_limit constant integer := 5;
  c_burst_window constant interval := interval '60 seconds';
  c_in_flight_window constant interval := interval '120 seconds';

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

revoke all on function public.claim_quiz_generation_v2(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_quiz_generation_v2(uuid, uuid, text)
  to service_role;
