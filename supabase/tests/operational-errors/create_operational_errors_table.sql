-- =========================================
-- operational_errors / table schema
-- =========================================

BEGIN;

SELECT plan(24);

SELECT set_config(
  'test.operational_error_open_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.operational_error_resolved_id',
  gen_random_uuid()::text,
  true
);

-- 테이블과 기본 키가 생성되어야 함.
SELECT ok(
  to_regclass('public.operational_errors') IS NOT NULL,
  $$operational_errors table should exist$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.operational_errors'::regclass
      AND contype = 'p'
      AND conname = 'operational_errors_pkey'
  ),
  $$operational_errors should have a primary key$$
);

-- 필수 값만 입력해도 기본값과 함께 저장되어야 함.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.operational_errors (
        id,
        feature,
        operation,
        stage,
        error_code,
        severity,
        message,
        fingerprint,
        updated_at
      )
      VALUES (
        '%s'::uuid,
        'FEEDBACK',
        'CREATE_REPLY',
        'DATABASE_INSERT',
        'FEEDBACK_REPLY_INSERT_FAILED',
        'ERROR',
        'Failed to create a feedback reply.',
        'feedback:create-reply:database-insert',
        TIMESTAMPTZ '2026-01-01 00:00:00+00'
      );
    $sql$,
    current_setting('test.operational_error_open_id')
  ),
  $$operational_errors should accept valid required values$$
);

SELECT ok(
  (
    SELECT
      status = 'OPEN'
      AND occurrence_count = 1
      AND context = '{}'::jsonb
      AND first_seen_at IS NOT NULL
      AND last_seen_at IS NOT NULL
      AND created_at IS NOT NULL
      AND updated_at = TIMESTAMPTZ '2026-01-01 00:00:00+00'
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_open_id')::uuid
  ),
  $$operational_errors should apply its default values$$
);

-- message는 공백이 아닌 문자열이어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      message,
      fingerprint
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'EMPTY_MESSAGE',
      'ERROR',
      '   ',
      'invalid:empty-message'
    );
  $sql$,
  '23514',
  NULL,
  $$operational_errors should reject blank messages$$
);

-- occurrence_count는 1 이상이어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      message,
      fingerprint,
      occurrence_count
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'INVALID_OCCURRENCE_COUNT',
      'ERROR',
      'Invalid occurrence count.',
      'invalid:occurrence-count',
      0
    );
  $sql$,
  '23514',
  NULL,
  $$operational_errors should reject non-positive occurrence counts$$
);

-- severity는 INFO, WARN, ERROR만 허용되어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      message,
      fingerprint
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'INVALID_SEVERITY',
      'CRITICAL',
      'Invalid severity.',
      'invalid:severity'
    );
  $sql$,
  '23514',
  NULL,
  $$operational_errors should reject unsupported severity values$$
);

-- status는 OPEN, RESOLVED, IGNORED만 허용되어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      status,
      message,
      fingerprint
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'INVALID_STATUS',
      'ERROR',
      'PROCESSING',
      'Invalid status.',
      'invalid:status'
    );
  $sql$,
  '23514',
  NULL,
  $$operational_errors should reject unsupported status values$$
);

-- context에는 JSON 객체만 저장할 수 있어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      message,
      fingerprint,
      context
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'INVALID_CONTEXT',
      'ERROR',
      'Invalid context.',
      'invalid:context',
      '[]'::jsonb
    );
  $sql$,
  '23514',
  NULL,
  $$operational_errors should reject non-object context values$$
);

-- OPEN 상태에서는 같은 fingerprint가 중복될 수 없어야 함.
SELECT throws_ok(
  $sql$
    INSERT INTO public.operational_errors (
      feature,
      operation,
      stage,
      error_code,
      severity,
      message,
      fingerprint
    )
    VALUES (
      'FEEDBACK',
      'CREATE_REPLY',
      'DATABASE_INSERT',
      'FEEDBACK_REPLY_INSERT_FAILED',
      'ERROR',
      'The same open error occurred again.',
      'feedback:create-reply:database-insert'
    );
  $sql$,
  '23505',
  NULL,
  $$operational_errors should reject duplicate fingerprints for OPEN errors$$
);

