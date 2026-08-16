-- =========================================
-- quiz_generations / v2 호환성
--
-- 20260813070000은 기존 claim_quiz_generation(text 반환)을 건드리지 않고
-- v2 함수 두 개를 나란히 추가한 additive 마이그레이션이었다. 그때 이 파일은
-- "v1 경로가 여전히 동작한다"(롤백 안전성)까지 함께 검증했지만,
-- 20260815230000이 v1을 제거하면서 그 두 가지는 성립하지 않게 되어 삭제했다.
-- 롤백 창이 닫혔다는 사실은 해당 마이그레이션 주석에 적혀 있다.
--
-- 남은 두 가지는 v1이 사라져도 계속 성립해야 한다.
--   1. v1이 남긴 claim_token = null 행이 테이블에 그대로 있고, v2가 이를
--      안전하게 처리한다. 함수는 지웠지만 **행은 지우지 않았다.**
--   2. 20260813120000이 7인자 오버로드를 추가한 뒤에도 4인자
--      finalize_quiz_generation_v2(20260813070000)가 여전히 존재하고 동작한다.
--      quiz/actions.ts가 7인자만 부르더라도, 캐시 저장을 별도로 처리하던
--      커밋으로 롤백하면 4인자 버전이 필요하기 때문이다.
-- =========================================

BEGIN;

SELECT plan(2);

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

-- 1. v1이 남긴 형태의 행(claim_token·completed_at 모두 null)을 v2가 in-flight로
-- 안전하게 잡는다. 완료 표시를 우회 수단으로 쓸 수 없게 보수적으로 막는 쪽으로
-- 기운 의도된 동작이다.
--
-- v1 함수는 20260815230000에서 제거됐으므로 그 함수가 만들던 행 모양을 직접 넣는다.
-- 운영 quiz_generations에는 이런 행이 실제로 남아 있다.
INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, claim_token, completed_at)
VALUES (
  current_setting('test.qgc_user_id')::uuid,
  current_setting('test.qgc_note_id')::uuid,
  'ox',
  NULL,
  NULL
);

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgc_user_id')::uuid,
    current_setting('test.qgc_note_id')::uuid,
    'ox'
  ) ->> 'status',
  'in_flight',
  $$v1이 남긴 claim_token null 행이 최근 것이면 v2도 in_flight로 막아야 한다$$
);

-- 2. 4인자 finalize_quiz_generation_v2(20260813070000)가 여전히 존재하고 동작해야
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
