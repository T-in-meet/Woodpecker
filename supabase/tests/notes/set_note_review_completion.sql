-- =========================================
-- notes / set_note_review_completion RPC
-- =========================================

BEGIN;

SELECT plan(20);

SELECT set_config('test.review_state_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_unverified_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_active_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_other_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_unverified_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_legacy_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_active_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_unverified_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_state_notification_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.review_state_user_a_id')::uuid,
    'review_state_a_' || current_setting('test.review_state_user_a_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.review_state_user_b_id')::uuid,
    'review_state_b_' || current_setting('test.review_state_user_b_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.review_state_unverified_user_id')::uuid,
    'review_state_unverified_' || current_setting('test.review_state_unverified_user_id') || '@example.com',
    NULL,
    '{}'::jsonb
  );

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
    current_setting('test.review_state_active_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    'active note',
    'active content',
    0,
    now() + interval '1 day',
    NULL
  ),
  (
    current_setting('test.review_state_other_note_id')::uuid,
    current_setting('test.review_state_user_b_id')::uuid,
    'other note',
    'other content',
    0,
    now() + interval '1 day',
    NULL
  ),
  (
    current_setting('test.review_state_unverified_note_id')::uuid,
    current_setting('test.review_state_unverified_user_id')::uuid,
    'unverified note',
    'unverified content',
    0,
    now() + interval '1 day',
    NULL
  ),
  (
    current_setting('test.review_state_legacy_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    'legacy completed note',
    'legacy completed content',
    3,
    NULL,
    now() - interval '1 day'
  );

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.review_state_active_log_id')::uuid,
    current_setting('test.review_state_active_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    1,
    now() + interval '1 day'
  ),
  (
    current_setting('test.review_state_unverified_log_id')::uuid,
    current_setting('test.review_state_unverified_note_id')::uuid,
    current_setting('test.review_state_unverified_user_id')::uuid,
    1,
    now() + interval '1 day'
  );

INSERT INTO public.review_logs (
  note_id,
  user_id,
  round,
  scheduled_at,
  completed_at
)
VALUES
  (
    current_setting('test.review_state_legacy_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    1,
    now() - interval '10 days',
    now() - interval '9 days'
  ),
  (
    current_setting('test.review_state_legacy_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    2,
    now() - interval '7 days',
    now() - interval '6 days'
  ),
  (
    current_setting('test.review_state_legacy_note_id')::uuid,
    current_setting('test.review_state_user_a_id')::uuid,
    3,
    now() - interval '4 days',
    now() - interval '3 days'
  );

INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  body,
  status,
  note_id,
  review_log_id,
  click_path
)
VALUES (
  current_setting('test.review_state_notification_id')::uuid,
  current_setting('test.review_state_user_a_id')::uuid,
  'REVIEW',
  'review notification',
  'review notification body',
  'SENT',
  current_setting('test.review_state_active_note_id')::uuid,
  current_setting('test.review_state_active_log_id')::uuid,
  '/test'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.set_note_review_completion(
      current_setting('test.review_state_active_note_id')::uuid,
      true
    );
  $sql$,
  '42501',
  NULL,
  $$anon callers should not have execute permission$$
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.set_note_review_completion(
      current_setting('test.review_state_active_note_id')::uuid,
      true
    );
  $sql$,
  'P0001',
  'not authenticated',
  $$authenticated callers without a JWT subject should be rejected$$
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.review_state_unverified_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.set_note_review_completion(
      current_setting('test.review_state_unverified_note_id')::uuid,
      true
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified users should be rejected$$
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.review_state_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.set_note_review_completion(
      current_setting('test.review_state_other_note_id')::uuid,
      true
    );
  $sql$,
  'P0001',
  'note not found',
  $$users should not change another user's note$$
);

SELECT is(
  public.set_note_review_completion(
    current_setting('test.review_state_active_note_id')::uuid,
    true
  ),
  true,
  $$completing a note should return true$$
);

SELECT ok(
  (
    SELECT review_completed_at IS NOT NULL
    FROM public.notes
    WHERE id = current_setting('test.review_state_active_note_id')::uuid
  ),
  $$completing a note should store the completion timestamp$$
);

SELECT ok(
  (
    SELECT status = 'READ' AND read_at IS NOT NULL
    FROM public.notifications
    WHERE id = current_setting('test.review_state_notification_id')::uuid
  ),
  $$completing a note should consume its SENT review notification$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs
    WHERE note_id = current_setting('test.review_state_active_note_id')::uuid
      AND completed_at IS NULL
  ),
  1::bigint,
  $$completing a note should preserve its pending review log$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_review_and_schedule_next(
      current_setting('test.review_state_active_note_id')::uuid,
      current_setting('test.review_state_active_log_id')::uuid
    );
  $sql$,
  'P0001',
  'review already completed',
  $$completed notes should be rejected by the completion RPC$$
);

SELECT ok(
  (
    SELECT completed_at IS NULL
    FROM public.review_logs
    WHERE id = current_setting('test.review_state_active_log_id')::uuid
  ),
  $$a rejected completion should leave the pending log untouched$$
);

-- 완료 표시 전에 이미 알림이 나간 상태를 재현한다. 발송 상태가 남은 채로 되살아나면
-- claim_due_review_logs가 그 log를 다시는 집어가지 않는다.
UPDATE public.review_logs
SET notification_claimed_at = now() - interval '2 hours',
    notification_dispatched_at = now() - interval '2 hours',
    notification_dispatch_attempts = 1
WHERE id = current_setting('test.review_state_active_log_id')::uuid;

SELECT is(
  public.set_note_review_completion(
    current_setting('test.review_state_active_note_id')::uuid,
    false
  ),
  false,
  $$resuming a note should return false$$
);

SELECT ok(
  (
    SELECT notification_claimed_at IS NULL
      AND notification_dispatched_at IS NULL
      AND notification_dispatch_failed_at IS NULL
      AND notification_dispatch_attempts = 0
    FROM public.review_logs
    WHERE id = current_setting('test.review_state_active_log_id')::uuid
  ),
  $$resuming should rearm the preserved log so its notification can be sent again$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.notifications
    WHERE review_log_id = current_setting('test.review_state_active_log_id')::uuid
      AND type = 'REVIEW'
  ),
  0::bigint,
  $$resuming should drop the consumed notification row so the next dispatch creates a new one$$
);

SELECT ok(
  (
    SELECT note.review_completed_at IS NULL
      AND note.next_review_at = public.kst_day_start(log.scheduled_at)
    FROM public.notes note
    JOIN public.review_logs log
      ON log.note_id = note.id
     AND log.completed_at IS NULL
    WHERE note.id = current_setting('test.review_state_active_note_id')::uuid
  ),
  $$resuming should reactivate the note at the preserved pending schedule$$
);

-- stale 탭이나 요청 재시도로 이미 진행 중인 노트에 재시작 요청이 다시 들어오는
-- 상황을 재현한다. 첫 재시작 뒤 발송된 알림을 다시 무장하거나 지우면 안 된다.
RESET ROLE;

UPDATE public.review_logs
SET notification_claimed_at = now() - interval '1 minute',
    notification_dispatched_at = now() - interval '30 seconds',
    notification_dispatch_attempts = 1
WHERE id = current_setting('test.review_state_active_log_id')::uuid;

INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body,
  status,
  note_id,
  review_log_id,
  click_path
)
VALUES (
  current_setting('test.review_state_user_a_id')::uuid,
  'REVIEW',
  'resumed review notification',
  'resumed review notification body',
  'SENT',
  current_setting('test.review_state_active_note_id')::uuid,
  current_setting('test.review_state_active_log_id')::uuid,
  '/test'
);

