-- 퀴즈 신규 생성·재생성 하루 한도를 3회 -> 5회로 올린다.
-- 버스트 한도, 선점 만료, 함수 시그니처와 반환형은 그대로 유지한다.

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
  c_daily_limit constant integer := 5;
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
