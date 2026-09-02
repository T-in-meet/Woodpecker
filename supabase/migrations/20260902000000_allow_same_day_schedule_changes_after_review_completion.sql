-- 사용자가 노트를 완료 표시한 KST 당일에는 오늘의 미래 시각으로 복습 일정을
-- 다시 잡을 수 있다. 완료 다음 날부터는 일정 변경을 막고, 완료 당일에도 다른
-- 날짜로 옮기는 것은 허용하지 않는다.
--
-- 일정 변경 함수는 note를 먼저 잠근 뒤 review_log를 갱신한다. 완료/재시작 및
-- 복습 완료 RPC와 잠금 순서를 note -> review_log로 통일해 상태 검사와 변경 사이의
-- 경쟁 및 교착 가능성을 함께 막는다.

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
  v_note_id uuid;
  v_review_completed_at timestamptz;
  v_shifted_at timestamptz;
  v_now timestamptz := clock_timestamp();
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

  IF p_scheduled_at <= v_now THEN
    RAISE EXCEPTION 'schedule in the past';
  END IF;

  SELECT n.id, n.review_completed_at
    INTO v_note_id, v_review_completed_at
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id
  FOR UPDATE;

  IF v_note_id IS NULL THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  IF v_review_completed_at IS NOT NULL
     AND (
       public.kst_date(v_review_completed_at) <> public.kst_date(v_now)
       OR public.kst_date(p_scheduled_at) <> public.kst_date(v_now)
     ) THEN
    RAISE EXCEPTION 'completed review schedule must stay on completion day';
  END IF;

  WITH updated_pending AS (
    UPDATE public.review_logs rl
    SET scheduled_at = p_scheduled_at,
        notification_base_scheduled_at =
          COALESCE(rl.notification_base_scheduled_at, rl.scheduled_at),
        notification_claimed_at = NULL,
        notification_dispatched_at = NULL,
        notification_dispatch_failed_at = NULL,
        notification_dispatch_attempts = 0
    WHERE rl.note_id = p_note_id
      AND rl.user_id = v_user_id
      AND rl.completed_at IS NULL
      AND NOT (
        rl.notification_claimed_at IS NOT NULL
        AND rl.notification_dispatched_at IS NULL
        AND rl.notification_dispatch_failed_at IS NULL
        AND rl.notification_claimed_at
              >= v_now - public.notification_claim_stale_window()
      )
    RETURNING rl.id, rl.scheduled_at AS shifted_at
  ),
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

-- 기존 "기본 일정" RPC도 같은 완료 당일 정책을 따른다. 완료 노트에서는 복원된
-- 실제 일정이 오늘의 미래 시각일 때만 허용한다. 진행 중인 노트의 기존 동작은 유지한다.
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
  v_note_id uuid;
  v_review_completed_at timestamptz;
  v_pending_next_review_at timestamptz;
  v_shifted_at timestamptz;
  v_now timestamptz := clock_timestamp();
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

  SELECT n.id, n.review_completed_at
    INTO v_note_id, v_review_completed_at
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id
  FOR UPDATE;

  IF v_note_id IS NULL THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  UPDATE public.notes
  SET notification_time_of_day = p_time
  WHERE id = p_note_id
    AND user_id = v_user_id;

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
  SELECT min(shifted_at), min(public.kst_day_start(shifted_at))
    INTO v_shifted_at, v_pending_next_review_at
  FROM updated_pending;

  IF v_review_completed_at IS NOT NULL
     AND (
       public.kst_date(v_review_completed_at) <> public.kst_date(v_now)
       OR v_shifted_at IS NULL
       OR v_shifted_at <= v_now
       OR public.kst_date(v_shifted_at) <> public.kst_date(v_now)
     ) THEN
    RAISE EXCEPTION 'completed review schedule must stay on completion day';
  END IF;

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
