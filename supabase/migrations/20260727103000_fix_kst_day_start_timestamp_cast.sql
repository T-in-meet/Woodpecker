-- Ensure KST day-start conversion treats the KST date as a local timestamp.
CREATE OR REPLACE FUNCTION public.kst_day_start(ts timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (
    (ts AT TIME ZONE 'Asia/Seoul')::date
  )::timestamp AT TIME ZONE 'Asia/Seoul';
$$;

WITH next_pending AS (
  SELECT
    note_id,
    MIN(scheduled_at) AS shifted_at
  FROM public.review_logs
  WHERE completed_at IS NULL
  GROUP BY note_id
)
UPDATE public.notes AS note
SET next_review_at = public.kst_day_start(next_pending.shifted_at)
FROM next_pending
WHERE note.id = next_pending.note_id
  AND note.next_review_at IS DISTINCT FROM public.kst_day_start(
    next_pending.shifted_at
  );
