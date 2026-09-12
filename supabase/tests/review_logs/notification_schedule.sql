-- =========================================
-- review_logs / update_notification_schedule
-- =========================================

BEGIN;

SELECT plan(12);

SELECT set_config('test.schedule_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_sent_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_sent_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_completed_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.schedule_completed_log_id', gen_random_uuid()::text, true);

-- 허용 범위가 "지금(KST)" 기준이라 고정 날짜를 쓸 수 없다.
SELECT set_config(
  'test.schedule_target_at',
  (
    public.apply_time_of_day(now() + interval '3 days', TIME '21:30')
  )::text,
  true
);
SELECT set_config(
  'test.schedule_today_target_at',
  (
    now()
      + (
          public.kst_day_start(now() + interval '1 day') - now()
        ) / 2
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

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round,
  next_review_at,
  review_completed_at
)
VALUES (
  current_setting('test.schedule_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  'schedule note',
  'content',
  0,
  public.kst_day_start(now()),
  NULL
),
(
  current_setting('test.schedule_sent_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  'schedule sent note',
  'content',
  0,
  public.kst_day_start(now()),
  NULL
),
-- 완료 표시한 노트도 pending log를 보존하므로 log 조건만으로는 걸러지지 않는다.
(
  current_setting('test.schedule_completed_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  'schedule completed note',
  'content',
  0,
  public.kst_day_start(now()),
  now() - interval '1 hour'
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
),
(
  current_setting('test.schedule_completed_log_id')::uuid,
  current_setting('test.schedule_completed_note_id')::uuid,
  current_setting('test.schedule_user_id')::uuid,
  1,
  public.apply_time_of_day(now(), TIME '14:30')
);

-- 이미 발송된 알림도 미래 일정으로 다시 옮길 수 있다.
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
  $$moving the schedule to a future date should succeed$$
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

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_note_id'),
    (public.apply_time_of_day(now() + interval '1 year', TIME '21:30'))::text
  ),
  $$moving the schedule one year ahead should succeed$$
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

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_sent_note_id'),
    current_setting('test.schedule_target_at')
  ),
  $$already dispatched notifications should be rearmed at the new schedule$$
);

-- 완료 당일 정책 검사는 성공 케이스보다 먼저 본다. 아래 same-day 변경이 완료
-- 표시를 풀어 노트를 진행 중으로 되돌리므로, 순서를 바꾸면 완료 노트가 아니게 된다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_completed_note_id'),
    current_setting('test.schedule_target_at')
  ),
  'completed review schedule must stay on completion day',
  $$completed notes should not be moved away from their completion day$$
);

-- 완료 표시한 KST 당일에는 오늘의 미래 시각으로 다시 잡을 수 있다.
SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_schedule('%s'::uuid, '%s'::timestamptz);
    $sql$,
    current_setting('test.schedule_completed_note_id'),
    current_setting('test.schedule_today_target_at')
  ),
  $$completed notes should be reschedulable later on their completion day$$
);

SELECT is(
  (
    SELECT scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.schedule_completed_log_id')::uuid
  ),
  current_setting('test.schedule_today_target_at')::timestamptz,
  $$same-day rescheduling should update the completed note's pending log$$
);

-- 완료 표시가 남아 있으면 claim_due_review_logs가 이 로그를 집어가지 않아
-- 방금 잡은 시각에 알림이 나가지 않는다.
SELECT ok(
  (
    SELECT review_completed_at IS NULL
    FROM public.notes
    WHERE id = current_setting('test.schedule_completed_note_id')::uuid
  ),
  $$same-day rescheduling should resume the completed note$$
);

SELECT * FROM finish();

ROLLBACK;
