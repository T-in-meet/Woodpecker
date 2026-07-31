-- =========================================
-- notifications / mark_notification_as_read
-- =========================================

BEGIN;

SELECT plan(6);

SELECT set_config('test.mark_read_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.mark_read_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.mark_read_unverified_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.mark_read_notification_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.mark_read_notification_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.mark_read_notification_unverified_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.mark_read_user_a_id')::uuid,
    'mark_read_a_' || current_setting('test.mark_read_user_a_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.mark_read_user_b_id')::uuid,
    'mark_read_b_' || current_setting('test.mark_read_user_b_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.mark_read_unverified_user_id')::uuid,
    'mark_read_unverified_' || current_setting('test.mark_read_unverified_user_id') || '@example.com',
    NULL,
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (id, user_id, type, title, body, status,
  click_path)
VALUES
  (
    current_setting('test.mark_read_notification_a_id')::uuid,
    current_setting('test.mark_read_user_a_id')::uuid,
    'SYSTEM',
    'a title',
    'a body',
    'SENT'
  ,
  '/test'),
  (
    current_setting('test.mark_read_notification_b_id')::uuid,
    current_setting('test.mark_read_user_b_id')::uuid,
    'SYSTEM',
    'b title',
    'b body',
    'SENT'
  ,
  '/test'),
  (
    current_setting('test.mark_read_notification_unverified_id')::uuid,
    current_setting('test.mark_read_unverified_user_id')::uuid,
    'SYSTEM',
    'unverified title',
    'unverified body',
    'SENT'
  ,
  '/test');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.mark_read_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  public.mark_notification_as_read(
    current_setting('test.mark_read_notification_a_id')::uuid
  ),
  true,
  $$mark_notification_as_read should return true when it updates a SENT notification$$
);

SELECT ok(
  (
    SELECT status = 'READ' AND read_at IS NOT NULL
    FROM public.notifications
    WHERE id = current_setting('test.mark_read_notification_a_id')::uuid
  ),
  $$mark_notification_as_read should mark the notification as READ$$
);

SELECT is(
  public.mark_notification_as_read(
    current_setting('test.mark_read_notification_a_id')::uuid
  ),
  false,
  $$mark_notification_as_read should return false when the notification is already READ$$
);

SELECT is(
  public.mark_notification_as_read(
    current_setting('test.mark_read_notification_b_id')::uuid
  ),
  false,
  $$mark_notification_as_read should return false for another user's notification$$
);

RESET ROLE;

SELECT ok(
  (
    SELECT status = 'SENT' AND read_at IS NULL
    FROM public.notifications
    WHERE id = current_setting('test.mark_read_notification_b_id')::uuid
  ),
  $$mark_notification_as_read should leave another user's notification unchanged$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.mark_read_unverified_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.mark_notification_as_read('%s'::uuid);
    $sql$,
    current_setting('test.mark_read_notification_unverified_id')
  ),
  'P0001',
  'email not confirmed',
  $$unverified users should be blocked by the DB-level guard$$
);

SELECT * FROM finish();
ROLLBACK;
