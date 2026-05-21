-- update_notification_time_of_day:
--   수동 알림 시간 변경 시 day-shift 제거.
--   apply_time_of_day_not_before는 complete_review_and_schedule_next에서
--   "복습 간격 단축 방지" 용도로 필요하지만, 사용자가 직접 알림 시간을 바꿀 때는
--   base의 KST 날짜에 그대로 시간만 적용해야 함(다음 날로 미루지 않음).
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
            public.apply_time_of_day(
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
