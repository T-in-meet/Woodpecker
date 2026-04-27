-- =========================================
-- review_logs / complete_review_and_schedule_next RPC
-- =========================================

BEGIN;

SELECT plan(25);

SELECT set_config('test.review_complete_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_user_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_round1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_round2_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_round3_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_other_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_mismatch_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_notification_time_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_note_cleared_notification_time_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_round1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_round2_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_round3_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_other_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_mismatch_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_notification_time_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_complete_log_cleared_notification_time_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.review_complete_user_a_id')::uuid,
    'review_complete_user_a_' || current_setting('test.review_complete_user_a_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.review_complete_user_b_id')::uuid,
    'review_complete_user_b_' || current_setting('test.review_complete_user_b_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.review_complete_user_unverified_id')::uuid,
    'review_complete_user_unverified_' || current_setting('test.review_complete_user_unverified_id') || '@example.com',
    NULL,
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
VALUES
  (
    current_setting('test.review_complete_note_round1_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'round1 note',
    'round1 content',
    0,
    '2026-01-02T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_note_round2_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'round2 note',
    'round2 content',
    1,
    '2026-01-05T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_note_round3_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'round3 note',
    'round3 content',
    2,
    '2026-01-08T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_note_other_id')::uuid,
    current_setting('test.review_complete_user_b_id')::uuid,
    'other note',
    'other content',
    0,
    '2026-01-03T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_note_mismatch_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'mismatch note',
    'mismatch content',
    0,
    '2026-01-06T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_note_unverified_id')::uuid,
    current_setting('test.review_complete_user_unverified_id')::uuid,
    'unverified note',
    'unverified content',
    0,
    '2026-01-07T00:00:00Z'::timestamptz
  );

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round,
  next_review_at,
  notification_time_of_day
)
VALUES
  (
    current_setting('test.review_complete_note_notification_time_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'notification time note',
    'notification time content',
    0,
    '2026-01-09T00:00:00Z'::timestamptz,
    TIME '16:00'
  ),
  (
    current_setting('test.review_complete_note_cleared_notification_time_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    'cleared notification time note',
    'cleared notification time content',
    0,
    TIMESTAMPTZ '2026-05-01 14:30:00+09',
    NULL
  );

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.review_complete_log_round1_id')::uuid,
    current_setting('test.review_complete_note_round1_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    1,
    '2026-01-02T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_round2_id')::uuid,
    current_setting('test.review_complete_note_round2_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    2,
    '2026-01-05T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_round3_id')::uuid,
    current_setting('test.review_complete_note_round3_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    3,
    '2026-01-08T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_other_id')::uuid,
    current_setting('test.review_complete_note_other_id')::uuid,
    current_setting('test.review_complete_user_b_id')::uuid,
    1,
    '2026-01-03T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_mismatch_id')::uuid,
    current_setting('test.review_complete_note_mismatch_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    2,
    '2026-01-06T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_unverified_id')::uuid,
    current_setting('test.review_complete_note_unverified_id')::uuid,
    current_setting('test.review_complete_user_unverified_id')::uuid,
    1,
    '2026-01-07T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_notification_time_id')::uuid,
    current_setting('test.review_complete_note_notification_time_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    1,
    '2026-01-09T00:00:00Z'::timestamptz
  ),
  (
    current_setting('test.review_complete_log_cleared_notification_time_id')::uuid,
    current_setting('test.review_complete_note_cleared_notification_time_id')::uuid,
    current_setting('test.review_complete_user_a_id')::uuid,
    1,
    TIMESTAMPTZ '2026-05-01 14:30:00+09'
  );

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_round1_id')::uuid,
      current_setting('test.review_complete_log_round1_id')::uuid
    );
  $sql$,
  '42501',
  NULL,
  $$anon callers should be blocked before the RPC body runs$$
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_round1_id')::uuid,
      current_setting('test.review_complete_log_round1_id')::uuid
    );
  $sql$,
  'P0001',
  'not authenticated',
  $$authenticated role without a JWT subject should be rejected$$
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.review_complete_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      NULL::uuid,
      current_setting('test.review_complete_log_round1_id')::uuid
    );
  $sql$,
  'P0001',
  'note_id and review_log_id are required',
  $$NULL note_id should be rejected$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_round1_id')::uuid,
      NULL::uuid
    );
  $sql$,
  'P0001',
  'note_id and review_log_id are required',
  $$NULL review_log_id should be rejected$$
);

