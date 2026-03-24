-- =========================================
-- notes / CONSTRAINTS_DEFAULT
-- =========================================

BEGIN;

SELECT plan(4);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_default_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_compare_omit_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_compare_zero_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_invariant_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_constraints_default_user_a_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- review_round를 명시하지 않고 INSERT하면 기본값 0으로 설정되어야 한다
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.notes_constraints_default_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'default title',
  'default content'
);
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_note_id')::uuid),
  0,
  'review_round를 명시하지 않고 INSERT하면 기본값 0으로 설정되어야 한다'
);

-- [예외 조건]
-- 없음 (NULL 입력 실패는 규칙 3에서 검증)
SELECT ok(
  true,
  '없음 (NULL 입력 실패는 규칙 3에서 검증)'
);

-- [경계 조건]
-- review_round를 생략한 경우와 0으로 명시한 경우의 결과가 동일해야 한다
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.notes_constraints_default_compare_omit_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'default omit',
  'default omit content'
);
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_compare_zero_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'default zero',
  'default zero content',
  0
);
SELECT ok(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_compare_omit_id')::uuid) = 0
  AND (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_compare_zero_id')::uuid) = 0,
  'review_round를 생략한 경우와 0으로 명시한 경우의 결과가 동일해야 한다'
);

-- [불변 조건]
-- review_round를 생략하여 생성된 notes 행은 항상 review_round가 0이어야 한다
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.notes_constraints_default_invariant_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'default invariant',
  'default invariant content'
);
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_invariant_id')::uuid),
  0,
  'review_round를 생략하여 생성된 notes 행은 항상 review_round가 0이어야 한다'
);

SELECT * FROM finish();
ROLLBACK;
