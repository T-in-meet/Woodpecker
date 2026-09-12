-- 자율 완료/재시작 상태 전이를 DB에서 원자적으로 처리한다.
--
-- 20260901010000~020000 적용 뒤에는 완료 노트도 pending review_log를 보존한다.
-- 그러나 기존 3회 자동 완료 노트에는 pending log가 없어서 완료를 해제해도 복습을
-- 다시 시작할 수 없었고, notes만 직접 갱신하는 경로는 SENT 알림을 남겼다.
--
-- 이 마이그레이션은 이미 적용된 이력을 수정하지 않고 다음을 보정한다.
--   1. 완료/재시작 전용 RPC를 추가한다.
--   2. 완료 표시한 노트를 complete_review_and_schedule_next가 소비하지 못하게 한다.
--   3. 이미 발생한 재시작 불가 상태와 완료 노트의 SENT 알림을 한 번 정리한다.

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
  v_pending_review_log_id uuid;
  v_pending_scheduled_at timestamptz;
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
  SELECT n.id, n.review_round, n.notification_time_of_day
    INTO v_locked_note_id, v_review_round, v_notification_time_of_day
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id
  FOR UPDATE;

  IF v_locked_note_id IS NULL THEN
    RAISE EXCEPTION 'note not found';
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

    v_base_next_review_at := v_now
      + make_interval(days => public.review_interval_days(v_reviewed_day_count));
    v_next_review_at := v_base_next_review_at;

    IF v_notification_time_of_day IS NOT NULL THEN
      v_next_review_at := public.apply_time_of_day_not_before(
        v_base_next_review_at,
        v_notification_time_of_day
      );
    END IF;

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

