-- =========================================
-- quiz_generations / claim_quiz_generation_v2 · finalize_quiz_generation_v2
--
-- v1(claim_quiz_generation)의 in-flight 검사는 "최근 10초 내 같은 요청"일 뿐 완료 여부를
-- 모른다. v2는 완료 상태(completed_at)를 도입해 "9초 만에 끝난 요청도 창이 닫힐 때까지
-- 재생성이 막히는" 문제와 "느린 응답 두 건이 순서 없이 저장을 덮어쓰는" 문제를 함께 푼다.
-- =========================================

BEGIN;

SELECT plan(15);

SELECT set_config('test.qgv2_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_b_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    current_setting('test.qgv2_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'qgv2_a_' || current_setting('test.qgv2_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.qgv2_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'qgv2_b_' || current_setting('test.qgv2_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.qgv2_note_a_id')::uuid, current_setting('test.qgv2_user_a_id')::uuid, 'note a', 'content a', 0),
  (current_setting('test.qgv2_note_a2_id')::uuid, current_setting('test.qgv2_user_a_id')::uuid, 'note a2', 'content a2', 0),
  (current_setting('test.qgv2_note_b_id')::uuid, current_setting('test.qgv2_user_b_id')::uuid, 'note b', 'content b', 0)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 1. 권한 잠금 — authenticated는 v2를 직접 호출할 수 없어야 한다
-- =========================================

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.qgv2_user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.claim_quiz_generation_v2('%s'::uuid, '%s'::uuid, 'ox');
    $sql$,
    current_setting('test.qgv2_user_a_id'),
    current_setting('test.qgv2_note_a_id')
  ),
  '42501',
  NULL,
  $$authenticated로 claim_quiz_generation_v2를 직접 호출하면 거부돼야 한다$$
);

RESET ROLE;

-- =========================================
-- 2. 정상 선점 → 완료 → 즉시 재선점
-- =========================================

SELECT set_config(
  'test.qgv2_claim1',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim1')::jsonb) ->> 'status',
  'ok',
  $$본인 노트에 대한 첫 선점은 ok를 반환해야 한다$$
);

-- 미완료 선점이 창 안에서는 in_flight를 반환해야 한다
SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  ) ->> 'status',
  'in_flight',
  $$미완료 선점이 창 안에 있으면 in_flight를 반환해야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim1')::jsonb) ->> 'claimToken')::uuid
  ),
  'ok',
  $$선점한 행을 완료로 확정할 수 있어야 한다$$
);

-- 완료 상태 도입의 핵심: 완료 표시 후에는 창이 남아 있어도 즉시 재선점된다
--
-- 반환값을 반드시 캡처해서 쓴다. 이 테스트 파일 전체가 트랜잭션 하나(BEGIN~ROLLBACK) 안에서
-- 돌아 now()가 트랜잭션 시작 시각으로 고정되므로, claim1·claim2의 created_at이 동일해진다.
-- 이후 "ORDER BY created_at DESC LIMIT 1"로 claim2를 다시 조회하면 동시각 tie 중 아무 행이나
-- 걸릴 수 있어(완료된 claim1을 집어올 수도 있다) 안전하지 않다.
SELECT set_config(
  'test.qgv2_claim2',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim2')::jsonb) ->> 'status',
  'ok',
  $$완료 표시 후에는 즉시 재선점돼야 한다$$
);

-- =========================================
-- 3. finalize 예외 조건
-- =========================================

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    gen_random_uuid()
  ),
  'not_found',
  $$존재하지 않는 claim_token으로 확정하면 not_found여야 한다$$
);

-- 위에서 캡처해 둔 claim2(2번 claim)를 완료해 already_completed 경로를 만든다
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim2')::jsonb) ->> 'claimToken')::uuid
  ),
  'ok',
  $$두 번째 선점도 정상 확정돼야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim2')::jsonb) ->> 'claimToken')::uuid
  ),
  'already_completed',
  $$이미 완료된 최신 선점을 다시 확정하면 already_completed여야 한다$$
);

-- =========================================
-- 4. 선점 인계 — stale_claim의 핵심
--    A 선점 → A의 created_at을 in-flight 창 이전으로 이동 → B가 선점 인계
--    → A token으로 finalize = stale_claim → B는 여전히 미완료
--    → B token으로 finalize = ok
-- =========================================

SELECT set_config(
  'test.qgv2_claim_a',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank'
  )::text,
  true
);

UPDATE public.quiz_generations
SET created_at = now() - interval '301 seconds'
WHERE claim_token = ((current_setting('test.qgv2_claim_a')::jsonb) ->> 'claimToken')::uuid;

SELECT set_config(
  'test.qgv2_claim_b',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim_b')::jsonb) ->> 'status',
  'ok',
  $$in-flight 창을 넘긴 미완료 선점은 새 요청이 이어받아야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank',
    ((current_setting('test.qgv2_claim_a')::jsonb) ->> 'claimToken')::uuid
  ),
  'stale_claim',
  $$인계당한 과거 토큰으로 확정하면 stale_claim이어야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank',
    ((current_setting('test.qgv2_claim_b')::jsonb) ->> 'claimToken')::uuid
  ),
  'ok',
  $$최신 선점 토큰으로는 정상 확정돼야 한다$$
);

-- =========================================
-- 5. 판정 순서 고정 — 완료된 과거 claim보다 새 claim이 있으면
--    과거 token은 already_completed가 아니라 stale_claim이어야 한다
-- =========================================

SELECT set_config(
  'test.qgv2_claim_c',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice'
  )::text,
  true
);

-- C를 먼저 완료시킨다 (completed_at이 채워진 과거 행이 된다)
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice',
    ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid
  ),
  'ok',
  $$C 선점을 먼저 완료시킨다$$
);

UPDATE public.quiz_generations
SET created_at = now() - interval '301 seconds'
WHERE claim_token = ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid;

SELECT set_config(
  'test.qgv2_claim_d',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice'
  )::text,
  true
);

-- D가 새로 선점됐으므로, 완료됐던 C 토큰도 already_completed가 아니라 stale_claim이어야 한다
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice',
    ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid
  ),
  'stale_claim',
  $$완료된 과거 claim보다 새 claim이 있으면 stale_claim이 already_completed보다 우선해야 한다$$
);

-- =========================================
-- 6. 노트 소유권 재검증 — v2는 service_role로 불려 RLS를 우회하므로 자체 재검증한다
-- =========================================

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_b_id')::uuid,
    'ox'
  ) ->> 'status',
  'not_found',
  $$v2 claim이 p_user_id 소유가 아닌 노트를 선점하면 not_found여야 한다$$
);

-- =========================================
-- 7. 완료 행도 버스트·일일 카운트에 잡힌다 (완료 표시가 한도 우회 수단이 되면 안 된다)
-- =========================================

UPDATE public.quiz_generations
SET created_at = now() - interval '2 minutes'
WHERE user_id = current_setting('test.qgv2_user_a_id')::uuid;

INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, completed_at, created_at)
SELECT
  current_setting('test.qgv2_user_a_id')::uuid,
  current_setting('test.qgv2_note_a2_id')::uuid,
  'daily_' || i,
  now() - interval '2 minutes',
  now() - interval '2 minutes'
FROM generate_series(1, 30) AS i;

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'daily_probe'
  ) ->> 'status',
  'daily_exceeded',
  $$완료된 행도 일일 한도에 포함돼야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
