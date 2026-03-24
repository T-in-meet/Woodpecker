-- =========================================
-- notes / TRIGGER
-- =========================================

-- [전제 조건]
-- tr_notes_updated_at 트리거가 notes 테이블 BEFORE UPDATE 시
-- "실제 컬럼 변경 시에만 updated_at 갱신" 정책을 보장하도록 설정되어 있어야 한다.\\

BEGIN;

SELECT plan(18);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_trigger_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_title_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_content_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_review_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_next_review_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_next_review_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_override_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_boundary_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_same_title_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_updated_only_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_invariant_change_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_invariant_same_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_trigger_invariant_other_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_trigger_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_trigger_user_a_id') || '@example.com',
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
    current_setting('test.notes_trigger_title_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'title base',
    'content base',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.notes_trigger_content_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'content base',
    'content before',
    0,
    now() + interval '2 days'
  ),
  (
    current_setting('test.notes_trigger_review_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'review base',
    'review content',
    0,
    now() + interval '3 days'
  ),
  (
    current_setting('test.notes_trigger_next_review_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'next review base',
    'next review content',
    1,
    now() + interval '4 days'
  ),
  (
    current_setting('test.notes_trigger_next_review_null_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'next review null base',
    'next review null content',
    1,
    NULL
  ),
  (
    current_setting('test.notes_trigger_override_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'override base',
    'override content',
    1,
    now() + interval '5 days'
  ),
  (
    current_setting('test.notes_trigger_boundary_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'boundary base',
    'boundary content',
    2,
    now() + interval '6 days'
  ),
  (
    current_setting('test.notes_trigger_same_title_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'same title',
    'same title content',
    0,
    now() + interval '7 days'
  ),
  (
    current_setting('test.notes_trigger_updated_only_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'updated only',
    'updated only content',
    0,
    now() + interval '8 days'
  ),
  (
    current_setting('test.notes_trigger_invariant_change_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'invariant change',
    'invariant change content',
    1,
    now() + interval '9 days'
  ),
  (
    current_setting('test.notes_trigger_invariant_same_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'invariant same',
    'invariant same content',
    1,
    now() + interval '10 days'
  ),
  (
    current_setting('test.notes_trigger_invariant_other_id')::uuid,
    current_setting('test.notes_trigger_user_a_id')::uuid,
    'invariant other',
    'invariant other content',
    2,
    now() + interval '11 days'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- title을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_title_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_title_id')::uuid),
  true
);
UPDATE public.notes
SET title = 'title changed'
WHERE id = current_setting('test.notes_trigger_title_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_title_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_title_id')::uuid),
  'title을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- content를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_content_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_content_id')::uuid),
  true
);
UPDATE public.notes
SET content = 'content changed'
WHERE id = current_setting('test.notes_trigger_content_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_content_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_content_id')::uuid),
  'content를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- review_round를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_review_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_review_id')::uuid),
  true
);
UPDATE public.notes
SET review_round = 3
WHERE id = current_setting('test.notes_trigger_review_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_review_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_review_id')::uuid),
  'review_round를 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- next_review_at을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_next_review_t0',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid),
  true
);
UPDATE public.notes
SET next_review_at = now() + interval '30 days'
WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_next_review_t0')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid),
  $$next_review_at을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다$$
);

-- updated_at을 직접 과거 값으로 지정해도, 다른 컬럼의 실제 변경이 함께 발생한 경우 updated_at은 갱신 시점의 값으로 덮어써져야 한다
SELECT set_config(
  'test.notes_trigger_override_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_override_id')::uuid),
  true
);
UPDATE public.notes
SET title = 'override changed',
    updated_at = now() - interval '1 day'
WHERE id = current_setting('test.notes_trigger_override_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_override_old')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_override_id')::uuid),
  $$updated_at을 직접 과거 값으로 지정해도, 다른 컬럼의 실제 변경이 함께 발생한 경우 updated_at은 갱신 시점의 값으로 덮어써져야 한다$$
);

-- [예외 조건]
-- 없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)
SELECT ok(
  true,
  '없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)'
);

-- [경계 조건]
-- INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at이 다른 값이어야 한다
-- Snapshot
SELECT set_config(
  'test.notes_trigger_boundary_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_boundary_id')::uuid),
  true
);
-- Action
UPDATE public.notes
SET title = 'boundary changed'
WHERE id = current_setting('test.notes_trigger_boundary_id')::uuid;
SELECT set_config(
  'test.notes_trigger_boundary_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_boundary_id')::uuid),
  true
);
-- Assert
SELECT ok(
  current_setting('test.notes_trigger_boundary_new')::timestamptz <> current_setting('test.notes_trigger_boundary_old')::timestamptz,
  $$INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at이 서로 달라야 한다$$
);

