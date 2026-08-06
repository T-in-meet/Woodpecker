-- 퀴즈 생성(Gemini 호출) 사용량 제한
--
-- 제한 대상은 실제 Gemini 호출뿐이다. 캐시 적중은 기록하지 않으므로
-- 한도를 모두 써도 이미 생성된 퀴즈는 계속 풀 수 있다.
--
-- 세 가지를 한 번에 막는다.
--   1. 일일 한도  : KST 날짜 기준 하루 30회
--   2. 버스트 한도: 60초 안에 5회
--   3. 중복 요청  : 같은 노트·유형을 10초 안에 다시 요청
--
-- 한도 값은 반드시 이 함수 안에 상수로 둔다. 인자로 받으면 PostgREST를 통해
-- 인증된 사용자가 직접 큰 값을 넘겨 우회할 수 있다.
--
-- 같은 이유로 사용 기록을 되돌리는 함수는 두지 않는다. 인증 사용자가 실행할 수 있으면
-- 성공한 생성 직후에 직접 호출해 기록을 지우고 한도를 무한정 늘릴 수 있다.
-- Gemini 호출이 실패해도 사용량은 그대로 차감된다.

create table public.quiz_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  quiz_type text not null,
  created_at timestamptz not null default now()
);

create index quiz_generations_user_created_idx
  on public.quiz_generations (user_id, created_at desc);

create index quiz_generations_note_type_created_idx
  on public.quiz_generations (note_id, quiz_type, created_at desc);

alter table public.quiz_generations enable row level security;

-- 조회만 허용한다. 쓰기는 아래 SECURITY DEFINER 함수만 할 수 있다.
create policy "Users can read own quiz generations"
  on public.quiz_generations for select
  using (auth.uid() = user_id);

/**
 * 퀴즈 생성 1회를 선점한다.
 *
 * 반환값
 *   'ok'                : 통과, 사용 기록이 삽입됨
 *   'not_found'         : 본인 노트가 아니거나 존재하지 않음
 *   'in_flight'         : 같은 노트·유형을 방금 요청함
 *   'too_many_requests' : 짧은 시간에 너무 많이 요청함
 *   'daily_exceeded'    : 오늘 한도를 모두 사용함
 *
 * 카운트와 INSERT 사이의 경합을 막기 위해 사용자 단위 advisory lock을 잡는다.
 * lock이 없으면 동시 요청 두 건이 모두 한도 미만을 보고 통과한다.
 */
create or replace function public.claim_quiz_generation(
  p_note_id uuid,
  p_quiz_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily_limit constant integer := 30;
  c_burst_limit constant integer := 5;
  c_burst_window constant interval := interval '60 seconds';
  c_in_flight_window constant interval := interval '10 seconds';

  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    return 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  if not exists (
    select 1
    from public.notes n
    where n.id = p_note_id
      and n.user_id = v_user_id
  ) then
    return 'not_found';
  end if;

  select count(*) into v_count
  from public.quiz_generations g
  where g.user_id = v_user_id
    and g.note_id = p_note_id
    and g.quiz_type = p_quiz_type
    and g.created_at > now() - c_in_flight_window;

  if v_count > 0 then
    return 'in_flight';
  end if;

  select count(*) into v_count
  from public.quiz_generations g
  where g.user_id = v_user_id
    and g.created_at > now() - c_burst_window;

  if v_count >= c_burst_limit then
    return 'too_many_requests';
  end if;

  select count(*) into v_count
  from public.quiz_generations g
  where g.user_id = v_user_id
    and public.kst_date(g.created_at) = public.kst_date(now());

  if v_count >= c_daily_limit then
    return 'daily_exceeded';
  end if;

  insert into public.quiz_generations (user_id, note_id, quiz_type)
  values (v_user_id, p_note_id, p_quiz_type);

  return 'ok';
end;
$$;

revoke all on function public.claim_quiz_generation(uuid, text) from public;

grant execute on function public.claim_quiz_generation(uuid, text) to authenticated;
