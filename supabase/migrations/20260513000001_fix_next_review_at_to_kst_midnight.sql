-- KST 자정 timestamptz 반환 헬퍼
-- kst_date()와 달리 date가 아닌 timestamptz 반환
CREATE OR REPLACE FUNCTION public.kst_day_start(ts timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT (
    (ts AT TIME ZONE 'Asia/Seoul')::date
  ) AT TIME ZONE 'Asia/Seoul';
$$;

-- create_note_with_initial_review_log:
--   notes.next_review_at → KST 자정 고정 (UI 표시용)
--   review_logs.scheduled_at → 기존 그대로 (첫 알림 시각 유지)
CREATE OR REPLACE FUNCTION public.create_note_with_initial_review_log(
  p_title text,
  p_content text,
  p_scheduled_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_note_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at is required';
  END IF;

  INSERT INTO public.notes (user_id, title, content, next_review_at)
  VALUES (v_user_id, p_title, p_content, public.kst_day_start(p_scheduled_at))
  RETURNING id INTO v_note_id;

  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (v_note_id, v_user_id, 1, p_scheduled_at);

  RETURN v_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_note_with_initial_review_log(text, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_note_with_initial_review_log(text, text, timestamptz) TO authenticated;

-- complete_review_and_schedule_next:
--   notes.next_review_at → kst_day_start(v_base_next_review_at) (날짜 마커, UI용)
--   review_logs.scheduled_at → v_next_review_at 그대로 (알림 시각 유지)
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
  v_notification_time_of_day time;
  v_base_next_review_at timestamptz;
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

  SELECT rl.round, n.review_round, n.notification_time_of_day
    INTO v_current_round, v_note_review_round, v_notification_time_of_day
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
  v_base_next_review_at := CASE v_current_round
    WHEN 1 THEN v_now + interval '3 days'
    WHEN 2 THEN v_now + interval '7 days'
    ELSE NULL
  END;

  v_next_review_at := v_base_next_review_at;

  IF v_next_review_at IS NOT NULL AND v_notification_time_of_day IS NOT NULL THEN
    v_next_review_at := public.apply_time_of_day_not_before(
      v_base_next_review_at,
      v_notification_time_of_day
    );
  END IF;

  UPDATE public.review_logs
  SET completed_at = v_now
  WHERE id = p_review_log_id
    AND note_id = p_note_id
    AND user_id = v_user_id;

  -- The bell treats SENT review notifications as actionable pending work.
  UPDATE public.notifications
  SET status = 'READ',
      read_at = COALESCE(read_at, v_now)
  WHERE review_log_id = p_review_log_id
    AND user_id = v_user_id
    AND type = 'REVIEW'
    AND status = 'SENT';

  UPDATE public.notes
  SET review_round = v_current_round,
      next_review_at = public.kst_day_start(v_next_review_at)
  WHERE id = p_note_id
    AND user_id = v_user_id;

  IF v_current_round < 3 THEN
    INSERT INTO public.review_logs (
      note_id,
      user_id,
      round,
      scheduled_at,
      notification_base_scheduled_at
    )
    VALUES (
      p_note_id,
      v_user_id,
      v_current_round + 1,
      v_next_review_at,
      CASE
        WHEN v_notification_time_of_day IS NULL THEN NULL
        ELSE v_base_next_review_at
      END
    );
  END IF;

  RETURN p_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_review_and_schedule_next(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_review_and_schedule_next(uuid, uuid) TO authenticated;

-- update_notification_time_of_day:
--   notes.next_review_at → pending log base의 KST 자정으로 유지
--   (기존: shifted scheduled_at을 그대로 복사하던 방식 변경)
CREATE OR REPLACE FUNCTION public.update_notification_time_of_day(
  p_note_id uuid,
  p_time time DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_pending_next_review_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT email_confirmed_at
    INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  UPDATE public.notes
  SET notification_time_of_day = p_time
  WHERE id = p_note_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  WITH updated_pending AS (
    UPDATE public.review_logs rl
    SET scheduled_at = CASE
          WHEN p_time IS NULL THEN
            COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at)
          ELSE
            public.apply_time_of_day_not_before(
              COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at),
              p_time
            )
        END,
        notification_base_scheduled_at = CASE
          WHEN p_time IS NULL THEN NULL
          ELSE COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at)
        END
    WHERE rl.note_id = p_note_id
      AND rl.user_id = v_user_id
      AND rl.completed_at IS NULL
      AND rl.notification_claimed_at IS NULL
      AND rl.notification_dispatched_at IS NULL
      AND rl.notification_dispatch_failed_at IS NULL
    RETURNING rl.scheduled_at AS shifted_at
  )
  SELECT min(public.kst_day_start(shifted_at))
    INTO v_pending_next_review_at
  FROM updated_pending;

  IF v_pending_next_review_at IS NOT NULL THEN
    UPDATE public.notes
    SET next_review_at = v_pending_next_review_at
    WHERE id = p_note_id
      AND user_id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_time_of_day(uuid, time)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_time_of_day(uuid, time)
  TO authenticated;

-- 기존 pending 데이터 backfill:
--   완료되지 않은 review_log의 scheduled_at(실제 알림 발송 예정 시각) 기준으로
--   notes.next_review_at을 KST 자정으로 보정
WITH next_pending AS (
  SELECT note_id,
         MIN(scheduled_at) AS shifted_at
  FROM public.review_logs
  WHERE completed_at IS NULL
  GROUP BY note_id
)
UPDATE public.notes n
SET next_review_at = public.kst_day_start(np.shifted_at)
FROM next_pending np
WHERE n.id = np.note_id
  AND n.next_review_at IS DISTINCT FROM public.kst_day_start(np.shifted_at);
