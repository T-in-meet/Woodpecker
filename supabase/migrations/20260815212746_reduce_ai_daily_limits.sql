-- Cloudflare Workers AI 무료 할당량(계정 전체 하루 10,000 Neurons)을 여러 사용자가
-- 나눠 쓸 수 있도록 사용자별 신규 AI 호출 한도를 현실적인 학습량으로 낮춘다.
-- 캐시된 퀴즈 재풀이는 AI를 호출하지 않으므로 이 한도에 포함되지 않는다.
--
-- 백지 테스트 AI 채점: 하루 30회 -> 5회
-- 퀴즈 신규 생성·재생성: 하루 30회 -> 3회
-- 버스트 한도, 선점 만료, 함수 시그니처와 반환형은 그대로 유지한다.

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
