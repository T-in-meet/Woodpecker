-- 완료 당일 일정 변경은 복습을 다시 시작시킨다.
--
--   20260902000000이 완료 표시한 KST 당일에 한해 오늘의 미래 시각으로 일정을 다시
--   잡을 수 있게 했지만, review_completed_at을 그대로 둬서 그 일정에는 알림이 영영
--   나가지 않았다. claim_due_review_logs가 `n.review_completed_at IS NULL`인 노트만
--   집어가고, cron 라우트도 발송 직전에 완료 노트를 걸러내기 때문이다.
--   사용자는 "오늘 21:00에 알림을 보냅니다"라는 성공 안내를 받고도 푸시·벨 알림을
--   받지 못했고, 일정을 옮기면서 지운 기존 알림 행까지 잃었다.
--
--   다음 복습 시각을 다시 정하는 것은 "아직 이 노트를 끝내지 않았다"는 뜻이므로,
--   같은 트랜잭션에서 완료 표시를 해제해 진행 중 상태로 되돌린다. 일정 변경 함수는
--   이미 review_log를 재무장하므로, 완료 표시만 풀리면 예정 시각에 정상 발송된다.
--   "완료 다음 날부터는 일정을 바꿀 수 없다"는 제약은 그대로다 — 그 뒤에 다시
--   복습하려면 '복습 다시 시작'을 쓴다.
--
--   진행 중인 노트에서는 review_completed_at이 이미 NULL이라 아무 것도 바뀌지 않는다.

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

  -- 완료 표시를 해제해 다시 진행 중으로 돌린다. 이 값이 남아 있으면 방금 옮긴
  -- 일정이 와도 claim_due_review_logs가 로그를 집어가지 않아 알림이 나가지 않는다.
  UPDATE public.notes
  SET next_review_at = public.kst_day_start(v_shifted_at),
      notification_time_of_day =
        (p_scheduled_at AT TIME ZONE 'Asia/Seoul')::time,
      review_completed_at = NULL
  WHERE id = p_note_id
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_schedule(uuid, timestamptz)
  TO authenticated;

-- "기본 일정" 경로도 같다. 완료 당일 정책을 통과했다는 것은 복원된 일정이 오늘의
-- 미래 시각이라는 뜻이므로, 그 일정이 실제로 발송되도록 완료 표시를 함께 푼다.
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
    SET next_review_at = v_pending_next_review_at,
        review_completed_at = NULL
    WHERE id = p_note_id
      AND user_id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_time_of_day(uuid, time)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_time_of_day(uuid, time)
  TO authenticated;
