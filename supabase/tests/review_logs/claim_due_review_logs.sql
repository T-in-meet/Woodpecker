-- =========================================
-- review_logs / claim_due_review_logs
-- =========================================

BEGIN;

SELECT plan(15);

SELECT set_config('test.claim_due_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_future_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_exhausted_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_completed_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_completed_exhausted_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_future_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_exhausted_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_completed_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.claim_due_completed_exhausted_log_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.claim_due_user_id')::uuid,
  'claim_due_' || current_setting('test.claim_due_user_id') || '@example.com',
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
VALUES
  (
    current_setting('test.claim_due_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    'claim due note',
    'content',
    0,
    now() - interval '1 hour',
    NULL
  ),
  (
    current_setting('test.claim_due_future_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    'claim due future note',
    'content',
    0,
    now() + interval '1 hour',
    NULL
  ),
  (
    current_setting('test.claim_due_exhausted_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    'claim due exhausted note',
    'content',
    0,
    now() - interval '1 hour',
    NULL
  ),
  (
    current_setting('test.claim_due_completed_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    'claim due completed note',
    'content',
    0,
    now() - interval '1 hour',
    now() - interval '2 hours'
  ),
  (
    current_setting('test.claim_due_completed_exhausted_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    'claim due completed exhausted note',
    'content',
    0,
    now() - interval '1 hour',
    now() - interval '2 hours'
  );

INSERT INTO public.review_logs (
  id,
  note_id,
  user_id,
  round,
  scheduled_at,
  notification_claimed_at,
  notification_dispatch_attempts
)
VALUES
  (
    current_setting('test.claim_due_log_id')::uuid,
    current_setting('test.claim_due_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    1,
    now() - interval '1 hour',
    NULL,
    0
  ),
  (
    current_setting('test.claim_due_future_log_id')::uuid,
    current_setting('test.claim_due_future_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    1,
    now() + interval '1 hour',
    NULL,
    0
  ),
  (
    current_setting('test.claim_due_exhausted_log_id')::uuid,
    current_setting('test.claim_due_exhausted_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    1,
    now() - interval '1 hour',
    now() - interval '16 minutes',
    5
  ),
  (
    current_setting('test.claim_due_completed_log_id')::uuid,
    current_setting('test.claim_due_completed_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    1,
    now() - interval '1 hour',
    NULL,
    0
  ),
  (
    current_setting('test.claim_due_completed_exhausted_log_id')::uuid,
    current_setting('test.claim_due_completed_exhausted_note_id')::uuid,
    current_setting('test.claim_due_user_id')::uuid,
    1,
    now() - interval '1 hour',
    now() - interval '16 minutes',
    5
  );

SET LOCAL ROLE service_role;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(10)),
  1::bigint,
  $$claim_due_review_logs should claim one eligible due log$$
);

SELECT is(
  (
    SELECT notification_dispatch_attempts
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_log_id')::uuid
  ),
  1,
  $$claiming a due log should increment dispatch attempts$$
);

SELECT ok(
  (
    SELECT notification_claimed_at IS NOT NULL
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_log_id')::uuid
  ),
  $$claiming a due log should stamp notification_claimed_at$$
);

SELECT ok(
  (
    SELECT notification_dispatch_failed_at IS NOT NULL
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_exhausted_log_id')::uuid
  ),
  $$stale rows at the retry limit should be dead-lettered$$
);

SELECT ok(
  (
    SELECT notification_claimed_at IS NULL
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_future_log_id')::uuid
  ),
  $$future review logs should not be claimed$$
);

SELECT ok(
  (
    SELECT notification_claimed_at IS NULL
      AND notification_dispatch_attempts = 0
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_completed_log_id')::uuid
  ),
  $$completed notes should not have their pending review logs claimed$$
);

SELECT ok(
  (
    SELECT notification_dispatch_failed_at IS NULL
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_completed_exhausted_log_id')::uuid
  ),
  $$completed notes should not have exhausted review logs dead-lettered$$
);

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(10)),
  0::bigint,
  $$recently claimed rows should not be reclaimed before the timeout$$
);

UPDATE public.review_logs
SET notification_claimed_at = now() - interval '16 minutes'
WHERE id = current_setting('test.claim_due_log_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(10)),
  1::bigint,
  $$stale claimed rows below the retry limit should be reclaimed$$
);

SELECT is(
  (
    SELECT notification_dispatch_attempts
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_log_id')::uuid
  ),
  2,
  $$reclaiming should increment dispatch attempts again$$
);

UPDATE public.review_logs
SET notification_claimed_at = now() - interval '16 minutes',
    notification_dispatch_attempts = 5,
    notification_dispatch_failed_at = NULL
WHERE id = current_setting('test.claim_due_log_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(10)),
  0::bigint,
  $$rows at the retry limit should not be returned for another attempt$$
);

SELECT ok(
  (
    SELECT notification_dispatch_failed_at IS NOT NULL
    FROM public.review_logs
    WHERE id = current_setting('test.claim_due_log_id')::uuid
  ),
  $$rows at the retry limit should be marked failed when they become stale$$
);

WITH inserted_notes AS (
  INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
  SELECT
    gen_random_uuid(),
    current_setting('test.claim_due_user_id')::uuid,
    'claim due minimum clamp ' || n,
    'content',
    0,
    now() - interval '1 hour'
  FROM generate_series(1, 2) AS n
  RETURNING id, user_id
)
INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
SELECT id, user_id, 1, now() - interval '1 hour'
FROM inserted_notes;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(0)),
  1::bigint,
  $$p_limit <= 0 should be clamped to the minimum batch size$$
);

UPDATE public.review_logs rl
SET notification_dispatched_at = now()
FROM public.notes n
WHERE n.id = rl.note_id
  AND n.title LIKE 'claim due minimum clamp %';

WITH inserted_notes AS (
  INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
  SELECT
    gen_random_uuid(),
    current_setting('test.claim_due_user_id')::uuid,
    'claim due null default ' || n,
    'content',
    0,
    now() - interval '1 hour'
  FROM generate_series(1, 201) AS n
  RETURNING id, user_id
)
INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
SELECT id, user_id, 1, now() - interval '1 hour'
FROM inserted_notes;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(NULL)),
  200::bigint,
  $$NULL p_limit should use the default batch size$$
);

UPDATE public.review_logs rl
SET notification_dispatched_at = now()
FROM public.notes n
WHERE n.id = rl.note_id
  AND n.title LIKE 'claim due null default %';

WITH inserted_notes AS (
  INSERT INTO public.notes (id, user_id, title, content, review_round, next_review_at)
  SELECT
    gen_random_uuid(),
    current_setting('test.claim_due_user_id')::uuid,
    'claim due maximum clamp ' || n,
    'content',
    0,
    now() - interval '1 hour'
  FROM generate_series(1, 201) AS n
  RETURNING id, user_id
)
INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
SELECT id, user_id, 1, now() - interval '1 hour'
FROM inserted_notes;

SELECT is(
  (SELECT count(*) FROM public.claim_due_review_logs(201)),
  200::bigint,
  $$p_limit above the maximum batch size should be clamped$$
);

SELECT * FROM finish();
ROLLBACK;
