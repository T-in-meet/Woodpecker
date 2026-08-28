-- update_notification_schedule:
--   사용자가 달력에서 다음 알림(=이번 복습 회차)의 날짜와 시각을 직접 고르는 경로.
--
--   update_notification_time_of_day가 "같은 KST 날짜에 시각만" 바꾸는 것과 달리,
--   이 함수는 날짜까지 옮긴다. 즉 이번 회차의 복습 일정 자체가 이동한다.
--   다음 회차는 complete_review_and_schedule_next가 완료 시점 기준으로 다시 잡으므로
--   여기서 이후 회차를 건드리지 않는다.
--
--   notification_base_scheduled_at에는 원래 케이던스 시각을 보존한다.
--   사용자가 "기본값"으로 되돌리면 update_notification_time_of_day(p_note_id, NULL)이
--   이 값을 그대로 복원한다.
CREATE OR REPLACE FUNCTION public.update_notification_schedule(
  p_note_id uuid,
  p_scheduled_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_target_date date;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_shifted_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'schedule required';
  END IF;

  SELECT email_confirmed_at
    INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  -- 클라이언트 달력의 disabled 범위를 서버에서 다시 확인한다.
  v_target_date := (p_scheduled_at AT TIME ZONE 'Asia/Seoul')::date;

  IF v_target_date < v_today OR v_target_date > v_today + 30 THEN
    RAISE EXCEPTION 'schedule out of range';
  END IF;

  UPDATE public.notes
  SET notification_time_of_day = (p_scheduled_at AT TIME ZONE 'Asia/Seoul')::time
  WHERE id = p_note_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- 이미 선점·발송된 알림은 옮길 수 없다. update_notification_time_of_day와 같은 조건.
  UPDATE public.review_logs rl
  SET scheduled_at = p_scheduled_at,
      notification_base_scheduled_at =
        COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at)
  WHERE rl.note_id = p_note_id
    AND rl.user_id = v_user_id
    AND rl.completed_at IS NULL
    AND rl.notification_claimed_at IS NULL
    AND rl.notification_dispatched_at IS NULL
    AND rl.notification_dispatch_failed_at IS NULL
  RETURNING rl.scheduled_at INTO v_shifted_at;

  IF v_shifted_at IS NULL THEN
    RAISE EXCEPTION 'no pending review log';
  END IF;

  UPDATE public.notes
  SET next_review_at = public.kst_day_start(v_shifted_at)
  WHERE id = p_note_id
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  TO authenticated;