-- 동일한 title 값으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다
SELECT set_config(
  'test.notes_trigger_same_title_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_same_title_id')::uuid),
  true
);
UPDATE public.notes
SET title = title
WHERE id = current_setting('test.notes_trigger_same_title_id')::uuid;
SELECT is(
  (SELECT updated_at FROM public.notes WHERE id = current_setting('test.notes_trigger_same_title_id')::uuid),
  current_setting('test.notes_trigger_same_title_old')::timestamptz,
  $$동일한 title 값으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다$$
);

-- updated_at만 단독으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다
SELECT set_config(
  'test.notes_trigger_updated_only_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_updated_only_id')::uuid),
  true
);
UPDATE public.notes
SET updated_at = current_setting('test.notes_trigger_updated_only_old')::timestamptz - interval '1 day'
WHERE id = current_setting('test.notes_trigger_updated_only_id')::uuid;
SELECT is(
  (SELECT updated_at FROM public.notes WHERE id = current_setting('test.notes_trigger_updated_only_id')::uuid),
  current_setting('test.notes_trigger_updated_only_old')::timestamptz,
  $$updated_at만 단독으로 UPDATE하면 new.updated_at = old.updated_at이어야 한다$$
);

-- NULL이던 next_review_at을 비NULL 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_next_review_null_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_null_id')::uuid),
  true
);
UPDATE public.notes
SET next_review_at = now() + interval '40 days'
WHERE id = current_setting('test.notes_trigger_next_review_null_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_next_review_null_old')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_null_id')::uuid),
  $$NULL이던 next_review_at을 비NULL 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다$$
);

-- 비NULL이던 next_review_at을 다시 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.notes_trigger_next_review_nonnull_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid),
  true
);
UPDATE public.notes
SET next_review_at = now() + interval '60 days'
WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid;
SELECT ok(
  (SELECT updated_at > current_setting('test.notes_trigger_next_review_nonnull_old')::timestamptz
   FROM public.notes WHERE id = current_setting('test.notes_trigger_next_review_id')::uuid),
  $$비NULL이던 next_review_at을 다시 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다$$
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
-- Snapshot
SELECT set_config(
  'test.notes_trigger_invariant_change_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_change_id')::uuid),
  true
);
-- Action
UPDATE public.notes
SET content = 'invariant change updated'
WHERE id = current_setting('test.notes_trigger_invariant_change_id')::uuid;
SELECT set_config(
  'test.notes_trigger_invariant_change_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_change_id')::uuid),
  true
);
-- Assert
SELECT ok(
  current_setting('test.notes_trigger_invariant_change_new')::timestamptz > current_setting('test.notes_trigger_invariant_change_old')::timestamptz,
  '실제 변경이 발생한 UPDATE 후 new.updated_at > old.updated_at이어야 한다 (Transition)'
);

-- 동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)
-- Snapshot
SELECT set_config(
  'test.notes_trigger_invariant_same_old',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_same_id')::uuid),
  true
);
-- Action
UPDATE public.notes
SET content = content
WHERE id = current_setting('test.notes_trigger_invariant_same_id')::uuid;
SELECT set_config(
  'test.notes_trigger_invariant_same_new',
  (SELECT updated_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_same_id')::uuid),
  true
);
-- Assert
SELECT is(
  current_setting('test.notes_trigger_invariant_same_new')::timestamptz,
  current_setting('test.notes_trigger_invariant_same_old')::timestamptz,
  '동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)'
);

-- 특정 컬럼만 변경한 UPDATE 후 created_at은 이전 값과 같아야 한다 (Transition)
-- Snapshot
SELECT set_config(
  'test.notes_trigger_invariant_other_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_trigger_invariant_other_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_trigger_invariant_other_content',
  (SELECT content FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  true
);
-- Action
UPDATE public.notes
SET title = 'invariant other updated'
WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid;
-- Assert
SELECT is(
  (SELECT created_at FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  current_setting('test.notes_trigger_invariant_other_created_at')::timestamptz,
  $$특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼(id, user_id, created_at 등)은 이전 값과 같아야 한다 (Transition)$$
);

-- 특정 컬럼만 변경한 UPDATE 후 user_id는 이전 값과 같아야 한다 (Transition)
SELECT is(
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  current_setting('test.notes_trigger_invariant_other_user_id'),
  $$특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼(id, user_id, created_at 등)은 이전 값과 같아야 한다 (Transition)$$
);

-- 특정 컬럼만 변경한 UPDATE 후 content는 이전 값과 같아야 한다 (Transition)
SELECT is(
  (SELECT content FROM public.notes WHERE id = current_setting('test.notes_trigger_invariant_other_id')::uuid),
  current_setting('test.notes_trigger_invariant_other_content'),
  $$특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼(id, user_id, created_at 등)은 이전 값과 같아야 한다 (Transition)$$
);

SELECT * FROM finish();
ROLLBACK;
