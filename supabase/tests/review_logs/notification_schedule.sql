-- =========================================
-- review_logs / update_notification_schedule
-- =========================================

BEGIN;

SELECT plan(8);

SELECT set_config('test.schedule_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_sent_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_sent_log_id', gen_random_uuid()::text, true);

-- 허용 범위가 "지금(KST)" 기준이라 고정 날짜를 쓸 수 없다.
SELECT set_config(
  'test.schedule_target_at',
  (
    public.apply_time_of_day(now() + interval '3 days', TIME '21:30')
  )::text,
  true
);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.schedule_user_id')::uuid,
  'schedule_' || current_setting('test.schedule_user_id') || '@example.com',
  now(),
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
VALUES (
  current_setting('test.schedule_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  'schedule note',
  'content',
  0,
  public.kst_day_start(now())
),
(
  current_setting('test.schedule_sent_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  'schedule sent note',
  'content',
  0,
  public.kst_day_start(now())
);

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.schedule_log_id')::uuid,
  current_setting('test.schedule_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  1,
  public.apply_time_of_day(now(), TIME '14:30')
),
(
  current_setting('test.schedule_sent_log_id')::uuid,
  current_setting('test.schedule_sent_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  1,
  public.apply_time_of_day(now(), TIME '14:30')
);

-- 이미 발송된 알림은 옮길 수 없어야 한다.
UPDATE public.review_logs
SET notification_dispatched_at = now()
WHERE id = current_setting('test.schedule_sent_log_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.schedule_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_note_id'),
    current_setting('test.schedule_target_at')
  ),
  $$moving the schedule within the allowed window should succeed$$
);

SELECT is(
  (
    SELECT scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.schedule_log_id')::uuid
  ),
  current_setting('test.schedule_target_at')::timestamptz,
  $$pending review log should move to the chosen date and time$$
);

SELECT is(
  (
    SELECT notification_base_scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.schedule_log_id')::uuid
  ),
  public.apply_time_of_day(now(), TIME '14:30'),
  $$the original cadence timestamp should be retained for restoring the default$$
);

SELECT is(
  (
    SELECT next_review_at
    FROM public.notes
    WHERE id = current_setting('test.schedule_note_id')::uuid
  ),
  public.kst_day_start(current_setting('test.schedule_target_at')::timestamptz),
  $$notes.next_review_at should follow the KST midnight of the moved date$$
);

SELECT is(
  (
    SELECT notification_time_of_day::text
    FROM public.notes
    WHERE id = current_setting('test.schedule_note_id')::uuid
  ),
  '21:30:00',
  $$notes.notification_time_of_day should store the chosen wall-clock time$$
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_note_id'),
    (public.apply_time_of_day(now() + interval '31 days', TIME '21:30'))::text
  ),
  'schedule out of range',
  $$dates beyond 30 days ahead should be rejected$$
);

-- 오늘 날짜라도 이미 지나간 시각이면 다음 cron 실행에서 즉시 발송되므로 막는다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_note_id'),
    (now() - interval '1 minute')::text
  ),
  'schedule in the past',
  $$times earlier today should be rejected$$
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_sent_note_id'),
    current_setting('test.schedule_target_at')
  ),
  'no pending review log',
  $$already dispatched notifications should not be moved$$
);

SELECT * FROM finish();

ROLLBACK;
