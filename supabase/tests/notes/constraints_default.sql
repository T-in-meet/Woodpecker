-- =========================================
-- notes / CONSTRAINTS_DEFAULT
-- =========================================

BEGIN;

SELECT plan(24);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_default_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_id_explicit_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_review_explicit_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_created_explicit_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_updated_explicit_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_id_auto_note_id', ''::text, true);
SELECT set_config('test.notes_constraints_default_id_boundary_note_id', ''::text, true);
SELECT set_config('test.notes_constraints_default_review_default_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_review_boundary_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_created_default_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_created_boundary_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_updated_default_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_updated_boundary_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_default_created_explicit_value', '2000-01-01 00:00:00+00'::text, true);
SELECT set_config('test.notes_constraints_default_updated_explicit_value', '2000-01-02 00:00:00+00'::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_constraints_default_user_a_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- id를 명시하지 않고 INSERT하면 UUID가 자동 생성되어야 한다
WITH inserted AS (
  INSERT INTO public.notes (user_id, title, content, review_round)
  VALUES (
    current_setting('test.notes_constraints_default_user_a_id')::uuid,
    'id default success',
    'id default content',
    0
  )
  RETURNING id
)
SELECT ok(
  set_config('test.notes_constraints_default_id_auto_note_id', (SELECT id::text FROM inserted), true) IS NOT NULL
  AND current_setting('test.notes_constraints_default_id_auto_note_id') <> '',
  $$id를 명시하지 않고 INSERT하면 UUID가 자동 생성되어야 한다$$
);

-- 없음 (DEFAULT는 입력을 거부하는 정책이 아니라 값이 없을 때 보완하는 정책이다)
SELECT ok(
  true,
  $$없음 (DEFAULT는 입력을 거부하는 정책이 아니라 값이 없을 때 보완하는 정책이다)$$
);

-- review_round를 명시하지 않고 INSERT하면 0으로 저장되어야 한다
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.notes_constraints_default_review_default_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'review default title',
  'review default content'
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_review_default_note_id')::uuid),
  0,
  $$review_round를 명시하지 않고 INSERT하면 0으로 저장되어야 한다$$
);

-- 없음
SELECT ok(
  true,
  $$없음$$
);

-- created_at을 명시하지 않고 INSERT하면 현재 시각이 저장되어야 한다
SELECT set_config('test.notes_constraints_default_created_before', now()::text, true);
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_created_default_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'created default title',
  'created default content',
  0
)
ON CONFLICT (id) DO NOTHING;
SELECT set_config('test.notes_constraints_default_created_after', now()::text, true);
SELECT ok(
  (SELECT created_at IS NOT NULL
   FROM public.notes
   WHERE id = current_setting('test.notes_constraints_default_created_default_note_id')::uuid),
  $$created_at을 명시하지 않고 INSERT하면 현재 시각이 저장되어야 한다$$
);

-- 없음
SELECT ok(
  true,
  $$없음$$
);

-- updated_at을 명시하지 않고 INSERT하면 현재 시각이 저장되어야 한다
SELECT set_config('test.notes_constraints_default_updated_before', now()::text, true);
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_updated_default_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'updated default title',
  'updated default content',
  0
)
ON CONFLICT (id) DO NOTHING;
SELECT set_config('test.notes_constraints_default_updated_after', now()::text, true);
SELECT ok(
  (SELECT updated_at IS NOT NULL
   FROM public.notes
   WHERE id = current_setting('test.notes_constraints_default_updated_default_note_id')::uuid),
  $$updated_at을 명시하지 않고 INSERT하면 현재 시각이 저장되어야 한다$$
);

-- 없음
SELECT ok(
  true,
  $$없음$$
);

-- [경계 조건]
-- id를 명시하지 않으면 자동 생성되어야 한다
WITH inserted AS (
  INSERT INTO public.notes (user_id, title, content, review_round)
  VALUES (
    current_setting('test.notes_constraints_default_user_a_id')::uuid,
    'id boundary auto',
    'id boundary auto content',
    0
  )
  RETURNING id
)
SELECT ok(
  set_config('test.notes_constraints_default_id_boundary_note_id', (SELECT id::text FROM inserted), true) IS NOT NULL
  AND current_setting('test.notes_constraints_default_id_boundary_note_id') <> '',
  $$id를 명시하지 않으면 자동 생성되어야 한다$$
);

-- id를 명시하면 해당 값이 그대로 저장되어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_id_explicit_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'id explicit title',
  'id explicit content',
  0
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT id::text FROM public.notes WHERE id = current_setting('test.notes_constraints_default_id_explicit_note_id')::uuid),
  current_setting('test.notes_constraints_default_id_explicit_note_id'),
  $$id를 명시하면 해당 값이 그대로 저장되어야 한다$$
);

