CREATE OR REPLACE FUNCTION public.claim_due_review_logs(p_limit int DEFAULT 200)
RETURNS TABLE(id uuid, note_id uuid, user_id uuid, round int, scheduled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH safe_limit AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200) AS value
  ),
  dead_lettered AS (
    UPDATE public.review_logs rl
    SET notification_dispatch_failed_at = clock_timestamp()
    WHERE rl.completed_at IS NULL
      AND rl.notification_dispatched_at IS NULL
      AND rl.notification_dispatch_failed_at IS NULL
      AND rl.notification_dispatch_attempts >= 5
      AND rl.scheduled_at <= clock_timestamp()
      AND (
        rl.notification_claimed_at IS NULL
        OR rl.notification_claimed_at < clock_timestamp() - interval '15 minutes'
      )
    RETURNING rl.id
  ),
  due AS (
    SELECT rl.id
    FROM public.review_logs rl
    WHERE rl.completed_at IS NULL
      AND rl.notification_dispatched_at IS NULL
      AND rl.notification_dispatch_failed_at IS NULL
      AND rl.notification_dispatch_attempts < 5
      AND (
        rl.notification_claimed_at IS NULL
        OR rl.notification_claimed_at < clock_timestamp() - interval '15 minutes'
      )
      AND rl.scheduled_at <= clock_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM dead_lettered dl
        WHERE dl.id = rl.id
      )
    ORDER BY rl.scheduled_at
    LIMIT (SELECT value FROM safe_limit)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.review_logs rl
  SET notification_claimed_at = clock_timestamp(),
      notification_dispatch_attempts = rl.notification_dispatch_attempts + 1
  FROM due
  WHERE rl.id = due.id
  RETURNING rl.id, rl.note_id, rl.user_id, rl.round, rl.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.claim_due_review_logs(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_review_logs(int)
  TO service_role;
