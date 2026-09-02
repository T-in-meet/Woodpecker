-- =========================================
-- review_logs / notification_time_of_day
-- =========================================

BEGIN;

SELECT plan(18);

SELECT set_config('test.notification_time_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_duplicate_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_shift_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_shift_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_completed_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_completed_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_old_completed_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.notification_time_old_completed_log_id', gen_random_uuid()::text, true);
SELECT set_config(
  'test.notification_time_today_target_at',
  (
    now()
      + (
          public.kst_day_start(now() + interval '1 day') - now()
        ) / 2
  )::text,
  true
);

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
  current_setting('test.notification_time_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  'notification time note',
  'content',
  0,
  TIMESTAMPTZ '2026-05-01 14:30:00+09',
  NULL
),
(
  current_setting('test.notification_time_shift_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  'notification time shift note',
  'content',
  0,
  TIMESTAMPTZ '2026-05-01 14:30:00+09',
  NULL
),
(
  current_setting('test.notification_time_completed_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  'notification time completed note',
  'content',
  0,
  public.kst_day_start(now()),
  now() - interval '1 hour'
),
(
  current_setting('test.notification_time_old_completed_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  'notification time old completed note',
  'content',
  0,
  public.kst_day_start(now()),
  public.kst_day_start(now()) - interval '1 hour'
);

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.notification_time_log_id')::uuid,
  current_setting('test.notification_time_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  1,
  TIMESTAMPTZ '2026-05-01 14:30:00+09'
),
(
  current_setting('test.notification_time_shift_log_id')::uuid,
  current_setting('test.notification_time_shift_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  1,
  TIMESTAMPTZ '2026-05-01 14:30:00+09'
),
(
  current_setting('test.notification_time_completed_log_id')::uuid,
  current_setting('test.notification_time_completed_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  1,
  current_setting('test.notification_time_today_target_at')::timestamptz
),
(
  current_setting('test.notification_time_old_completed_log_id')::uuid,
  current_setting('test.notification_time_old_completed_note_id')::uuid,
  current_setting('test.notification_time_user_id')::uuid,
  1,
  current_setting('test.notification_time_today_target_at')::timestamptz
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
  public.kst_day_start(TIMESTAMPTZ '2026-05-01 16:00:00+09'),
  $$notes.next_review_at should follow KST midnight of the actual notification date (shifted scheduled_at)$$
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

-- 알림 시각(08:00)이 base scheduled_at(14:30)보다 이른 경우에도 같은 KST 날짜를 유지해야 함.
-- scheduled_at: 2026-05-01 14:30+09, notification_time: 08:00
-- → apply_time_of_day → 2026-05-01 08:00+09 (같은 날)
-- → next_review_at = kst_day_start(2026-05-01 08:00+09) = 2026-05-01 00:00+09

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_time_of_day('%s'::uuid, TIME '08:00');
    $sql$,
    current_setting('test.notification_time_shift_note_id')
  ),
  $$setting a notification time earlier than base scheduled_at should succeed$$
);

SELECT is(
  (
    SELECT scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.notification_time_shift_log_id')::uuid
  ),
  TIMESTAMPTZ '2026-05-01 08:00:00+09',
  $$when notification time is earlier than base, scheduled_at should stay on the same KST date$$
);

SELECT is(
  (
    SELECT next_review_at
    FROM public.notes
    WHERE id = current_setting('test.notification_time_shift_note_id')::uuid
  ),
  public.kst_day_start(TIMESTAMPTZ '2026-05-01 08:00:00+09'),
  $$next_review_at should follow the same KST date when notification time is earlier than base$$
);

SELECT lives_ok(
  format(
    $sql$
      SELECT public.update_notification_time_of_day('%s'::uuid, '%s'::time);
    $sql$,
    current_setting('test.notification_time_completed_note_id'),
    (
      current_setting('test.notification_time_today_target_at')::timestamptz
        AT TIME ZONE 'Asia/Seoul'
    )::time
  ),
  $$a completed note should allow a later time on its completion day$$
);

SELECT is(
  (
    SELECT scheduled_at
    FROM public.review_logs
    WHERE id = current_setting('test.notification_time_completed_log_id')::uuid
  ),
  current_setting('test.notification_time_today_target_at')::timestamptz,
  $$same-day time changes should keep the completed note on today$$
);

-- 완료 표시가 남아 있으면 claim_due_review_logs가 이 로그를 집어가지 않아
-- 방금 잡은 시각에 알림이 나가지 않는다.
SELECT ok(
  (
    SELECT review_completed_at IS NULL
    FROM public.notes
    WHERE id = current_setting('test.notification_time_completed_note_id')::uuid
  ),
  $$same-day time changes should resume the completed note$$
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.update_notification_time_of_day('%s'::uuid, '%s'::time);
    $sql$,
    current_setting('test.notification_time_old_completed_note_id'),
    (
      current_setting('test.notification_time_today_target_at')::timestamptz
        AT TIME ZONE 'Asia/Seoul'
    )::time
  ),
  'completed review schedule must stay on completion day',
  $$a completed note should reject time changes after its completion day$$
);

SELECT * FROM finish();
ROLLBACK;
