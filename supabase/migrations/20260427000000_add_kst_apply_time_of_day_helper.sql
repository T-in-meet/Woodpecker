CREATE OR REPLACE FUNCTION public.apply_time_of_day(ts timestamptz, t time)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (
    (ts AT TIME ZONE 'Asia/Seoul')::date
    + t
  ) AT TIME ZONE 'Asia/Seoul';
$$;

CREATE OR REPLACE FUNCTION public.apply_time_of_day_not_before(ts timestamptz, t time)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH shifted AS (
    SELECT public.apply_time_of_day(ts, t) AS scheduled_at
  )
  SELECT CASE
    WHEN shifted.scheduled_at >= ts THEN shifted.scheduled_at
    ELSE public.apply_time_of_day(ts + interval '1 day', t)
  END
  FROM shifted;
$$;
