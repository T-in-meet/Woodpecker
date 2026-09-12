-- 완료/재시작 전이에서 알림 상태가 어긋나는 두 구멍을 막는다.
--
--   1. set_note_review_completion 재시작 분기가 보존된 pending log의 발송 상태를
--      초기화하지 않았다. 완료 표시 전에 이미 알림이 나갔다면 그 log는
--      notification_dispatched_at이 남은 채로 되살아나고, claim_due_review_logs는
--      그 컬럼이 NULL인 log만 집어가므로 다시는 알림이 가지 않는다.
--      20260901030000의 update_notification_schedule과 같은 방식으로 다시 무장한다.
--
--   2. update_notification_schedule이 notes.review_completed_at을 보지 않았다.
--      완료 노트도 pending review_log를 보존하는 설계라 completed_at IS NULL 조건만
--      으로는 걸러지지 않고, UI 가드(canChangeNotificationTime)를 우회해 액션을 직접
--      호출하면 완료 노트의 알림 일정을 되살릴 수 있었다.
--
-- 이미 어긋난 log를 일괄 보정하지는 않는다. 발송 상태만 보고는 "완료했다가 재시작한
-- log"와 "정상적으로 알림이 나간 log"를 구분할 수 없어서, 넓게 재무장하면 아직
-- 복습하지 않은 노트에 알림이 중복 발송된다.
--
-- 겸사겸사 두 함수에 세 번 복붙돼 있던 계산을 헬퍼로 뽑는다.
--   - next_review_schedule: 복습한 KST 날짜 수 -> 다음 일정
--   - notification_claim_stale_window: 선점 만료 판정 창(15분)

-- 다음 복습 일정 계산. review_interval_days와 알림 시각 적용이 한 벌로 움직이므로
-- 호출부마다 다시 쓰지 않는다. base는 알림 시각을 얹기 전 값으로,
-- notification_base_scheduled_at에 그대로 저장해 기본 케이던스를 복원할 때 쓴다.
CREATE OR REPLACE FUNCTION public.next_review_schedule(
  p_reviewed_day_count integer,
  p_notification_time_of_day time,
  p_from timestamptz
)
RETURNS TABLE (base_at timestamptz, next_at timestamptz)
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT base.at,
         CASE
           WHEN p_notification_time_of_day IS NULL THEN base.at
           ELSE public.apply_time_of_day_not_before(
             base.at,
             p_notification_time_of_day
           )
         END
  FROM (
    SELECT p_from
      + make_interval(days => public.review_interval_days(p_reviewed_day_count))
      AS at
  ) base;
$$;

-- 선점하고도 결과가 나오지 않은 발송을 언제부터 죽은 것으로 볼지.
-- claim_due_review_logs와 일정 변경·재시작 경로가 같은 값을 봐야 이중 발송이 안 난다.
CREATE OR REPLACE FUNCTION public.notification_claim_stale_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT interval '15 minutes';
$$;

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
    -- 같은 log를 다시 집어 이중 발송이 난다. 그 경우 알림은 어차피 곧 도착한다.
    --
    -- 이미 나간 notifications 행은 지운다. cron의 upsert가 (review_log_id, type)
    -- 충돌 시 기존 행을 재사용하고 status를 건드리지 않아서, 완료 표시 때 READ로
    -- 소비해둔 행을 남겨두면 푸시는 다시 오는데 벨에는 뜨지 않는다.
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
    DELETE FROM public.notifications n
    USING rearmed
    WHERE n.review_log_id = rearmed.id
      AND n.user_id = v_user_id
      AND n.type = 'REVIEW';
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

-- 완료 표시한 노트의 알림 일정은 옮길 수 없다. 완료 노트도 pending review_log를
-- 보존하므로 completed_at IS NULL 조건만으로는 걸러지지 않는다.
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

  SELECT n.id, n.review_completed_at
    INTO v_note_id, v_review_completed_at
  FROM public.notes n
  WHERE n.id = p_note_id
    AND n.user_id = v_user_id;

  IF v_note_id IS NULL THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  IF v_review_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'review already completed';
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
      -- 결과가 아직 나오지 않은 선점만 막는다.
      AND NOT (
        rl.notification_claimed_at IS NOT NULL
        AND rl.notification_dispatched_at IS NULL
        AND rl.notification_dispatch_failed_at IS NULL
        AND rl.notification_claimed_at
              >= now() - public.notification_claim_stale_window()
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

-- 같은 일정 계산을 쓰도록 완료 RPC도 헬퍼 호출로 바꾼다. 계산 결과와 나머지 동작은
-- 20260901040000과 같다.
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

  IF v_already_completed_today THEN
    -- 하루에 여러 번 완료해도 그날은 한 칸만 진행하고 일정도 옮기지 않는다.
    v_next_review_at := v_current_scheduled_at;
    v_base_next_review_at := COALESCE(
      v_current_base_scheduled_at,
      v_current_scheduled_at
    );
  ELSE
    v_reviewed_day_count := v_reviewed_day_count + 1;

    SELECT base_at, next_at
      INTO v_base_next_review_at, v_next_review_at
    FROM public.next_review_schedule(
      v_reviewed_day_count,
      v_notification_time_of_day,
      v_now
    );
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

-- 선점 만료 판정 창도 같은 헬퍼를 보게 한다. 동작은 그대로다.
CREATE OR REPLACE FUNCTION public.claim_due_review_logs(p_limit int DEFAULT 200)
RETURNS TABLE(id uuid, note_id uuid, user_id uuid, round int, scheduled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH safe_limit AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200) AS value
  ),
  dead_lettered AS (
    UPDATE public.review_logs rl
    SET notification_dispatch_failed_at = clock_timestamp()
    WHERE rl.completed_at IS NULL
      AND rl.notification_dispatched_at IS NULL
      AND rl.notification_dispatch_failed_at IS NULL
      AND rl.notification_dispatch_attempts >= 5
      AND rl.scheduled_at <= clock_timestamp()
      AND (
        rl.notification_claimed_at IS NULL
        OR rl.notification_claimed_at
             < clock_timestamp() - public.notification_claim_stale_window()
      )
      AND EXISTS (
        SELECT 1
        FROM public.notes n
        WHERE n.id = rl.note_id
          AND n.user_id = rl.user_id
          AND n.review_completed_at IS NULL
      )
    RETURNING rl.id
  ),
  due AS (
    SELECT rl.id
    FROM public.review_logs rl
    WHERE rl.completed_at IS NULL
      AND rl.notification_dispatched_at IS NULL
      AND rl.notification_dispatch_failed_at IS NULL
      AND rl.notification_dispatch_attempts < 5
      AND (
        rl.notification_claimed_at IS NULL
        OR rl.notification_claimed_at
             < clock_timestamp() - public.notification_claim_stale_window()
      )
      AND rl.scheduled_at <= clock_timestamp()
      AND EXISTS (
        SELECT 1
        FROM public.notes n
        WHERE n.id = rl.note_id
          AND n.user_id = rl.user_id
          AND n.review_completed_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dead_lettered dl
        WHERE dl.id = rl.id
      )
    ORDER BY rl.scheduled_at
    LIMIT (SELECT value FROM safe_limit)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.review_logs rl
  SET notification_claimed_at = clock_timestamp(),
      notification_dispatch_attempts = rl.notification_dispatch_attempts + 1
  FROM due
  WHERE rl.id = due.id
  RETURNING rl.id, rl.note_id, rl.user_id, rl.round, rl.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.claim_due_review_logs(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_review_logs(int)
  TO service_role;