SET LOCAL ROLE authenticated;

SELECT is(
  public.set_note_review_completion(
    current_setting('test.review_state_active_note_id')::uuid,
    false
  ),
  false,
  $$repeating resume for an active note should be an idempotent no-op$$
);

SELECT ok(
  (
    SELECT notification_claimed_at IS NOT NULL
      AND notification_dispatched_at IS NOT NULL
      AND notification_dispatch_attempts = 1
    FROM public.review_logs
    WHERE id = current_setting('test.review_state_active_log_id')::uuid
  ),
  $$repeating resume should preserve the dispatched review log state$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.notifications
    WHERE review_log_id = current_setting('test.review_state_active_log_id')::uuid
      AND type = 'REVIEW'
      AND status = 'SENT'
  ),
  1::bigint,
  $$repeating resume should preserve the dispatched notification row$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs
    WHERE note_id = current_setting('test.review_state_active_note_id')::uuid
      AND completed_at IS NULL
  ),
  1::bigint,
  $$resuming a note with a pending log should not create a duplicate$$
);

SELECT is(
  public.set_note_review_completion(
    current_setting('test.review_state_legacy_note_id')::uuid,
    false
  ),
  false,
  $$resuming a legacy completed note should return false$$
);

SELECT ok(
  (
    SELECT note.review_completed_at IS NULL
      AND note.next_review_at = public.kst_day_start(log.scheduled_at)
      AND log.round = 4
      AND log.completed_at IS NULL
    FROM public.notes note
    JOIN public.review_logs log
      ON log.note_id = note.id
     AND log.completed_at IS NULL
    WHERE note.id = current_setting('test.review_state_legacy_note_id')::uuid
  ),
  $$resuming a legacy completed note should create its next pending review$$
);

SELECT * FROM finish();
ROLLBACK;
