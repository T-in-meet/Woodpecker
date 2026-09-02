-- 재시작 시 벨 알림 복구를 set_note_review_completion 안에서 끝낸다.
--
--   20260901050000의 재시작 분기는 pending log를 재무장한 뒤, 그 log에 딸린
--   notifications 행을 지운다. 그런데 DELETE가 rearmed CTE에 USING으로 묶여 있어
--   "재무장에 성공한 경우"에만 실행된다. 발송이 진행 중이라 재무장을 건너뛰면
--   완료 표시 때 READ로 소비해둔 행이 그대로 남고, 다음 claim에서 cron의 upsert가
--   충돌 시 status를 건드리지 않으므로 푸시는 다시 나가는데 벨에는 뜨지 않는다.
--
--   이 구멍을 cron 쪽에서 "READ면 다시 SENT로" 되돌려 막으려 하면, 발송 재시도 중에
--   사용자가 직접 확인한 알림까지 안 읽음으로 되살아난다. cron은 그 READ가
--   완료 표시 때문인지 사용자의 확인 때문인지 구분할 수 없다. 완료 -> 재시작
--   전이를 아는 곳은 이 함수뿐이므로 여기서 마무리한다.
--
--   재무장 여부로 갈라 처리한다.
--     재무장함   — 행을 지운다. 다음 발송이 실제 발송 시각을 가진 새 행을 만든다.
--     재무장 못함 — 진행 중인 발송이 그 행 id를 그대로 쓰고 있으므로 지우면 안 된다.
--                   (지운 뒤 그 발송이 성공하면 로그는 dispatched로 마킹되어 다시
--                   claim되지 않고, 벨에는 영영 아무것도 남지 않는다.)
--                   대신 완료 표시 때 소비해둔 READ만 SENT로 되돌려 다시 보이게 한다.
--                   sent_at은 실제로 나간 시각이므로 건드리지 않는다.
--
--   나머지 동작은 20260901050000과 같다.
CREATE OR REPLACE FUNCTION public.set_note_review_completion(
  p_note_id uuid,
  p_completed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_locked_note_id uuid;
  v_review_round integer;
  v_notification_time_of_day time;
  v_review_completed_at timestamptz;
  v_pending_review_log_id uuid;
  v_pending_scheduled_at timestamptz;
  v_pending_log_rearmed boolean;
  v_reviewed_day_count integer;
  v_base_next_review_at timestamptz;
  v_next_review_at timestamptz;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_note_id IS NULL OR p_completed IS NULL THEN
    RAISE EXCEPTION 'note_id and completed are required';
  END IF;

  SELECT email_confirmed_at
    INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  -- complete_review_and_schedule_next와 같은 순서로 note를 먼저 잠근다.
  SELECT n.id,
         n.review_round,
         n.notification_time_of_day,
         n.review_completed_at
    INTO v_locked_note_id,
         v_review_round,
         v_notification_time_of_day,
         v_review_completed_at
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id
  FOR UPDATE;

  IF v_locked_note_id IS NULL THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- desired-state setter이므로 이미 진행 중인 노트의 재시작 요청은 no-op이다.
  -- stale 탭이나 요청 재전송이 발송 완료 상태를 다시 무장해 중복 알림을 만들지
  -- 않도록, 실제 완료 -> 진행 중 전이에서만 아래 pending log를 건드린다.
  IF NOT p_completed AND v_review_completed_at IS NULL THEN
    RETURN false;
  END IF;

  IF p_completed THEN
    UPDATE public.notes
    SET review_completed_at = COALESCE(review_completed_at, v_now)
    WHERE id = p_note_id
      AND user_id = v_user_id;

    -- 완료 노트에는 더 이상 처리할 복습 알림이 없으므로 벨에서도 함께 소비한다.
    UPDATE public.notifications
    SET status = 'READ',
        read_at = COALESCE(read_at, v_now)
    WHERE note_id = p_note_id
      AND user_id = v_user_id
      AND type = 'REVIEW'
      AND status = 'SENT';

    RETURN true;
  END IF;

  -- note당 pending log는 review_logs_one_pending_per_note_idx가 최대 1건으로 제한한다.
  SELECT rl.id, rl.scheduled_at
    INTO v_pending_review_log_id, v_pending_scheduled_at
  FROM public.review_logs rl
  WHERE rl.note_id = p_note_id
    AND rl.user_id = v_user_id
    AND rl.completed_at IS NULL
  FOR UPDATE;

  IF v_pending_review_log_id IS NULL THEN
    -- 구 3회 자동 완료 노트에는 이어받을 pending log가 없다. 완료한 서로 다른 KST
    -- 날짜 수에 맞는 다음 간격으로 새 일정을 만들어 재시작 가능 상태를 복구한다.
    SELECT count(DISTINCT public.kst_date(completed_at))
      INTO v_reviewed_day_count
    FROM public.review_logs
    WHERE note_id = p_note_id
      AND user_id = v_user_id
      AND completed_at IS NOT NULL;

    SELECT base_at, next_at
      INTO v_base_next_review_at, v_next_review_at
    FROM public.next_review_schedule(
      v_reviewed_day_count,
      v_notification_time_of_day,
      v_now
    );

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
      v_review_round + 1,
      v_next_review_at,
      CASE
        WHEN v_notification_time_of_day IS NULL THEN NULL
        ELSE v_base_next_review_at
      END
    );

    v_pending_scheduled_at := v_next_review_at;
  ELSE
    -- 보존된 log는 완료 표시 전에 이미 알림이 나갔을 수 있다. 발송 상태를 그대로
    -- 두면 claim_due_review_logs가 영영 집어가지 않아 알림 없이 연체된다.
    -- 새로 만드는 log가 기본값으로 무장돼 있는 것과 상태를 맞춘다.
    --
    -- 결과가 아직 나오지 않은 선점은 건드리지 않는다. 초기화하면 다른 cron 실행이
    -- 같은 log를 다시 집어 이중 발송이 난다.
    WITH rearmed AS (
      UPDATE public.review_logs rl
      SET notification_claimed_at = NULL,
          notification_dispatched_at = NULL,
          notification_dispatch_failed_at = NULL,
          notification_dispatch_attempts = 0
      WHERE rl.id = v_pending_review_log_id
        AND NOT (
          rl.notification_claimed_at IS NOT NULL
          AND rl.notification_dispatched_at IS NULL
          AND rl.notification_dispatch_failed_at IS NULL
          AND rl.notification_claimed_at
                >= now() - public.notification_claim_stale_window()
        )
      RETURNING rl.id
    )
    SELECT EXISTS (SELECT 1 FROM rearmed)
      INTO v_pending_log_rearmed;

    IF v_pending_log_rearmed THEN
      -- 이미 나간 notifications 행은 지운다. cron의 upsert가 (review_log_id, type)
      -- 충돌 시 기존 행을 재사용하고 status를 건드리지 않아서, 완료 표시 때 READ로
      -- 소비해둔 행을 남겨두면 푸시는 다시 오는데 벨에는 뜨지 않는다.
      DELETE FROM public.notifications n
      WHERE n.review_log_id = v_pending_review_log_id
        AND n.user_id = v_user_id
        AND n.type = 'REVIEW';
    ELSE
      -- 발송이 진행 중이라 재무장하지 못했다. 그 발송이 이 행의 id를 그대로 쓰고
      -- 있으므로 지우지 않는다. 지운 뒤 발송이 성공하면 로그는 dispatched로
      -- 마킹되어 다시 claim되지 않고 벨에는 아무것도 남지 않는다.
      -- 완료 표시 때 소비해둔 READ만 되돌려 다시 보이게 한다.
      UPDATE public.notifications n
      SET status = 'SENT',
          read_at = NULL
      WHERE n.review_log_id = v_pending_review_log_id
        AND n.user_id = v_user_id
        AND n.type = 'REVIEW'
        AND n.status = 'READ';
    END IF;
  END IF;

  UPDATE public.notes
  SET review_completed_at = NULL,
      next_review_at = public.kst_day_start(v_pending_scheduled_at)
  WHERE id = p_note_id
    AND user_id = v_user_id;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.set_note_review_completion(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_note_review_completion(uuid, boolean)
  TO authenticated;
