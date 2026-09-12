-- update_notification_schedule:
--   이미 발송된 알림도 다음 일정으로 다시 옮길 수 있게 한다.
--
--   지금까지는 알림이 한 번 나가면 그 회차의 일정을 영영 바꿀 수 없었다.
--   알림을 받고 "오늘은 못 하겠으니 내일로" 하는 가장 흔한 요구가 막혀 있었다.
--
--   막아야 하는 것은 "발송된 알림"이 아니라 "발송이 진행 중인 알림"이다. cron이
--   선점해 푸시를 보내는 중에 일정을 옮기면 이중 발송이 난다. 그래서 아직 결과가
--   나오지 않은 선점만 차단하고, 판정 창은 claim_due_review_logs가 쓰는 15분과
--   같은 값을 쓴다.
--
--   옮길 때는 발송 상태를 모두 초기화해 다시 무장한다. dispatched_at만 비우면
--   claimed_at과 attempts가 남아 claim_due_review_logs가 집어가지 않는다.
--
--   이미 나간 notifications 행은 지운다. cron의 upsert가 (review_log_id, type)
--   충돌 시 기존 행을 그대로 재사용하고 status·sent_at을 건드리지 않아서, 남겨두면
--   푸시는 다시 오는데 벨에는 뜨지 않는다(사용자가 이미 읽어 READ 상태).
--   지우면 다음 발송이 실제 발송 시각을 가진 새 행을 만든다.
--
--   update_notification_time_of_day에는 같은 완화를 적용하지 않는다. 그쪽은 시각을
--   base 날짜에 그대로 얹어 과거 시각이 될 수 있고, 그 상태로 재무장하면 즉시
--   재발송된다. 이 함수는 p_scheduled_at > now()를 이미 강제하므로 그 위험이 없다.
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

  IF NOT EXISTS (
    SELECT 1 FROM public.notes
    WHERE id = p_note_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- 미완료 log가 여러 건 남을 수 있으므로, 단순 RETURNING INTO(임의의 한 행)가 아니라
  -- CTE로 모아 min()을 쓴다.
  WITH updated_pending AS (
    UPDATE public.review_logs rl
    SET scheduled_at = p_scheduled_at,
        notification_base_scheduled_at =
          COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at),
        -- 다시 무장한다. 넷 중 하나라도 남으면 claim_due_review_logs가 건너뛴다.
        notification_claimed_at = NULL,
        notification_dispatched_at = NULL,
        notification_dispatch_failed_at = NULL,
        notification_dispatch_attempts = 0
    WHERE rl.note_id = p_note_id
      AND rl.user_id = v_user_id
      AND rl.completed_at IS NULL
      -- 결과가 아직 나오지 않은 선점만 막는다. 15분은 claim_due_review_logs의
      -- stale claim 판정 창과 같은 값이다.
      AND NOT (
        rl.notification_claimed_at IS NOT NULL
        AND rl.notification_dispatched_at IS NULL
        AND rl.notification_dispatch_failed_at IS NULL
        AND rl.notification_claimed_at >= now() - interval '15 minutes'
      )
    RETURNING rl.id, rl.scheduled_at AS shifted_at
  ),
  -- 데이터 변경 CTE는 주 쿼리가 참조하지 않아도 반드시 한 번 실행된다.
  cleared_notifications AS (
    DELETE FROM public.notifications n
    USING updated_pending up
    WHERE n.review_log_id = up.id
      AND n.user_id = v_user_id
      AND n.type = 'REVIEW'
    RETURNING n.id
  )
  SELECT min(shifted_at)
    INTO v_shifted_at
  FROM updated_pending;

  IF v_shifted_at IS NULL THEN
    -- 옮길 로그 자체가 없는 것과, 발송이 진행 중이라 손대지 못한 것은 다른 상황이다.
    IF EXISTS (
      SELECT 1
      FROM public.review_logs
      WHERE note_id = p_note_id
        AND user_id = v_user_id
        AND completed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'notification dispatch in progress';
    END IF;

    RAISE EXCEPTION 'no pending review log';
  END IF;

  UPDATE public.notes
  SET next_review_at = public.kst_day_start(v_shifted_at),
      notification_time_of_day =
        (p_scheduled_at AT TIME ZONE 'Asia/Seoul')::time
  WHERE id = p_note_id
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  TO authenticated;