-- OPEN이 아닌 오류에는 동일한 fingerprint를 사용할 수 있어야 함.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.operational_errors (
        id,
        feature,
        operation,
        stage,
        error_code,
        severity,
        status,
        message,
        fingerprint
      )
      VALUES (
        '%s'::uuid,
        'FEEDBACK',
        'CREATE_REPLY',
        'DATABASE_INSERT',
        'FEEDBACK_REPLY_INSERT_FAILED',
        'ERROR',
        'RESOLVED',
        'A resolved occurrence of the same error.',
        'feedback:create-reply:database-insert'
      );
    $sql$,
    current_setting('test.operational_error_resolved_id')
  ),
  $$operational_errors should allow duplicate fingerprints for non-OPEN errors$$
);

-- updated_at은 UPDATE 시 트리거에 의해 갱신되어야 함.
UPDATE public.operational_errors
SET message = 'Updated error message.'
WHERE id = current_setting('test.operational_error_open_id')::uuid;

SELECT ok(
  (
    SELECT updated_at > TIMESTAMPTZ '2026-01-01 00:00:00+00'
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_open_id')::uuid
  ),
  $$updating an operational error should refresh updated_at$$
);

-- 운영 오류 집계 함수는 발생 횟수를 원자적으로 증가시키고 심각도를 낮추지 않아야 함.
SELECT is(
  public.increment_operational_error_occurrence(
    current_setting('test.operational_error_open_id')::uuid,
    'Aggregated warning message.'::text,
    '{"retry": 1}'::jsonb,
    'WARN'::character varying,
    NULL::uuid,
    NULL::uuid
  ),
  current_setting('test.operational_error_open_id')::uuid,
  $$increment_operational_error_occurrence should return the updated id$$
);

SELECT ok(
  (
    SELECT
      occurrence_count = 2
      AND message = 'Aggregated warning message.'
      AND context = '{"retry": 1}'::jsonb
      AND severity = 'ERROR'
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_open_id')::uuid
  ),
  $$increment_operational_error_occurrence should update occurrence data without lowering severity$$
);

-- 주요 인덱스가 존재해야 함.
SELECT ok(
  to_regclass(
    'public.operational_errors_status_last_seen_at_idx'
  ) IS NOT NULL,
  $$operational_errors should have a status and last_seen_at index$$
);

SELECT ok(
  to_regclass(
    'public.operational_errors_feature_operation_stage_idx'
  ) IS NOT NULL,
  $$operational_errors should have a feature operation and stage index$$
);

SELECT ok(
  to_regclass(
    'public.operational_errors_error_code_idx'
  ) IS NOT NULL,
  $$operational_errors should have an error_code index$$
);

SELECT ok(
  to_regclass(
    'public.operational_errors_open_fingerprint_key'
  ) IS NOT NULL,
  $$operational_errors should have an OPEN fingerprint unique index$$
);

-- RLS는 활성화되고 클라이언트 정책은 없어야 함.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.operational_errors'::regclass
  ),
  $$operational_errors should have row level security enabled$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'operational_errors'
  ),
  0::bigint,
  $$operational_errors should not expose authenticated RLS policies$$
);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.operational_errors',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$anon should not have direct privileges on operational_errors$$
);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.operational_errors',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$authenticated should not have direct privileges on operational_errors$$
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.increment_operational_error_occurrence(uuid,text,jsonb,character varying,uuid,uuid)',
    'EXECUTE'
  ),
  $$anon should not execute increment_operational_error_occurrence$$
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.increment_operational_error_occurrence(uuid,text,jsonb,character varying,uuid,uuid)',
    'EXECUTE'
  ),
  $$authenticated should not execute increment_operational_error_occurrence$$
);

SELECT * FROM finish();
ROLLBACK;
