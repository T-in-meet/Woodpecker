-- =========================================
-- admin notifications / unread RPCs
-- =========================================

BEGIN;

SELECT plan(9);

SELECT set_config('test.admin_notification_rpc_admin_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_notification_rpc_read_event_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_notification_rpc_error_event_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_notification_rpc_feedback_event_id', gen_random_uuid()::text, true);

DELETE FROM public.admin_notification_reads
WHERE event_id IN (
  current_setting('test.admin_notification_rpc_read_event_id')::uuid,
  current_setting('test.admin_notification_rpc_error_event_id')::uuid,
  current_setting('test.admin_notification_rpc_feedback_event_id')::uuid
);

DELETE FROM public.admin_notification_events
WHERE id IN (
  current_setting('test.admin_notification_rpc_read_event_id')::uuid,
  current_setting('test.admin_notification_rpc_error_event_id')::uuid,
  current_setting('test.admin_notification_rpc_feedback_event_id')::uuid
);

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
  current_setting('test.admin_notification_rpc_admin_id')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin_' || current_setting('test.admin_notification_rpc_admin_id') || '@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_notification_events (
  id,
  type,
  title,
  body,
  click_path,
  created_at
)
VALUES
  (
    current_setting('test.admin_notification_rpc_read_event_id')::uuid,
    'OPERATIONAL_ERROR',
    '읽은 운영 오류',
    'already read',
    '/admin/operational-errors/read',
    TIMESTAMPTZ '2026-07-27 00:00:00+00'
  ),
  (
    current_setting('test.admin_notification_rpc_error_event_id')::uuid,
    'OPERATIONAL_ERROR',
    '읽지 않은 운영 오류',
    'unread error',
    '/admin/operational-errors/unread',
    TIMESTAMPTZ '2026-07-27 02:00:00+00'
  ),
  (
    current_setting('test.admin_notification_rpc_feedback_event_id')::uuid,
    'FEEDBACK_CREATED',
    '읽지 않은 피드백',
    'unread feedback',
    '/admin/feedbacks/unread',
    TIMESTAMPTZ '2026-07-27 01:00:00+00'
  );

INSERT INTO public.admin_notification_reads (
  event_id,
  admin_user_id
)
VALUES (
  current_setting('test.admin_notification_rpc_read_event_id')::uuid,
  current_setting('test.admin_notification_rpc_admin_id')::uuid
);

SELECT ok(
  to_regprocedure('public.get_admin_unread_notification_counts(uuid)') IS NOT NULL,
  $$get_admin_unread_notification_counts should exist$$
);

SELECT ok(
  to_regprocedure('public.get_admin_unread_notification_list(uuid,integer)') IS NOT NULL,
  $$get_admin_unread_notification_list should exist$$
);

SELECT is(
  (
    SELECT unread_count
    FROM public.get_admin_unread_notification_counts(
      current_setting('test.admin_notification_rpc_admin_id')::uuid
    )
    WHERE type = 'OPERATIONAL_ERROR'
  ),
  1::bigint,
  $$count RPC should exclude events with a read row for the admin$$
);

SELECT is(
  (
    SELECT unread_count
    FROM public.get_admin_unread_notification_counts(
      current_setting('test.admin_notification_rpc_admin_id')::uuid
    )
    WHERE type = 'FEEDBACK_CREATED'
  ),
  1::bigint,
  $$count RPC should include unread feedback events$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_admin_unread_notification_counts(
      current_setting('test.admin_notification_rpc_admin_id')::uuid
    )
  ),
  2::bigint,
  $$count RPC should return only types that have unread events$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_admin_unread_notification_list(
      current_setting('test.admin_notification_rpc_admin_id')::uuid,
      10
    )
  ),
  2::bigint,
  $$list RPC should return only unread events$$
);

SELECT is(
  (
    SELECT id
    FROM public.get_admin_unread_notification_list(
      current_setting('test.admin_notification_rpc_admin_id')::uuid,
      10
    )
    LIMIT 1
  ),
  current_setting('test.admin_notification_rpc_error_event_id')::uuid,
  $$list RPC should order unread events by created_at descending$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_admin_unread_notification_list(
      current_setting('test.admin_notification_rpc_admin_id')::uuid,
      1
    )
  ),
  1::bigint,
  $$list RPC should respect the requested limit$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_admin_unread_notification_list(
      current_setting('test.admin_notification_rpc_admin_id')::uuid,
      0
    )
  ),
  1::bigint,
  $$list RPC should clamp non-positive limits to one row$$
);

SELECT * FROM finish();
ROLLBACK;
