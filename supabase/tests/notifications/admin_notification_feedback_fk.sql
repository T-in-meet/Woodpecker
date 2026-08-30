-- ==================================================
-- notifications / admin notification feedback FK
-- ==================================================

BEGIN;

SELECT plan(6);

SELECT set_config('test.admin_feedback_fk_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_feedback_fk_feedback_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_feedback_fk_event_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.admin_feedback_fk_user_id')::uuid,
  'admin_feedback_fk_' || current_setting('test.admin_feedback_fk_user_id') || '@example.com',
  now(),
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feedbacks (id, user_id, category, title, content, status)
VALUES (
  current_setting('test.admin_feedback_fk_feedback_id')::uuid,
  current_setting('test.admin_feedback_fk_user_id')::uuid,
  'ETC',
  'feedback FK test',
  'feedback notification lifecycle fixture',
  'OPEN'
);

INSERT INTO public.admin_notification_events (
  id,
  type,
  title,
  click_path,
  feedback_id
)
VALUES (
  current_setting('test.admin_feedback_fk_event_id')::uuid,
  'FEEDBACK_CREATED',
  'new feedback',
  '/admin/feedbacks/test',
  current_setting('test.admin_feedback_fk_feedback_id')::uuid
);

INSERT INTO public.admin_notification_reads (event_id, admin_user_id)
VALUES (
  current_setting('test.admin_feedback_fk_event_id')::uuid,
  current_setting('test.admin_feedback_fk_user_id')::uuid
);

SELECT is(
  (
    SELECT feedback_id
    FROM public.admin_notification_events
    WHERE id = current_setting('test.admin_feedback_fk_event_id')::uuid
  ),
  current_setting('test.admin_feedback_fk_feedback_id')::uuid,
  'FEEDBACK_CREATED event should reference an existing feedback'
);

SELECT throws_ok(
  $$
    INSERT INTO public.admin_notification_events (type, title, click_path)
    VALUES ('FEEDBACK_CREATED', 'missing feedback', '/admin/feedbacks/missing')
  $$,
  '23514',
  NULL,
  'FEEDBACK_CREATED should require feedback_id'
);

SELECT throws_ok(
  format(
    $$
      INSERT INTO public.admin_notification_events (type, title, click_path, feedback_id)
      VALUES ('OPERATIONAL_ERROR', 'invalid feedback', '/admin/operational-errors', %L::uuid)
    $$,
    current_setting('test.admin_feedback_fk_feedback_id')
  ),
  '23514',
  NULL,
  'OPERATIONAL_ERROR should reject feedback_id'
);

SELECT throws_ok(
  format(
    $$
      INSERT INTO public.admin_notification_events (type, title, click_path, feedback_id)
      VALUES ('FEEDBACK_CREATED', 'unknown feedback', '/admin/feedbacks/unknown', %L::uuid)
    $$,
    gen_random_uuid()::text
  ),
  '23503',
  NULL,
  'FEEDBACK_CREATED should reject an unknown feedback_id'
);

DELETE FROM public.feedbacks
WHERE id = current_setting('test.admin_feedback_fk_feedback_id')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.admin_notification_events
    WHERE id = current_setting('test.admin_feedback_fk_event_id')::uuid
  ),
  0::bigint,
  'deleting feedback should cascade to its admin notification event'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.admin_notification_reads
    WHERE event_id = current_setting('test.admin_feedback_fk_event_id')::uuid
      AND admin_user_id = current_setting('test.admin_feedback_fk_user_id')::uuid
  ),
  0::bigint,
  'deleting the event should cascade to all read rows'
);

SELECT * FROM finish();

ROLLBACK;
