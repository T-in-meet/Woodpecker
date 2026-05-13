-- =========================================
-- review_logs / notification_time_of_day
-- =========================================

BEGIN;

SELECT plan(11);

SELECT set_config('test.notification_time_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_duplicate_log_id', gen_random_uuid()::text, true);

SELECT is(
  public.apply_time_of_day(
    TIMESTAMPTZ '2026-05-01 23:30:00+09',
    TIME '01:00'
  ),
  TIMESTAMPTZ '2026-05-01 01:00:00+09',
  $$apply_time_of_day should keep the same KST date$$
);

SELECT is(
  public.apply_time_of_day_not_before(
    TIMESTAMPTZ '2026-05-01 23:30:00+09',
    TIME '01:00'
  ),
  TIMESTAMPTZ '2026-05-02 01:00:00+09',
  $$apply_time_of_day_not_before should move earlier wall-clock times to the next KST date$$
);

SELECT is(
  public.apply_time_of_day_not_before(
    TIMESTAMPTZ '2026-05-01 13:00:00+09',
    TIME '14:00'
  ),
  TIMESTAMPTZ '2026-05-01 14:00:00+09',
  $$apply_time_of_day_not_before should keep later wall-clock times on the same KST date$$
);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.notification_time_user_id')::uuid,
  'notification_time_' || current_setting('test.notification_time_user_id') || '@example.com',
  now(),
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
VALUES (
  current_setting('test.notification_time_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  'notification time note',
  'content',
  0,
  TIMESTAMPTZ '2026-05-01 14:30:00+09'
);

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.notification_time_log_id')::uuid,
  current_setting('test.notification_time_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  1,
  TIMESTAMPTZ '2026-05-01 14:30:00+09'
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        '%s'::uuid,
        2,
        TIMESTAMPTZ '2026-05-02 14:30:00+09'
      );
    $sql$,
    current_setting('test.notification_time_duplicate_log_id'),
    current_setting('test.notification_time_note_id'),
    current_setting('test.notification_time_user_id')
  ),
  '23505',
  NULL,
  $$review_logs should enforce at most one pending log per note$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notification_time_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_time_of_day('%s'::uuid, TIME '16:00');
    $sql$,
    current_setting('test.notification_time_note_id')
  ),
  $$setting a custom notification time should succeed$$
);

SELECT is(
  (
    SELECT notification_time_of_day::text
    FROM public.notes
    WHERE id = current_setting('test.notification_time_note_id')::uuid
  ),
  '16:00:00',
  $$notes.notification_time_of_day should store the custom time$$
);

SELECT is(
  (
    SELECT scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.notification_time_log_id')::uuid
  ),
  TIMESTAMPTZ '2026-05-01 16:00:00+09',
  $$pending review log should shift to the custom KST time$$
);

SELECT is(
  (
    SELECT notification_base_scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.notification_time_log_id')::uuid
  ),
  TIMESTAMPTZ '2026-05-01 14:30:00+09',
  $$pending review log should retain the original cadence timestamp$$
);

SELECT is(
  (
    SELECT next_review_at
    FROM public.notes
    WHERE id = current_setting('test.notification_time_note_id')::uuid
  ),
  public.kst_day_start(TIMESTAMPTZ '2026-05-01 14:30:00+09'),
  $$notes.next_review_at should follow KST midnight of base cadence, not the shifted notification time$$
);

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_time_of_day('%s'::uuid, NULL::time);
    $sql$,
    current_setting('test.notification_time_note_id')
  ),
  $$clearing a custom notification time should succeed$$
);

SELECT ok(
  (
    SELECT n.notification_time_of_day IS NULL
      AND n.next_review_at = public.kst_day_start(TIMESTAMPTZ '2026-05-01 14:30:00+09')
      AND rl.scheduled_at = TIMESTAMPTZ '2026-05-01 14:30:00+09'
      AND rl.notification_base_scheduled_at IS NULL
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.id = current_setting('test.notification_time_log_id')::uuid
    WHERE n.id = current_setting('test.notification_time_note_id')::uuid
  ),
  $$clearing the custom time should restore the retained cadence timestamp$$
);

SELECT * FROM finish();
ROLLBACK;
