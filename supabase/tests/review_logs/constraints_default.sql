-- =========================================
-- review_logs / CONSTRAINTS_DEFAULT
-- =========================================

BEGIN;

SELECT plan(17);

-- 테스트용 UUID 준비
SELECT set_config('test.constraints_default_id_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_default_id_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_default_id_explicit', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_default_created_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_default_created_note_a1', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.constraints_default_id_user_a')::uuid, 'test.constraints_default_id_user_a_' || current_setting('test.constraints_default_id_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_default_created_user_a')::uuid, 'test.constraints_default_created_user_a_' || current_setting('test.constraints_default_created_user_a') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 'default id note', 'content', 1),
  (current_setting('test.constraints_default_created_note_a1')::uuid, current_setting('test.constraints_default_created_user_a')::uuid, 'default created note', 'content', 1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 정책 7: DEFAULT — id 자동 생성
-- =====================================================================

-- [정답 조건]
SAVEPOINT constraints_default_id_insert_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 1, now() + interval '26 days')
  RETURNING id
)
SELECT ok(
  (SELECT id IS NOT NULL FROM inserted),
  $$id를 생략한 review_logs INSERT는 성공해야 하며 id가 자동 생성되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_insert_omit;

SAVEPOINT constraints_default_id_insert_explicit;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '27 days');
    $sql$,
    current_setting('test.constraints_default_id_explicit'),
    current_setting('test.constraints_default_id_note_a1'),
    current_setting('test.constraints_default_id_user_a')
  ),
  $$명시적으로 유효한 id를 제공한 review_logs INSERT도 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_insert_explicit;

-- [예외 조건]
SELECT ok(
  true,
  $$없음 (현재 스키마에는 id 기본값 사용 자체를 금지하거나 강제하는 추가 제약이 작성되어 있지 않다)$$
);

-- [경계 조건]
SAVEPOINT constraints_default_id_boundary_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 1, now() + interval '28 days')
  RETURNING id
)
SELECT ok(
  (SELECT id::text ~* '^[0-9a-f-]{36}$' FROM inserted),
  $$id를 생략한 INSERT는 자동 생성되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_boundary_omit;

SAVEPOINT constraints_default_id_boundary_explicit;
WITH inserted AS (
  INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_id_explicit')::uuid, current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 1, now() + interval '29 days')
  RETURNING id
)
SELECT is(
  (SELECT id FROM inserted),
  current_setting('test.constraints_default_id_explicit')::uuid,
  $$id를 명시한 INSERT는 명시값을 사용할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_boundary_explicit;

-- [불변 조건]
SAVEPOINT constraints_default_id_invariant_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 1, now() + interval '30 days')
  RETURNING id
)
SELECT ok(
  (SELECT id IS NOT NULL FROM inserted)
  AND (SELECT id::text ~* '^[0-9a-f-]{36}$' FROM inserted),
  $$id를 생략한 INSERT 후 생성된 review_logs 행의 id는 UUID 형식의 값으로 자동 채워져 있어야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_invariant_omit;

SAVEPOINT constraints_default_id_invariant_explicit;
WITH inserted AS (
  INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_id_explicit')::uuid, current_setting('test.constraints_default_id_note_a1')::uuid, current_setting('test.constraints_default_id_user_a')::uuid, 1, now() + interval '31 days')
  RETURNING id
)
SELECT is(
  (SELECT id FROM inserted),
  current_setting('test.constraints_default_id_explicit')::uuid,
  $$id를 명시한 INSERT 후 생성된 review_logs 행의 id는 명시한 값과 같아야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT constraints_default_id_invariant_explicit;

SAVEPOINT constraints_default_id_update_scope;

INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.constraints_default_id_note_a1')::uuid,
  current_setting('test.constraints_default_id_user_a')::uuid,
  1,
  now() + interval '31 days'
);

SELECT set_config(
  'test.constraints_default_id_update_inserted_id',
  (SELECT id::text FROM public.review_logs
   WHERE note_id = current_setting('test.constraints_default_id_note_a1')::uuid
   ORDER BY created_at DESC LIMIT 1),
  true
);

UPDATE public.review_logs
   SET scheduled_at = now() + interval '32 days'
 WHERE id = current_setting('test.constraints_default_id_update_inserted_id')::uuid;

SELECT is(
  (SELECT id FROM public.review_logs
   WHERE id = current_setting('test.constraints_default_id_update_inserted_id')::uuid),
  current_setting('test.constraints_default_id_update_inserted_id')::uuid,
  $$다른 컬럼 UPDATE 이후에도 자동 생성된 id는 바뀌지 않아야 한다 (Transition)$$
);

ROLLBACK TO SAVEPOINT constraints_default_id_update_scope;

-- =====================================================================
-- 정책 8: DEFAULT — created_at 자동 기록
-- =====================================================================

-- [정답 조건]
SAVEPOINT constraints_default_created_insert_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_created_note_a1')::uuid, current_setting('test.constraints_default_created_user_a')::uuid, 1, now() + interval '32 days')
  RETURNING created_at
)
SELECT ok(
  (SELECT created_at IS NOT NULL FROM inserted),
  $$created_at을 생략한 review_logs INSERT는 성공해야 하며 created_at이 자동 기록되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_insert_omit;

SAVEPOINT constraints_default_created_insert_explicit;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, created_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '33 days', now() - interval '1 day');
    $sql$,
    current_setting('test.constraints_default_created_note_a1'),
    current_setting('test.constraints_default_created_user_a')
  ),
  $$명시적으로 유효한 created_at을 제공한 review_logs INSERT도 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_insert_explicit;

