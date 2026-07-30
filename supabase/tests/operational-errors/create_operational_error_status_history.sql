-- =========================================
-- operational_error_status_history / table schema
-- =========================================

BEGIN;

SELECT plan(16);

SELECT set_config(
  'test.operational_error_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.operational_error_history_id',
  gen_random_uuid()::text,
  true
);

-- 상태 이력 테스트에 사용할 운영 오류를 생성한다.
INSERT INTO public.operational_errors (
  id,
  feature,
  operation,
  stage,
  error_code,
  severity,
  message,
  fingerprint
)
VALUES (
  current_setting('test.operational_error_id')::uuid,
  'FEEDBACK',
  'CREATE_REPLY',
  'DATABASE_INSERT',
  'FEEDBACK_REPLY_INSERT_FAILED',
  'ERROR',
  'Failed to create a feedback reply.',
  'history-test:feedback:create-reply'
);

-- 테이블과 기본 키가 생성되어야 한다.
SELECT ok(
  to_regclass(
    'public.operational_error_status_history'
  ) IS NOT NULL,
  $$operational_error_status_history table should exist$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'public.operational_error_status_history'::regclass
      AND contype = 'p'
      AND conname =
        'operational_error_status_history_pkey'
  ),
  $$operational_error_status_history should have a primary key$$
);

-- 최초 상태 기록에서는 from_status가 NULL일 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.operational_error_status_history (
        id,
        operational_error_id,
        from_status,
        to_status,
        note
      )
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        NULL,
        'OPEN',
        'Operational error was created.'
      );
    $sql$,
    current_setting('test.operational_error_history_id'),
    current_setting('test.operational_error_id')
  ),
  $$status history should allow a NULL from_status$$
);

SELECT ok(
  (
    SELECT
      operational_error_id =
        current_setting('test.operational_error_id')::uuid
      AND from_status IS NULL
      AND to_status = 'OPEN'
      AND note = 'Operational error was created.'
      AND changed_by IS NULL
      AND created_at IS NOT NULL
    FROM public.operational_error_status_history
    WHERE id =
      current_setting('test.operational_error_history_id')::uuid
  ),
  $$status history should store valid values and defaults$$
);

-- from_status는 NULL 또는 지원되는 상태만 허용되어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.operational_error_status_history (
        operational_error_id,
        from_status,
        to_status
      )
      VALUES (
        '%s'::uuid,
        'PROCESSING',
        'RESOLVED'
      );
    $sql$,
    current_setting('test.operational_error_id')
  ),
  '23514',
  NULL,
  $$status history should reject unsupported from_status values$$
);

-- to_status는 지원되는 상태만 허용되어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.operational_error_status_history (
        operational_error_id,
        from_status,
        to_status
      )
      VALUES (
        '%s'::uuid,
        'OPEN',
        'PROCESSING'
      );
    $sql$,
    current_setting('test.operational_error_id')
  ),
  '23514',
  NULL,
  $$status history should reject unsupported to_status values$$
);

-- 존재하지 않는 운영 오류의 이력은 저장할 수 없어야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_error_status_history (
      operational_error_id,
      from_status,
      to_status
    )
    VALUES (
      'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
      'OPEN',
      'RESOLVED'
    );
  $sql$,
  '23503',
  NULL,
  $$status history should reject unknown operational error ids$$
);

-- changed_by에는 존재하는 auth.users 사용자만 지정할 수 있어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.operational_error_status_history (
        operational_error_id,
        from_status,
        to_status,
        changed_by
      )
      VALUES (
        '%s'::uuid,
        'OPEN',
        'RESOLVED',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid
      );
    $sql$,
    current_setting('test.operational_error_id')
  ),
  '23503',
  NULL,
  $$status history should reject unknown changed_by user ids$$
);

-- 운영 오류 FK는 ON DELETE CASCADE로 설정되어야 한다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'public.operational_error_status_history'::regclass
      AND conname =
        'operational_error_status_history_error_id_fkey'
      AND contype = 'f'
      AND confdeltype = 'c'
  ),
  $$operational error foreign key should use ON DELETE CASCADE$$
);

-- changed_by FK는 사용자 삭제 시 NULL로 변경되어야 한다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'public.operational_error_status_history'::regclass
      AND conname =
        'operational_error_status_history_changed_by_fkey'
      AND contype = 'f'
      AND confdeltype = 'n'
  ),
  $$changed_by foreign key should use ON DELETE SET NULL$$
);

-- 운영 오류가 삭제되면 관련 상태 이력도 삭제되어야 한다.
DELETE FROM public.operational_errors
WHERE id = current_setting('test.operational_error_id')::uuid;

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.operational_error_status_history
    WHERE operational_error_id =
      current_setting('test.operational_error_id')::uuid
  ),
  0::bigint,
  $$deleting an operational error should cascade to its status history$$
);

-- 운영 오류별 최신 이력을 조회하기 위한 인덱스가 존재해야 한다.
SELECT ok(
  to_regclass(
    'public.operational_error_status_history_error_created_at_idx'
  ) IS NOT NULL,
  $$status history should have an operational error and created_at index$$
);

-- RLS는 활성화되고 클라이언트 정책은 없어야 한다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid =
      'public.operational_error_status_history'::regclass
  ),
  $$operational_error_status_history should have row level security enabled$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'operational_error_status_history'
  ),
  0::bigint,
  $$operational_error_status_history should not expose authenticated RLS policies$$
);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.operational_error_status_history',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$anon should not have direct privileges on operational_error_status_history$$
);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.operational_error_status_history',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$authenticated should not have direct privileges on operational_error_status_history$$
);

SELECT * FROM finish();

ROLLBACK;
