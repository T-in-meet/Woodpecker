-- 채점 AI 프로바이더를 Gemini에서 Cloudflare Workers AI(@cf/openai/gpt-oss-120b)로 교체하며
-- 실측한 지연시간이 기존 설계 값(최대 21.2초)을 크게 벗어났다 — 프로덕션 규모 입력(노트
-- 10,000~30,000자)에서 채점 1건이 최대 119.7초 걸렸고, 완주하지 못한 경우도 있었다.
--
-- 이 함수의 반환형(jsonb)과 시그니처는 그대로다. CREATE OR REPLACE로 c_stale_window 값과
-- 관련 주석만 갱신한다 — 20260808000000_create_review_gradings.sql의 원본은 손대지 않는다.
--
-- 값 변경 근거:
--   - Vercel Hobby 플랜은 Fluid Compute 기본 활성화로 함수 실행 상한이 300초다(예전 60초 아님).
--   - 새 순서: 채점 deadline(240초) < 페이지 maxDuration(280초) < 이 stale window(300초).
--     각 단계 사이에 최소 20~40초 여유를 둬, 앞단(인증·조회·선점) 지연이나 플랫폼 오버헤드가
--     순서를 깨지 않게 한다.
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
  -- AI 호출이 이 시간을 넘기면 실패한 것으로 보고 재선점을 허용한다.
  -- 앱의 채점 deadline(240초) < 페이지 maxDuration(280초) < 이 값 순서를 지켜야 한다.
  c_stale_window constant interval := interval '300 seconds';

  -- 채점은 복습 회차당 1회뿐이라 정상 사용자가 하루에 이 값을 넘길 일은 거의 없다.
  -- 노트를 대량으로 만들어 연속 호출하는 경로를 막는 것이 목적이다.
  c_daily_limit constant integer := 30;
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

  -- review_log_id 단위 advisory lock으로 "조회 → 선점" 경합을 막는다.
  -- lock이 없으면 동시 요청 두 건이 모두 "선점 가능"을 보고 통과한다.
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

  -- 한도 검사보다 앞에 둔다. 저장된 결과를 다시 읽거나 다른 요청을 기다리는 건
  -- AI를 부르지 않으므로 사용량을 깎을 이유가 없다.
  if found then
    if v_existing_score is not null then
      return jsonb_build_object('status', 'already_graded');
    end if;

    if v_existing_created_at > now() - c_stale_window then
      return jsonb_build_object('status', 'in_flight');
    end if;
  end if;

  -- 여기부터는 AI를 부르는 경로다. 사용량을 검사하고 기록한다.
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

  -- created_at은 NOT NULL이라, 값이 채워졌다는 건 위 SELECT가 행을 찾았다는 뜻이다.
  -- 중간에 다른 SELECT를 거쳐서 FOUND는 더 이상 그 조회의 결과가 아니다.
  if v_existing_created_at is not null then
    -- 선점만 하고 끝내지 못한 행이다. 이번 요청이 이어받는다.
    -- 토큰을 새로 발급해 이전 요청이 늦게 도착해도 확정하지 못하게 한다.
    -- 답안만 덮고 기준 해시를 두면 "답안 B + A 기준 원본"이 한 행에 남는다.
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
