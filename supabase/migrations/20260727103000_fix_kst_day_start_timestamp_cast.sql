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
