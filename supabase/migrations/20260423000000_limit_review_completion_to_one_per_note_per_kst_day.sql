CREATE OR REPLACE FUNCTION public.kst_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (ts AT TIME ZONE 'Asia/Seoul')::date;
$$;

DO $$
DECLARE
  v_duplicate_completion_count integer;
  v_duplicate_completion_keys text;
BEGIN
  SELECT count(*)
    INTO v_duplicate_completion_count
  FROM (
    SELECT rl.note_id, public.kst_date(rl.completed_at) AS completed_kst_date
    FROM public.review_logs rl
    WHERE rl.completed_at IS NOT NULL
    GROUP BY rl.note_id, public.kst_date(rl.completed_at)
    HAVING count(*) > 1
  ) duplicate_completed_reviews;

  SELECT string_agg(
      duplicate_completed_reviews.note_id::text || ':' || duplicate_completed_reviews.completed_kst_date::text,
      ', '
      ORDER BY duplicate_completed_reviews.note_id::text, duplicate_completed_reviews.completed_kst_date::text
    )
    INTO v_duplicate_completion_keys
  FROM (
    SELECT rl.note_id, public.kst_date(rl.completed_at) AS completed_kst_date
    FROM public.review_logs rl
    WHERE rl.completed_at IS NOT NULL
    GROUP BY rl.note_id, public.kst_date(rl.completed_at)
    HAVING count(*) > 1
    ORDER BY rl.note_id, public.kst_date(rl.completed_at)
    LIMIT 10
  ) duplicate_completed_reviews;

  -- Fail before the index build so operators can identify the rows that need cleanup.
  IF v_duplicate_completion_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot add review_logs_one_completed_per_note_per_kst_day_idx while duplicate completed review_logs exist.',
      DETAIL = format(
        'Found %s note_id/KST-date pair(s) with more than one completed review_log. Sample key(s): %s',
        v_duplicate_completion_count,
        coalesce(v_duplicate_completion_keys, '(none)')
      ),
      HINT = 'Deduplicate rows where completed_at IS NOT NULL so each note_id has at most one completed review_log per KST date, then rerun this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS review_logs_one_completed_per_note_per_kst_day_idx
ON public.review_logs (note_id, public.kst_date(completed_at))
WHERE completed_at IS NOT NULL;

DROP POLICY IF EXISTS "review_logs_insert_own" ON public.review_logs;

CREATE POLICY "review_logs_insert_own"
ON public.review_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND completed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.notes
    WHERE notes.id = review_logs.note_id
      AND notes.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.complete_review_and_schedule_next(
  p_note_id uuid,
  p_review_log_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
-- review_logs intentionally has no UPDATE policy, so this RPC performs the
-- ownership check explicitly and updates the locked row within the same transaction.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_current_round integer;
  v_note_review_round integer;
  v_next_review_at timestamptz;
  -- Use wall-clock time so completion and the next schedule share the same actual timestamp.
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- DB-level guard mirroring the app-level email verification redirects so that
  -- direct RPC callers cannot bypass the "verified email required" policy.
  SELECT email_confirmed_at
    INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF p_note_id IS NULL OR p_review_log_id IS NULL THEN
    RAISE EXCEPTION 'note_id and review_log_id are required';
  END IF;

  SELECT rl.round, n.review_round
    INTO v_current_round, v_note_review_round
  FROM public.review_logs rl
  JOIN public.notes n
    ON n.id = rl.note_id
  WHERE rl.id = p_review_log_id
    AND rl.note_id = p_note_id
    AND rl.user_id = v_user_id
    AND rl.completed_at IS NULL
    AND n.user_id = v_user_id
  FOR UPDATE OF rl, n;

  IF v_current_round IS NULL THEN
    RAISE EXCEPTION 'pending review log not found';
  END IF;

  IF v_current_round <> v_note_review_round + 1 THEN
    RAISE EXCEPTION 'review log round does not match current note state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.review_logs
    WHERE note_id = p_note_id
      AND user_id = v_user_id
      AND completed_at IS NOT NULL
      AND public.kst_date(completed_at) = public.kst_date(v_now)
  ) THEN
    RAISE EXCEPTION 'daily review completion limit reached'
      USING ERRCODE = 'WP001';
  END IF;

  -- Keep this in sync with REVIEW_INTERVALS_DAYS ([1, 3, 7]) so callers
  -- cannot bypass the spaced-repetition cadence by supplying arbitrary dates.
  v_next_review_at := CASE v_current_round
    WHEN 1 THEN v_now + interval '3 days'
    WHEN 2 THEN v_now + interval '7 days'
    ELSE NULL
  END;

  UPDATE public.review_logs
  SET completed_at = v_now
  WHERE id = p_review_log_id
    AND note_id = p_note_id
    AND user_id = v_user_id;

  UPDATE public.notes
  SET review_round = v_current_round,
      next_review_at = v_next_review_at
  WHERE id = p_note_id
    AND user_id = v_user_id;

  IF v_current_round < 3 THEN
    INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
    VALUES (p_note_id, v_user_id, v_current_round + 1, v_next_review_at);
  END IF;

  RETURN p_note_id;
END;
$$;
