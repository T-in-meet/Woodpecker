-- =========================================
-- review_logs / constraints_unique
-- =========================================

BEGIN;

SELECT plan(8);

SELECT set_config('test.review_logs_unique_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_logs_unique_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_logs_unique_note_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_logs_unique_log_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_logs_unique_log_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_logs_unique_pending_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.review_logs_unique_user_id')::uuid,
  'review_logs_unique_' || current_setting('test.review_logs_unique_user_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.review_logs_unique_note_a_id')::uuid,
    current_setting('test.review_logs_unique_user_id')::uuid,
    'unique note a',
    'content',
    1
  ),
  (
    current_setting('test.review_logs_unique_note_b_id')::uuid,
    current_setting('test.review_logs_unique_user_id')::uuid,
    'unique note b',
    'content',
    1
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, completed_at)
VALUES
  (
    current_setting('test.review_logs_unique_log_a1_id')::uuid,
    current_setting('test.review_logs_unique_note_a_id')::uuid,
    current_setting('test.review_logs_unique_user_id')::uuid,
    1,
    TIMESTAMPTZ '2026-04-01 00:00:00+00',
    TIMESTAMPTZ '2026-04-01 01:00:00+00'
  ),
  (
    current_setting('test.review_logs_unique_log_b1_id')::uuid,
    current_setting('test.review_logs_unique_note_b_id')::uuid,
    current_setting('test.review_logs_unique_user_id')::uuid,
    1,
    TIMESTAMPTZ '2026-04-02 00:00:00+00',
    TIMESTAMPTZ '2026-04-01 15:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

SELECT is(
  public.kst_date(TIMESTAMPTZ '2026-04-01 14:59:59+00'),
  DATE '2026-04-01',
  $$kst_date should map UTC timestamps before KST midnight to the same KST date$$
);

SELECT is(
  public.kst_date(TIMESTAMPTZ '2026-04-01 15:00:00+00'),
  DATE '2026-04-02',
  $$kst_date should map UTC timestamps at KST midnight to the next KST date$$
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, completed_at)
    VALUES (
      gen_random_uuid(),
      current_setting('test.review_logs_unique_note_a_id')::uuid,
      current_setting('test.review_logs_unique_user_id')::uuid,
      2,
      TIMESTAMPTZ '2026-04-01 03:00:00+00',
      TIMESTAMPTZ '2026-04-01 03:30:00+00'
    );
  $sql$,
  '23505',
  NULL,
  $$the same note cannot have two completed review logs on the same KST date$$
);

SAVEPOINT review_logs_unique_different_kst_date;
SELECT lives_ok(
  $sql$
    INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, completed_at)
    VALUES (
      gen_random_uuid(),
      current_setting('test.review_logs_unique_note_a_id')::uuid,
      current_setting('test.review_logs_unique_user_id')::uuid,
      2,
      TIMESTAMPTZ '2026-04-02 00:00:00+00',
      TIMESTAMPTZ '2026-04-01 15:00:00+00'
    );
  $sql$,
  $$the same note can have completed review logs on different KST dates$$
);
ROLLBACK TO SAVEPOINT review_logs_unique_different_kst_date;

SAVEPOINT review_logs_unique_different_note;
SELECT lives_ok(
  $sql$
    INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, completed_at)
    VALUES (
      gen_random_uuid(),
      current_setting('test.review_logs_unique_note_b_id')::uuid,
      current_setting('test.review_logs_unique_user_id')::uuid,
      2,
      TIMESTAMPTZ '2026-04-01 03:00:00+00',
      TIMESTAMPTZ '2026-04-01 03:30:00+00'
    );
  $sql$,
  $$a different note can be completed on the same KST date$$
);
ROLLBACK TO SAVEPOINT review_logs_unique_different_note;

SAVEPOINT review_logs_unique_pending_excluded;
SELECT lives_ok(
  $sql$
    INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
    VALUES (
      current_setting('test.review_logs_unique_pending_id')::uuid,
      current_setting('test.review_logs_unique_note_a_id')::uuid,
      current_setting('test.review_logs_unique_user_id')::uuid,
      2,
      TIMESTAMPTZ '2026-04-02 00:00:00+00'
    );
  $sql$,
  $$pending review logs should be excluded from the completed-per-day index$$
);
ROLLBACK TO SAVEPOINT review_logs_unique_pending_excluded;

SAVEPOINT review_logs_unique_update_duplicate;
INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, completed_at)
VALUES (
  gen_random_uuid(),
  current_setting('test.review_logs_unique_note_a_id')::uuid,
  current_setting('test.review_logs_unique_user_id')::uuid,
  2,
  TIMESTAMPTZ '2026-04-02 00:00:00+00',
  TIMESTAMPTZ '2026-04-01 15:00:00+00'
);

SELECT throws_ok(
  $sql$
    UPDATE public.review_logs
    SET completed_at = TIMESTAMPTZ '2026-04-01 04:00:00+00'
    WHERE note_id = current_setting('test.review_logs_unique_note_a_id')::uuid
      AND public.kst_date(completed_at) = DATE '2026-04-02';
  $sql$,
  '23505',
  NULL,
  $$updating a completed review into an existing note/KST-date pair should fail$$
);
ROLLBACK TO SAVEPOINT review_logs_unique_update_duplicate;

SELECT ok(
  NOT EXISTS (
    SELECT note_id, public.kst_date(completed_at)
    FROM public.review_logs
    WHERE completed_at IS NOT NULL
    GROUP BY note_id, public.kst_date(completed_at)
    HAVING count(*) > 1
  ),
  $$completed review logs should remain unique per note and KST date$$
);

SELECT * FROM finish();
ROLLBACK;