SELECT is(
  public.complete_review_and_schedule_next(
    current_setting('test.review_complete_note_round1_id')::uuid,
    current_setting('test.review_complete_log_round1_id')::uuid
  )::text,
  current_setting('test.review_complete_note_round1_id'),
  $$round 1 RPC should return the note id$$
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL
    FROM public.review_logs
    WHERE id = current_setting('test.review_complete_log_round1_id')::uuid
  ),
  $$round 1 log should be marked as completed$$
);

SELECT ok(
  (
    SELECT n.review_round = 1
      AND n.next_review_at = rl.completed_at + interval '3 days'
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.id = current_setting('test.review_complete_log_round1_id')::uuid
    WHERE n.id = current_setting('test.review_complete_note_round1_id')::uuid
  ),
  $$round 1 completion should schedule the next review three days later$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs rl
    JOIN public.review_logs completed
      ON completed.id = current_setting('test.review_complete_log_round1_id')::uuid
    WHERE rl.note_id = current_setting('test.review_complete_note_round1_id')::uuid
      AND rl.round = 2
      AND rl.scheduled_at = completed.completed_at + interval '3 days'
      AND rl.completed_at IS NULL
  ),
  1::bigint,
  $$round 1 completion should create exactly one pending round 2 log$$
);

SELECT set_config(
  'test.review_complete_generated_round2_log_id',
  (
    SELECT rl.id::text
    FROM public.review_logs rl
    WHERE rl.note_id = current_setting('test.review_complete_note_round1_id')::uuid
      AND rl.round = 2
      AND rl.completed_at IS NULL
    ORDER BY rl.created_at DESC
    LIMIT 1
  ),
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_round1_id')::uuid,
      current_setting('test.review_complete_generated_round2_log_id')::uuid
    );
  $sql$,
  'WP001',
  'daily review completion limit reached',
  $$a second completion for the same note on the same KST day should be rejected with the daily-limit code$$
);

SELECT ok(
  (
    SELECT n.review_round = 1
      AND rl.completed_at IS NULL
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.id = current_setting('test.review_complete_generated_round2_log_id')::uuid
    WHERE n.id = current_setting('test.review_complete_note_round1_id')::uuid
  ),
  $$daily-limit rejection should leave the pending review and note state unchanged$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_round1_id')::uuid,
      current_setting('test.review_complete_log_round1_id')::uuid
    );
  $sql$,
  'P0001',
  'pending review log not found',
  $$completed review logs should not be completable twice$$
);

SELECT is(
  public.complete_review_and_schedule_next(
    current_setting('test.review_complete_note_round2_id')::uuid,
    current_setting('test.review_complete_log_round2_id')::uuid
  )::text,
  current_setting('test.review_complete_note_round2_id'),
  $$round 2 RPC should return the note id$$
);

SELECT ok(
  (
    SELECT n.review_round = 2
      AND n.next_review_at = rl.completed_at + interval '7 days'
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.id = current_setting('test.review_complete_log_round2_id')::uuid
    WHERE n.id = current_setting('test.review_complete_note_round2_id')::uuid
  ),
  $$round 2 completion should schedule the next review seven days later$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs rl
    JOIN public.review_logs completed
      ON completed.id = current_setting('test.review_complete_log_round2_id')::uuid
    WHERE rl.note_id = current_setting('test.review_complete_note_round2_id')::uuid
      AND rl.round = 3
      AND rl.scheduled_at = completed.completed_at + interval '7 days'
      AND rl.completed_at IS NULL
  ),
  1::bigint,
  $$round 2 completion should create exactly one pending round 3 log$$
);

SELECT is(
  public.complete_review_and_schedule_next(
    current_setting('test.review_complete_note_round3_id')::uuid,
    current_setting('test.review_complete_log_round3_id')::uuid
  )::text,
  current_setting('test.review_complete_note_round3_id'),
  $$round 3 RPC should return the note id$$
);

