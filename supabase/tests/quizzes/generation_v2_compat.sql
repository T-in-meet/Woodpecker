-- =========================================
-- quiz_generations / v1·v2 additive 호환성
--
-- 20260813070000은 기존 claim_quiz_generation(text 반환)을 건드리지 않고
-- v2 함수 두 개를 나란히 추가한 additive 마이그레이션이다. 마이그레이션 적용 직후
-- 다음 두 가지가 동시에 성립해야 롤백 안전성이 보장된다.
--   1. 기존 v1 경로가 여전히 text를 반환하며 정상 동작한다 (이전 배포로 롤백 가능)
--   2. v1이 만든 claim_token = null 행을 v2가 안전하게 처리한다
--
-- 20260813120000은 finalize_quiz_generation_v2에 완료 표시+캐시 저장을 함께 하는
-- 7인자 오버로드를 추가했다. 4인자 버전(20260813070000)은 지우지 않고 그대로 뒀다 —
-- quiz/actions.ts가 7인자만 부르더라도, 이 배포 직전 커밋(캐시 저장을 별도로 처리하던
-- 버전)으로 롤백하면 4인자 버전이 여전히 필요하기 때문이다. 3번이 이걸 확인한다.
-- =========================================

BEGIN;

SELECT plan(4);

SELECT set_config('test.qgc_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgc_note_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  current_setting('test.qgc_user_id')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'qgc_' || current_setting('test.qgc_user_id') || '@example.com',
  crypt('password123', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.qgc_note_id')::uuid,
  current_setting('test.qgc_user_id')::uuid,
  'note',
  'content',
  0
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.qgc_user_id'), 'role', 'authenticated')::text,
  true
);

-- 1. 기존 v1 경로는 마이그레이션 이후에도 여전히 text 'ok'를 반환한다 (claim_token은 null로 남는다)
SELECT is(
  public.claim_quiz_generation(
    current_setting('test.qgc_note_id')::uuid,
    'ox'
  ),
  'ok',
  $$additive 마이그레이션 이후에도 claim_quiz_generation(v1)은 text 'ok'를 반환해야 한다$$
);

RESET ROLE;

-- v1이 만든 행은 claim_token이 null이고 completed_at도 null이다
SELECT is(
  (
    SELECT claim_token IS NULL AND completed_at IS NULL
    FROM public.quiz_generations
    WHERE user_id = current_setting('test.qgc_user_id')::uuid
      AND note_id = current_setting('test.qgc_note_id')::uuid
      AND quiz_type = 'ox'
  ),
  true,
  $$v1이 만든 행은 claim_token·completed_at이 모두 null이어야 한다$$
);

-- 2. v1이 만든 최근 미완료 행(claim_token = null)을 v2가 in-flight로 안전하게 잡는다.
-- 완료 표시를 우회 수단으로 쓸 수 없게 보수적으로 막는 쪽으로 기운 의도된 동작이다.
SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgc_user_id')::uuid,
    current_setting('test.qgc_note_id')::uuid,
    'ox'
  ) ->> 'status',
  'in_flight',
  $$v1이 만든 claim_token null 행이 최근 것이면 v2도 in_flight로 막아야 한다$$
);

-- 3. 4인자 finalize_quiz_generation_v2(20260813070000)가 여전히 존재하고 동작해야
-- 롤백 안전성이 성립한다. 별도 노트로 새로 선점해 7인자 오버로드와 섞이지 않게 한다.
SELECT set_config('test.qgc_note2_id', gen_random_uuid()::text, true);

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.qgc_note2_id')::uuid,
  current_setting('test.qgc_user_id')::uuid,
  'note 2',
  'content 2',
  0
)
ON CONFLICT (id) DO NOTHING;

SELECT set_config(
  'test.qgc_claim2',
  public.claim_quiz_generation_v2(
    current_setting('test.qgc_user_id')::uuid,
    current_setting('test.qgc_note2_id')::uuid,
    'ox'
  )::text,
  true
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgc_user_id')::uuid,
    current_setting('test.qgc_note2_id')::uuid,
    'ox',
    ((current_setting('test.qgc_claim2')::jsonb) ->> 'claimToken')::uuid
  ),
  'ok',
  $$4인자 finalize_quiz_generation_v2(20260813070000)는 캐시 저장 없이도 여전히 ok를 반환해야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
