-- =========================================
-- notes / TRIGGER
-- =========================================

BEGIN;

SELECT plan(14);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_title_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_content_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_review_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_next_review_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_override_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_boundary_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_same_title_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_updated_only_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_invariant_change_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_invariant_same_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_invariant_other_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'user_a_' || current_setting('test.user_a_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round,
  next_review_at
)
VALUES
  (
    current_setting('test.note_title_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'title base',
    'content base',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.note_content_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'content base',
    'content before',
    0,
    now() + interval '2 days'
  ),
  (
    current_setting('test.note_review_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'review base',
    'review content',
    0,
    now() + interval '3 days'
  ),
  (
    current_setting('test.note_next_review_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'next review base',
    'next review content',
    1,
    now() + interval '4 days'
  ),
  (
    current_setting('test.note_override_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'override base',
    'override content',
    1,
    now() + interval '5 days'
  ),
  (
    current_setting('test.note_boundary_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'boundary base',
    'boundary content',
    2,
    now() + interval '6 days'
  ),
  (
    current_setting('test.note_same_title_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'same title',
    'same title content',
    0,
    now() + interval '7 days'
  ),
  (
    current_setting('test.note_updated_only_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'updated only',
    'updated only content',
    0,
    now() + interval '8 days'
  ),
  (
    current_setting('test.note_invariant_change_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'invariant change',
    'invariant change content',
    1,
    now() + interval '9 days'
  ),
  (
    current_setting('test.note_invariant_same_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'invariant same',
    'invariant same content',
    1,
    now() + interval '10 days'
  ),
  (
    current_setting('test.note_invariant_other_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'invariant other',
    'invariant other content',
    2,
    now() + interval '11 days'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- title을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.title_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_title_id')::uuid),
  true
);

UPDATE public.notes
SET title = 'title changed'
WHERE id = current_setting('test.note_title_id')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.title_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_title_id')::uuid),
  'title을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- content를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.content_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_content_id')::uuid),
  true
);

UPDATE public.notes
SET content = 'content changed'
WHERE id = current_setting('test.note_content_id')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.content_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_content_id')::uuid),
  'content를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- review_round를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.review_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_review_id')::uuid),
  true
);

UPDATE public.notes
SET review_round = 3
WHERE id = current_setting('test.note_review_id')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.review_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_review_id')::uuid),
  'review_round를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- next_review_at을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.next_review_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_next_review_id')::uuid),
  true
);

UPDATE public.notes
SET next_review_at = now() + interval '30 days'
WHERE id = current_setting('test.note_next_review_id')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.next_review_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_next_review_id')::uuid),
  'next_review_at을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- title 변경 시 updated_at을 과거 값으로 지정해도 트리거가 현재 시각으로 덮어써야 한다
SELECT set_config('test.override_t0', clock_timestamp()::text, true);

UPDATE public.notes
SET title = 'override changed',
    updated_at = now() - interval '1 day'
WHERE id = current_setting('test.note_override_id')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.override_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_override_id')::uuid),
  'updated_at을 직접 과거 값으로 지정해도 트리거가 현재 시각으로 덮어써야 한다'
);

-- [예외 조건]
-- 없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)
SELECT ok(
  true,
  '없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)'
);

-- [경계 조건]
-- INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at이 다른 값이어야 한다
SELECT set_config(
  'test.boundary_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_boundary_id')::uuid),
  true
);

UPDATE public.notes
SET title = 'boundary changed'
WHERE id = current_setting('test.note_boundary_id')::uuid;

SELECT set_config(
  'test.boundary_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_boundary_id')::uuid),
  true
);

SELECT ok(
  current_setting('test.boundary_new')::timestamptz <> current_setting('test.boundary_old')::timestamptz,
  'INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at이 다른 값이어야 한다'
);

-- 동일한 title 값으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다
SELECT set_config(
  'test.same_title_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_same_title_id')::uuid),
  true
);

UPDATE public.notes
SET title = title
WHERE id = current_setting('test.note_same_title_id')::uuid;

SELECT is(
  (SELECT updated_at FROM public.notes WHERE id = current_setting('test.note_same_title_id')::uuid),
  current_setting('test.same_title_old')::timestamptz,
  '동일한 title 값으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다'
);

-- updated_at만 단독으로 UPDATE하면 갱신되지 않고 기존 값을 유지해야 한다
SELECT set_config(
  'test.updated_only_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_updated_only_id')::uuid),
  true
);

UPDATE public.notes
SET updated_at = current_setting('test.updated_only_old')::timestamptz - interval '1 day'
WHERE id = current_setting('test.note_updated_only_id')::uuid;

SELECT is(
  (SELECT updated_at FROM public.notes WHERE id = current_setting('test.note_updated_only_id')::uuid),
  current_setting('test.updated_only_old')::timestamptz,
  'updated_at만 단독으로 UPDATE하면 갱신되지 않고 기존 값을 유지해야 한다'
);

-- [불변 조건]
-- updated_at은 created_at보다 항상 크거나 같아야 한다 (Status)
SELECT ok(
  (SELECT count(*) FROM public.notes WHERE updated_at < created_at) = 0,
  'updated_at은 created_at보다 항상 크거나 같아야 한다 (Status)'
);

-- updated_at이 NULL인 행은 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.notes WHERE updated_at IS NULL),
  0::bigint,
  'updated_at이 NULL인 행은 존재해서는 안 된다 (Status)'
);

-- 실제 변경이 발생한 UPDATE 후 new.updated_at > old.updated_at이어야 한다 (Transition)
SELECT set_config(
  'test.invariant_change_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_invariant_change_id')::uuid),
  true
);

UPDATE public.notes
SET content = 'invariant change updated'
WHERE id = current_setting('test.note_invariant_change_id')::uuid;

SELECT set_config(
  'test.invariant_change_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_invariant_change_id')::uuid),
  true
);

SELECT ok(
  current_setting('test.invariant_change_new')::timestamptz > current_setting('test.invariant_change_old')::timestamptz,
  '실제 변경이 발생한 UPDATE 후 new.updated_at > old.updated_at이어야 한다 (Transition)'
);

-- 동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)
SELECT set_config(
  'test.invariant_same_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_invariant_same_id')::uuid),
  true
);

UPDATE public.notes
SET content = content
WHERE id = current_setting('test.note_invariant_same_id')::uuid;

SELECT set_config(
  'test.invariant_same_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.note_invariant_same_id')::uuid),
  true
);

SELECT is(
  current_setting('test.invariant_same_new')::timestamptz,
  current_setting('test.invariant_same_old')::timestamptz,
  '동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)'
);

-- 특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼(created_at, user_id 등)은 이전 값과 같아야 한다 (Transition)
SELECT set_config(
  'test.invariant_other_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.invariant_other_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.invariant_other_content',
  (SELECT content FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid),
  true
);

UPDATE public.notes
SET title = 'invariant other updated'
WHERE id = current_setting('test.note_invariant_other_id')::uuid;

SELECT ok(
  (SELECT created_at = current_setting('test.invariant_other_created_at')::timestamptz
   FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid)
  AND (SELECT user_id::text = current_setting('test.invariant_other_user_id')
       FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid)
  AND (SELECT content = current_setting('test.invariant_other_content')
       FROM public.notes WHERE id = current_setting('test.note_invariant_other_id')::uuid),
  '특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼(created_at, user_id 등)은 이전 값과 같아야 한다 (Transition)'
);

SELECT * FROM finish();
ROLLBACK;
