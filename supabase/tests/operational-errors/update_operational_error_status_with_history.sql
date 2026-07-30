-- =========================================
-- operational_errors / update status RPC
-- =========================================

BEGIN;

SELECT plan(10);

SELECT set_config('test.operational_error_rpc_admin_id', gen_random_uuid()::text, true);
SELECT set_config('test.operational_error_rpc_open_id', gen_random_uuid()::text, true);
SELECT set_config('test.operational_error_rpc_resolved_id', gen_random_uuid()::text, true);
SELECT set_config('test.operational_error_rpc_duplicate_open_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  current_setting('test.operational_error_rpc_admin_id')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin_' || current_setting('test.operational_error_rpc_admin_id') || '@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

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
VALUES
  (
    current_setting('test.operational_error_rpc_open_id')::uuid,
    'notifications',
    'dispatch_push',
    'push_send',
    'PUSH_SEND_FAILED',
    'ERROR',
    'OPEN',
    'Push failed.',
    'rpc:open'
  ),
  (
    current_setting('test.operational_error_rpc_resolved_id')::uuid,
    'notifications',
    'dispatch_push',
    'push_send',
    'PUSH_SEND_FAILED',
    'ERROR',
    'RESOLVED',
    'Push failed before.',
    'rpc:duplicate'
  ),
  (
    current_setting('test.operational_error_rpc_duplicate_open_id')::uuid,
    'notifications',
    'dispatch_push',
    'push_send',
    'PUSH_SEND_FAILED',
    'ERROR',
    'OPEN',
    'Push failed again.',
    'rpc:duplicate'
  );

SELECT ok(
  to_regprocedure(
    'public.update_operational_error_status_with_history(uuid,character varying,text,uuid)'
  ) IS NOT NULL,
  $$update_operational_error_status_with_history should exist$$
);

SELECT is(
  public.update_operational_error_status_with_history(
    current_setting('test.operational_error_rpc_open_id')::uuid,
    'RESOLVED'::character varying,
    ' 정상화 확인 '::text,
    current_setting('test.operational_error_rpc_admin_id')::uuid
  ),
  'OK',
  $$status RPC should return OK for a valid change$$
);

SELECT ok(
  (
    SELECT
      status = 'RESOLVED'
      AND resolution_note = '정상화 확인'
      AND resolved_by = current_setting('test.operational_error_rpc_admin_id')::uuid
      AND resolved_at IS NOT NULL
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_rpc_open_id')::uuid
  ),
  $$status RPC should update the operational error row$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.operational_error_status_history
    WHERE operational_error_id = current_setting('test.operational_error_rpc_open_id')::uuid
      AND from_status = 'OPEN'
      AND to_status = 'RESOLVED'
      AND note = '정상화 확인'
      AND changed_by = current_setting('test.operational_error_rpc_admin_id')::uuid
  ),
  1::bigint,
  $$status RPC should insert one status history row$$
);

SELECT is(
  public.update_operational_error_status_with_history(
    current_setting('test.operational_error_rpc_open_id')::uuid,
    'RESOLVED'::character varying,
    ''::text,
    current_setting('test.operational_error_rpc_admin_id')::uuid
  ),
  'NO_CHANGES',
  $$status RPC should return NO_CHANGES when status and note are unchanged$$
);

SELECT is(
  public.update_operational_error_status_with_history(
    gen_random_uuid(),
    'RESOLVED'::character varying,
    ''::text,
    current_setting('test.operational_error_rpc_admin_id')::uuid
  ),
  'NOT_FOUND',
  $$status RPC should return NOT_FOUND for a missing operational error$$
);

SELECT is(
  public.update_operational_error_status_with_history(
    current_setting('test.operational_error_rpc_resolved_id')::uuid,
    'OPEN'::character varying,
    '재오픈'::text,
    current_setting('test.operational_error_rpc_admin_id')::uuid
  ),
  'OPEN_DUPLICATE',
  $$status RPC should reject reopening when an OPEN duplicate exists$$
);

SELECT is(
  (
    SELECT status
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_rpc_resolved_id')::uuid
  ),
  'RESOLVED',
  $$OPEN_DUPLICATE should leave the operational error unchanged$$
);

CREATE OR REPLACE FUNCTION public.test_fail_status_history_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forced history failure';
END;
$$;

CREATE TRIGGER test_fail_status_history_insert
  BEFORE INSERT ON public.operational_error_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.test_fail_status_history_insert();

SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_operational_error_status_with_history(
        '%s'::uuid,
        'IGNORED'::character varying,
        'ignore'::text,
        '%s'::uuid
      );
    $sql$,
    current_setting('test.operational_error_rpc_duplicate_open_id'),
    current_setting('test.operational_error_rpc_admin_id')
  ),
  NULL,
  NULL,
  $$status RPC should throw when history insert fails$$
);

SELECT is(
  (
    SELECT status
    FROM public.operational_errors
    WHERE id = current_setting('test.operational_error_rpc_duplicate_open_id')::uuid
  ),
  'OPEN',
  $$history insert failure should roll back the status update$$
);

SELECT * FROM finish();
ROLLBACK;
