-- update_notification_schedule:
--   사용자가 다음 알림(=이번 복습 회차)의 날짜와 시각을 직접 고르는 경로.
--
--   update_notification_time_of_day가 "같은 KST 날짜에 시각만" 바꾸는 것과 달리,
--   이 함수는 날짜까지 옮긴다. 즉 이번 회차의 복습 일정 자체가 이동한다.
--   다음 회차는 complete_review_and_schedule_next가 완료 시점 기준으로 다시 잡으므로
--   여기서 이후 회차를 건드리지 않는다.
--
--   notification_base_scheduled_at에는 원래 케이던스 시각을 보존한다.
--   사용자가 "기본값"으로 되돌리면 update_notification_time_of_day(p_note_id, NULL)이
--   이 값을 그대로 복원한다.
--
--   미래 일정에는 별도 상한을 두지 않는다. 사용자는 이번 복습 회차를 3개월·1년 뒤로도
--   옮길 수 있으며, 과거 시각과 이미 선점·발송된 알림만 차단한다.
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

  -- 이미 지난 시각은 claim_due_review_logs가 다음 실행에서 바로 집어가
  -- 의도치 않게 즉시 발송할 수 있으므로 막는다.
  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'schedule in the past';
  END IF;

  UPDATE public.notes
  SET notification_time_of_day = (p_scheduled_at AT TIME ZONE 'Asia/Seoul')::time
  WHERE id = p_note_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- 이미 선점·발송된 알림은 옮길 수 없다. update_notification_time_of_day와 같은 조건.
  -- 미완료 log가 여러 건 남을 수 있으므로, 단순 RETURNING INTO(임의의 한 행)가 아니라
  -- CTE로 모아 min()을 쓴다. update_notification_time_of_day와 같은 방식이다.
  WITH updated_pending AS (
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
    RETURNING rl.scheduled_at AS shifted_at
  )
  SELECT min(shifted_at)
    INTO v_shifted_at
  FROM updated_pending;

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