-- [예외 조건]
SELECT ok(
  true,
  $$없음 (현재 스키마에는 created_at 기본값 사용 자체를 금지하거나 강제하는 추가 제약이 작성되어 있지 않다)$$
);

-- [경계 조건]
SAVEPOINT constraints_default_created_boundary_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (current_setting('test.constraints_default_created_note_a1')::uuid, current_setting('test.constraints_default_created_user_a')::uuid, 1, now() + interval '34 days')
  RETURNING created_at
)
SELECT ok(
  (SELECT created_at IS NOT NULL FROM inserted),
  $$created_at을 생략한 INSERT는 자동 기록되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_boundary_omit;

SAVEPOINT constraints_default_created_boundary_explicit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at, created_at)
  VALUES (
    current_setting('test.constraints_default_created_note_a1')::uuid,
    current_setting('test.constraints_default_created_user_a')::uuid,
    1,
    now() + interval '35 days',
    TIMESTAMPTZ '2026-03-21 00:00:00+00'
  )
  RETURNING created_at
)
SELECT is(
  (SELECT created_at FROM inserted),
  TIMESTAMPTZ '2026-03-21 00:00:00+00',
  $$created_at을 명시하면 해당 값이 그대로 저장되어야 한다 (Boundary)$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_boundary_explicit;

SAVEPOINT constraints_default_created_boundary_future;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at, created_at)
  VALUES (
    current_setting('test.constraints_default_created_note_a1')::uuid,
    current_setting('test.constraints_default_created_user_a')::uuid,
    1,
    now() + interval '35 days',
    TIMESTAMPTZ '2026-03-30 00:00:00+00'
  )
  RETURNING created_at
)
SELECT is(
  (SELECT created_at FROM inserted),
  TIMESTAMPTZ '2026-03-30 00:00:00+00',
  $$미래 시각을 명시한 INSERT도 해당 값이 그대로 저장되어야 한다 (Boundary)$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_boundary_future;

-- [불변 조건]
SAVEPOINT constraints_default_created_invariant_omit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (
    current_setting('test.constraints_default_created_note_a1')::uuid,
    current_setting('test.constraints_default_created_user_a')::uuid,
    1,
    now() + interval '36 days'
  )
  RETURNING created_at
)
SELECT is(
  (SELECT created_at FROM inserted),
  transaction_timestamp()::timestamptz,
  $$created_at을 생략한 INSERT 후 생성된 review_logs 행의 created_at은 현재 트랜잭션 시각과 같아야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_invariant_omit;

SAVEPOINT constraints_default_created_invariant_explicit;
WITH inserted AS (
  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at, created_at)
  VALUES (
    current_setting('test.constraints_default_created_note_a1')::uuid,
    current_setting('test.constraints_default_created_user_a')::uuid,
    1,
    now() + interval '36 days',
    TIMESTAMPTZ '2026-03-20 00:00:00+00'
  )
  RETURNING created_at
)
SELECT is(
  (SELECT created_at FROM inserted),
  TIMESTAMPTZ '2026-03-20 00:00:00+00',
  $$created_at을 명시한 경우 항상 해당 값이 그대로 저장되어야 한다 (Invariant)$$
);
ROLLBACK TO SAVEPOINT constraints_default_created_invariant_explicit;

SAVEPOINT constraints_default_created_update_scope;

INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.constraints_default_created_note_a1')::uuid,
  current_setting('test.constraints_default_created_user_a')::uuid,
  1,
  now() + interval '37 days'
);

SELECT set_config(
  'test.constraints_default_created_update_inserted_id',
  (SELECT id::text FROM public.review_logs
   WHERE note_id = current_setting('test.constraints_default_created_note_a1')::uuid
   ORDER BY created_at DESC LIMIT 1),
  true
);

SELECT set_config(
  'test.constraints_default_created_update_inserted_created_at',
  (SELECT created_at::text FROM public.review_logs
   WHERE id = current_setting('test.constraints_default_created_update_inserted_id')::uuid),
  true
);

UPDATE public.review_logs
   SET scheduled_at = now() + interval '38 days'
 WHERE id = current_setting('test.constraints_default_created_update_inserted_id')::uuid;

SELECT is(
  (SELECT created_at FROM public.review_logs
   WHERE id = current_setting('test.constraints_default_created_update_inserted_id')::uuid),
  current_setting('test.constraints_default_created_update_inserted_created_at')::timestamptz,
  $$다른 컬럼 UPDATE 이후에도 자동 기록된 created_at은 바뀌지 않아야 한다 (Transition)$$
);

ROLLBACK TO SAVEPOINT constraints_default_created_update_scope;

SELECT * FROM finish();
ROLLBACK;