-- 완료 표시한 노트는 직접 RPC를 호출하거나 오래 열린 탭에서 완료할 수 없어야 한다.
-- note -> review_log 순서로 잠가 set_note_review_completion과 잠금 순서를 통일한다.
CREATE OR REPLACE FUNCTION public.complete_review_and_schedule_next(
  p_note_id uuid,
  p_review_log_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_locked_note_id uuid;
  v_current_round integer;
  v_current_scheduled_at timestamptz;
  v_current_base_scheduled_at timestamptz;
  v_note_review_round integer;
  v_notification_time_of_day time;
  v_review_completed_at timestamptz;
  v_already_completed_today boolean;
  v_reviewed_day_count integer;
  v_base_next_review_at timestamptz;
  v_next_review_at timestamptz;
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

  IF p_note_id IS NULL OR p_review_log_id IS NULL THEN
    RAISE EXCEPTION 'note_id and review_log_id are required';
  END IF;

  SELECT n.id,
         n.review_round,
         n.notification_time_of_day,
         n.review_completed_at
    INTO v_locked_note_id,
         v_note_review_round,
         v_notification_time_of_day,
         v_review_completed_at
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id
  FOR UPDATE;

  IF v_locked_note_id IS NULL THEN
    -- 소유권이 없는 note와 log 존재 여부를 구분해 노출하지 않는다.
    RAISE EXCEPTION 'pending review log not found';
  END IF;

  IF v_review_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'review already completed';
  END IF;

  SELECT rl.round,
         rl.scheduled_at,
         rl.notification_base_scheduled_at
    INTO v_current_round,
         v_current_scheduled_at,
         v_current_base_scheduled_at
  FROM public.review_logs rl
  WHERE rl.id = p_review_log_id
    AND rl.note_id = p_note_id
    AND rl.user_id = v_user_id
    AND rl.completed_at IS NULL
  FOR UPDATE;

  IF v_current_round IS NULL THEN
    RAISE EXCEPTION 'pending review log not found';
  END IF;

  IF v_current_round <> v_note_review_round + 1 THEN
    RAISE EXCEPTION 'review log round does not match current note state';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.review_logs
    WHERE note_id = p_note_id
      AND user_id = v_user_id
      AND completed_at IS NOT NULL
      AND public.kst_date(completed_at) = public.kst_date(v_now)
  )
    INTO v_already_completed_today;

  SELECT count(DISTINCT public.kst_date(completed_at))
    INTO v_reviewed_day_count
  FROM public.review_logs
  WHERE note_id = p_note_id
    AND user_id = v_user_id
    AND completed_at IS NOT NULL;

  IF NOT v_already_completed_today THEN
    v_reviewed_day_count := v_reviewed_day_count + 1;
  END IF;

  IF v_already_completed_today THEN
    v_next_review_at := v_current_scheduled_at;
    v_base_next_review_at := COALESCE(
      v_current_base_scheduled_at,
      v_current_scheduled_at
    );
  ELSE
    v_base_next_review_at := v_now
      + make_interval(days => public.review_interval_days(v_reviewed_day_count));
    v_next_review_at := v_base_next_review_at;

    IF v_notification_time_of_day IS NOT NULL THEN
      v_next_review_at := public.apply_time_of_day_not_before(
        v_base_next_review_at,
        v_notification_time_of_day
      );
    END IF;
  END IF;

  UPDATE public.review_logs
  SET completed_at = v_now
  WHERE id = p_review_log_id
    AND note_id = p_note_id
    AND user_id = v_user_id;

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

  RETURN p_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_review_and_schedule_next(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_review_and_schedule_next(uuid, uuid)
  TO authenticated;

-- 이미 자율 완료된 노트에 남은 기존 복습 알림을 한 번 정리한다.
UPDATE public.notifications notification
SET status = 'READ',
    read_at = COALESCE(notification.read_at, clock_timestamp())
FROM public.notes note
WHERE notification.note_id = note.id
  AND notification.user_id = note.user_id
  AND notification.type = 'REVIEW'
  AND notification.status = 'SENT'
  AND note.review_completed_at IS NOT NULL;

-- 적용된 이전 버전에서 이미 "복습 다시 시작"을 눌러 완료 플래그만 해제된 노트를
-- 복구한다. 아직 완료 상태인 레거시 노트는 사용자가 재시작할 때 RPC가 처리한다.
WITH repair_clock AS (
  SELECT clock_timestamp() AS now_at
),
repair_candidates AS (
  SELECT note.id,
         note.user_id,
         note.review_round,
         note.notification_time_of_day,
         repair_clock.now_at
           + make_interval(
               days => public.review_interval_days(
                 (
                   SELECT count(DISTINCT public.kst_date(log.completed_at))
                   FROM public.review_logs log
                   WHERE log.note_id = note.id
                     AND log.user_id = note.user_id
                     AND log.completed_at IS NOT NULL
                 )::integer
               )
             ) AS base_next_review_at
  FROM public.notes note
  CROSS JOIN repair_clock
  WHERE note.review_completed_at IS NULL
    AND note.next_review_at IS NULL
    AND note.review_round >= 3
    AND NOT EXISTS (
      SELECT 1
      FROM public.review_logs pending
      WHERE pending.note_id = note.id
        AND pending.user_id = note.user_id
        AND pending.completed_at IS NULL
    )
  FOR UPDATE OF note
),
repair_schedules AS (
  SELECT candidate.*,
         CASE
           WHEN candidate.notification_time_of_day IS NULL
             THEN candidate.base_next_review_at
           ELSE public.apply_time_of_day_not_before(
             candidate.base_next_review_at,
             candidate.notification_time_of_day
           )
         END AS next_review_at
  FROM repair_candidates candidate
),
inserted_logs AS (
  INSERT INTO public.review_logs (
    note_id,
    user_id,
    round,
    scheduled_at,
    notification_base_scheduled_at
  )
  SELECT schedule.id,
         schedule.user_id,
         schedule.review_round + 1,
         schedule.next_review_at,
         CASE
           WHEN schedule.notification_time_of_day IS NULL THEN NULL
           ELSE schedule.base_next_review_at
         END
  FROM repair_schedules schedule
  RETURNING note_id, scheduled_at
)
UPDATE public.notes note
SET next_review_at = public.kst_day_start(inserted.scheduled_at)
FROM inserted_logs inserted
WHERE note.id = inserted.note_id;
