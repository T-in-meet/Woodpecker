-- ==================================================
-- notifications / delete_feedback_reply_with_notifications
-- ==================================================

BEGIN;

SELECT plan(6);

SELECT set_config('test.delete_reply_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_feedback_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_other_feedback_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_reply_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_notification_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_other_user_notification_id', gen_random_uuid()::text, true);
SELECT set_config('test.delete_reply_other_type_notification_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.delete_reply_user_id')::uuid,
    'delete_reply_' || current_setting('test.delete_reply_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.delete_reply_other_user_id')::uuid,
    'delete_reply_other_' || current_setting('test.delete_reply_other_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feedbacks (id, user_id, category, title, content, status)
VALUES
  (
    current_setting('test.delete_reply_feedback_id')::uuid,
    current_setting('test.delete_reply_user_id')::uuid,
    'ETC',
    'feedback title',
    'feedback content',
    'RESOLVED'
  ),
  (
    current_setting('test.delete_reply_other_feedback_id')::uuid,
    current_setting('test.delete_reply_other_user_id')::uuid,
    'ETC',
    'other feedback title',
    'other feedback content',
    'RESOLVED'
  );

INSERT INTO public.feedback_replies (
  id,
  feedback_id,
  title,
  content,
  image_paths,
  created_by
)
VALUES (
  current_setting('test.delete_reply_reply_id')::uuid,
  current_setting('test.delete_reply_feedback_id')::uuid,
  'reply title',
  'reply content',
  ARRAY['feedback/reply-a.png', 'feedback/reply-b.png'],
  current_setting('test.delete_reply_other_user_id')::uuid
);

INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  body,
  status,
  click_path,
  metadata
)
VALUES
  (
    current_setting('test.delete_reply_notification_id')::uuid,
    current_setting('test.delete_reply_user_id')::uuid,
    'FEEDBACK_REPLY',
    'reply notification',
    'reply body',
    'SENT',
    '/mypage?section=support&tab=inquiry',
    jsonb_build_object('feedbackId', current_setting('test.delete_reply_feedback_id'))
  ),
  (
    current_setting('test.delete_reply_other_user_notification_id')::uuid,
    current_setting('test.delete_reply_other_user_id')::uuid,
    'FEEDBACK_REPLY',
    'other user notification',
    'other body',
    'SENT',
    '/mypage?section=support&tab=inquiry',
    jsonb_build_object('feedbackId', current_setting('test.delete_reply_feedback_id'))
  ),
  (
    current_setting('test.delete_reply_other_type_notification_id')::uuid,
    current_setting('test.delete_reply_user_id')::uuid,
    'SYSTEM',
    'system notification',
    'system body',
    'SENT',
    '/',
    jsonb_build_object('feedbackId', current_setting('test.delete_reply_feedback_id'))
  );

SET LOCAL ROLE service_role;

SELECT results_eq(
  format(
    $sql$
      SELECT image_paths, deleted_notification_count
      FROM public.delete_feedback_reply_with_notifications('%s'::uuid);
    $sql$,
    current_setting('test.delete_reply_feedback_id')
  ),
  $$VALUES (ARRAY['feedback/reply-a.png', 'feedback/reply-b.png']::text[], 1)$$,
  $$RPC should return deleted reply image paths and notification count$$
);

RESET ROLE;

SELECT is(
  (
    SELECT status
    FROM public.feedbacks
    WHERE id = current_setting('test.delete_reply_feedback_id')::uuid
  ),
  'OPEN',
  $$RPC should reopen the feedback$$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.feedback_replies
    WHERE feedback_id = current_setting('test.delete_reply_feedback_id')::uuid
  ),
  0,
  $$RPC should delete the reply row$$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.notifications
    WHERE id = current_setting('test.delete_reply_notification_id')::uuid
  ),
  0,
  $$RPC should delete the matching FEEDBACK_REPLY notification$$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.notifications
    WHERE id = current_setting('test.delete_reply_other_user_notification_id')::uuid
  ),
  1,
  $$RPC should not delete another user's notification$$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.notifications
    WHERE id = current_setting('test.delete_reply_other_type_notification_id')::uuid
  ),
  1,
  $$RPC should not delete another notification type$$
);

SELECT * FROM finish();
ROLLBACK;