SELECT ok(
  (
    SELECT review_round = 3
      AND next_review_at IS NULL
    FROM public.notes
    WHERE id = current_setting('test.review_complete_note_round3_id')::uuid
  ),
  $$round 3 completion should clear next_review_at$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs
    WHERE note_id = current_setting('test.review_complete_note_round3_id')::uuid
  ),
  1::bigint,
  $$round 3 completion should not create an extra review log$$
);

SELECT is(
  public.complete_review_and_schedule_next(
    current_setting('test.review_complete_note_notification_time_id')::uuid,
    current_setting('test.review_complete_log_notification_time_id')::uuid
  )::text,
  current_setting('test.review_complete_note_notification_time_id'),
  $$round 1 completion with a notification time should return the note id$$
);

SELECT ok(
  (
    SELECT n.review_round = 1
      AND n.next_review_at = public.apply_time_of_day_not_before(
        completed.completed_at + interval '3 days',
        TIME '16:00'
      )
      AND generated.scheduled_at = n.next_review_at
      AND generated.notification_base_scheduled_at = completed.completed_at + interval '3 days'
    FROM public.notes n
    JOIN public.review_logs completed
      ON completed.id = current_setting('test.review_complete_log_notification_time_id')::uuid
    JOIN public.review_logs generated
      ON generated.note_id = n.id
     AND generated.round = 2
     AND generated.completed_at IS NULL
    WHERE n.id = current_setting('test.review_complete_note_notification_time_id')::uuid
  ),
  $$notification time should shift the generated next review and retain the base cadence timestamp$$
);

SELECT public.update_notification_time_of_day(
  current_setting('test.review_complete_note_cleared_notification_time_id')::uuid,
  TIME '16:00'
);

SELECT public.update_notification_time_of_day(
  current_setting('test.review_complete_note_cleared_notification_time_id')::uuid,
  NULL::time
);

SELECT ok(
  (
    SELECT n.notification_time_of_day IS NULL
      AND n.next_review_at = TIMESTAMPTZ '2026-05-01 14:30:00+09'
      AND rl.scheduled_at = TIMESTAMPTZ '2026-05-01 14:30:00+09'
      AND rl.notification_base_scheduled_at IS NULL
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.id = current_setting('test.review_complete_log_cleared_notification_time_id')::uuid
    WHERE n.id = current_setting('test.review_complete_note_cleared_notification_time_id')::uuid
  ),
  $$clearing a notification time should restore the pending cadence timestamp before completion$$
);

SELECT is(
  public.complete_review_and_schedule_next(
    current_setting('test.review_complete_note_cleared_notification_time_id')::uuid,
    current_setting('test.review_complete_log_cleared_notification_time_id')::uuid
  )::text,
  current_setting('test.review_complete_note_cleared_notification_time_id'),
  $$round 1 completion after clearing a notification time should return the note id$$
);

SELECT ok(
  (
    SELECT n.review_round = 1
      AND n.notification_time_of_day IS NULL
      AND n.next_review_at = completed.completed_at + interval '3 days'
      AND generated.scheduled_at = completed.completed_at + interval '3 days'
      AND generated.notification_base_scheduled_at IS NULL
    FROM public.notes n
    JOIN public.review_logs completed
      ON completed.id = current_setting('test.review_complete_log_cleared_notification_time_id')::uuid
    JOIN public.review_logs generated
      ON generated.note_id = n.id
     AND generated.round = 2
     AND generated.completed_at IS NULL
    WHERE n.id = current_setting('test.review_complete_note_cleared_notification_time_id')::uuid
  ),
  $$cleared notification time should keep the next generated review on the default cadence$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_other_id')::uuid,
      current_setting('test.review_complete_log_other_id')::uuid
    );
  $sql$,
  'P0001',
  'pending review log not found',
  $$another user's review log should not be completable$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_mismatch_id')::uuid,
      current_setting('test.review_complete_log_mismatch_id')::uuid
    );
  $sql$,
  'P0001',
  'review log round does not match current note state',
  $$out-of-order review logs should be rejected$$
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.review_complete_user_unverified_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_complete_note_unverified_id')::uuid,
      current_setting('test.review_complete_log_unverified_id')::uuid
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified users should be blocked by the DB-level guard$$
);

SELECT * FROM finish();
ROLLBACK;