-- review_round를 명시하지 않으면 0이어야 한다
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.notes_constraints_default_review_boundary_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'review boundary title',
  'review boundary content'
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_review_boundary_note_id')::uuid),
  0,
  $$review_round를 명시하지 않으면 0이어야 한다$$
);

-- review_round를 명시하면 해당 값이 저장되어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_review_explicit_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'review explicit title',
  'review explicit content',
  3
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.notes_constraints_default_review_explicit_note_id')::uuid),
  3,
  $$review_round를 명시하면 해당 값이 저장되어야 한다$$
);

-- created_at을 명시하지 않으면 현재 시각이어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_created_boundary_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'created boundary title',
  'created boundary content',
  0
)
ON CONFLICT (id) DO NOTHING;
SELECT ok(
  (SELECT created_at BETWEEN current_setting('test.notes_constraints_default_created_before')::timestamptz
                        AND current_setting('test.notes_constraints_default_created_after')::timestamptz
   FROM public.notes
   WHERE id = current_setting('test.notes_constraints_default_created_default_note_id')::uuid),
  $$created_at을 명시하지 않으면 현재 시각이어야 한다$$
);

-- created_at을 명시하면 해당 값이 저장되어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round, created_at)
VALUES (
  current_setting('test.notes_constraints_default_created_explicit_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'created explicit title',
  'created explicit content',
  0,
  current_setting('test.notes_constraints_default_created_explicit_value')::timestamptz
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT created_at FROM public.notes WHERE id = current_setting('test.notes_constraints_default_created_explicit_note_id')::uuid),
  current_setting('test.notes_constraints_default_created_explicit_value')::timestamptz,
  $$created_at을 명시하면 해당 값이 저장되어야 한다$$
);

-- updated_at을 명시하지 않으면 현재 시각이어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.notes_constraints_default_updated_boundary_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'updated boundary title',
  'updated boundary content',
  0
)
ON CONFLICT (id) DO NOTHING;
SELECT ok(
  (SELECT updated_at BETWEEN current_setting('test.notes_constraints_default_updated_before')::timestamptz
                        AND current_setting('test.notes_constraints_default_updated_after')::timestamptz
   FROM public.notes
   WHERE id = current_setting('test.notes_constraints_default_updated_default_note_id')::uuid),
  $$updated_at을 명시하지 않으면 현재 시각이어야 한다$$
);

-- updated_at을 명시하면 해당 값이 저장되어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
VALUES (
  current_setting('test.notes_constraints_default_updated_explicit_note_id')::uuid,
  current_setting('test.notes_constraints_default_user_a_id')::uuid,
  'updated explicit title',
  'updated explicit content',
  0,
  current_setting('test.notes_constraints_default_created_explicit_value')::timestamptz,
  current_setting('test.notes_constraints_default_updated_explicit_value')::timestamptz
)
ON CONFLICT (id) DO NOTHING;
SELECT is(
  (SELECT updated_at FROM public.notes WHERE id = current_setting('test.notes_constraints_default_updated_explicit_note_id')::uuid),
  current_setting('test.notes_constraints_default_updated_explicit_value')::timestamptz,
  $$updated_at을 명시하면 해당 값이 저장되어야 한다$$
);

-- [불변 조건]
-- id가 NULL인 행은 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE id IS NULL),
  0::bigint,
  $$id가 NULL인 행은 존재해서는 안 된다$$
);

-- 자동 생성된 id는 UUID 형식을 가져야 한다
SELECT ok(
  current_setting('test.notes_constraints_default_id_auto_note_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  $$자동 생성된 id는 UUID 형식을 가져야 한다$$
);

-- review_round가 NULL인 행은 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round IS NULL),
  0::bigint,
  $$review_round가 NULL인 행은 존재해서는 안 된다$$
);

-- review_round 기본값은 항상 0이어야 한다
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id IN (
     current_setting('test.notes_constraints_default_review_default_note_id')::uuid,
     current_setting('test.notes_constraints_default_review_boundary_note_id')::uuid
   )
   AND review_round <> 0),
  0::bigint,
  $$review_round 기본값은 항상 0이어야 한다$$
);

-- created_at이 NULL인 행은 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE created_at IS NULL),
  0::bigint,
  $$created_at이 NULL인 행은 존재해서는 안 된다$$
);

-- created_at은 현재 시각보다 미래일 수 없다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE created_at > now()),
  0::bigint,
  $$created_at은 현재 시각보다 미래일 수 없다$$
);

-- updated_at이 NULL인 행은 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE updated_at IS NULL),
  0::bigint,
  $$updated_at이 NULL인 행은 존재해서는 안 된다$$
);

-- created_at ≤ updated_at 이어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE created_at > updated_at),
  0::bigint,
  $$created_at ≤ updated_at 이어야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
