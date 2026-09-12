-- 복습 완료 전후의 일정 계산과 알림 상태 전이를 한 번에 정리한다.
--
--   20260901050000까지 적용한 뒤 드러난 세 가지를 함께 고친다. 넷 다 함수 재정의뿐이고
--   데이터 보정은 없다.
--
--   1. 완료 당일 일정 변경이 복습을 다시 시작시키지 않았다.
--      완료 표시한 KST 당일에 한해 오늘의 미래 시각으로 일정을 다시 잡을 수 있게
--      하면서 review_completed_at을 그대로 뒀더니, claim_due_review_logs가
--      `n.review_completed_at IS NULL`인 노트만 집어가서 그 일정에는 알림이 영영
--      나가지 않았다. 사용자는 "오늘 21:00에 알림을 보냅니다"라는 성공 안내를 받고도
--      푸시·벨 알림을 받지 못했고, 일정을 옮기면서 지운 기존 알림 행까지 잃었다.
--      다음 복습 시각을 다시 정하는 것은 "아직 이 노트를 끝내지 않았다"는 뜻이므로
--      같은 트랜잭션에서 완료 표시를 해제한다.
--      "완료 다음 날부터는 일정을 바꿀 수 없다"는 제약은 그대로다 — 그 뒤에 다시
--      복습하려면 '복습 다시 시작'을 쓴다.
--
--   2. 같은 날 다시 완료하면 다음 일정이 과거로 잡힐 수 있었다.
--      complete_review_and_schedule_next는 그날 이미 완료한 경우 방금 소비한 로그의
--      scheduled_at을 그대로 물려준다. 케이던스를 하루에 여러 번 완료했다고 뒤로
--      밀지 않기 위한 처리인데, 1번으로 당일 일정 변경이 열리면서 물려받는 값이 이미
--      지난 시각일 수 있게 됐다.
--        D일 10:00 완료 -> 다음 로그 L2가 D+1로 생성
--        사용자가 L2를 D일 21:00으로 옮김 (미래 시각이라 허용된다)
--        D일 21:00 알림을 받고 다시 완료 -> 다음 로그가 D일 21:00으로 INSERT
--      그러면 notes.next_review_at이 오늘로 잡혀 방금 끝낸 노트가 즉시 다시 '오늘
--      복습'으로 뜨고, 다음 cron 실행이 그 로그를 바로 집어가 push를 한 번 더 보낸다.
--
--   3. 재시작 시 벨 알림이 복구되지 않는 경로가 남아 있었다.
--      20260901050000의 재시작 분기는 pending log를 재무장한 뒤 그 log에 딸린
--      notifications 행을 지우는데, DELETE가 rearmed CTE에 USING으로 묶여 있어
--      "재무장에 성공한 경우"에만 실행된다. 발송이 진행 중이라 재무장을 건너뛰면
--      완료 표시 때 READ로 소비해둔 행이 그대로 남고, 다음 claim에서 cron의 upsert가
--      충돌 시 status를 건드리지 않으므로 푸시는 다시 나가는데 벨에는 뜨지 않는다.
--      이 구멍을 cron 쪽에서 "READ면 다시 SENT로" 되돌려 막으려 하면, 발송 재시도 중에
--      사용자가 직접 확인한 알림까지 안 읽음으로 되살아난다. cron은 그 READ가 완료
--      표시 때문인지 사용자의 확인 때문인지 구분할 수 없다. 완료 -> 재시작 전이를
--      아는 곳은 set_note_review_completion뿐이므로 거기서 마무리한다.
--
--   일정 변경 함수는 note를 먼저 잠근 뒤 review_log를 갱신한다. 완료/재시작 및 복습
--   완료 RPC와 잠금 순서를 note -> review_log로 통일해 상태 검사와 변경 사이의 경쟁 및
--   교착 가능성을 함께 막는다.

-- 1) 복습 완료. 같은 날 재완료가 다음 일정을 과거로 잡지 않게 한다.
--    물려받을 일정이 아직 미래일 때만 그대로 쓰고, 이미 지났으면 지금을 기준으로 다시
--    잡는다. 이때 복습한 날짜 수는 늘리지 않으므로(오늘 몫은 첫 완료에서 이미 소비했다)
--    케이던스는 그대로다 — 첫 완료가 쓴 것과 같은 간격을 쓴다.
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

  IF v_already_completed_today AND v_current_scheduled_at > v_now THEN
    -- 하루에 여러 번 완료해도 그날은 한 칸만 진행하고 일정도 옮기지 않는다.
    v_next_review_at := v_current_scheduled_at;
    v_base_next_review_at := COALESCE(
      v_current_base_scheduled_at,
      v_current_scheduled_at
    );
  ELSIF v_already_completed_today THEN
    -- 물려받을 일정이 이미 지났다. 그대로 쓰면 과거 시각의 pending log가 생겨
    -- 다음 cron 실행에서 즉시 재발송된다. 오늘 몫은 이미 소비했으므로 날짜 수는
    -- 늘리지 않고, 지금을 기준으로만 같은 간격을 다시 얹는다.
    SELECT base_at, next_at
      INTO v_base_next_review_at, v_next_review_at
    FROM public.next_review_schedule(
      v_reviewed_day_count,
      v_notification_time_of_day,
      v_now
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

-- 2) 자율 완료/재시작. 재시작 시 벨 알림 복구를 재무장 여부로 갈라 처리한다.
--      재무장함   — 행을 지운다. 다음 발송이 실제 발송 시각을 가진 새 행을 만든다.
--      재무장 못함 — 진행 중인 발송이 그 행 id를 그대로 쓰고 있으므로 지우면 안 된다.
--                    (지운 뒤 그 발송이 성공하면 로그는 dispatched로 마킹되어 다시
--                    claim되지 않고, 벨에는 영영 아무것도 남지 않는다.)
--                    대신 완료 표시 때 소비해둔 READ만 SENT로 되돌려 다시 보이게 한다.
--                    sent_at은 실제로 나간 시각이므로 건드리지 않는다.
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
      --
      -- read_at으로 그 둘을 가른다. 완료 표시(p_completed = true)는 read_at을
      -- COALESCE(read_at, 완료 시각)으로 채우므로, 완료가 소비한 행은 read_at이
      -- 완료 시각과 같고 사용자가 직접 읽은 행은 그보다 앞선다. 이 조건이 없으면
      -- 발송 진행 중에 사용자가 벨에서 읽고 -> 완료 -> 재시작한 경우, 이미 치운
      -- 알림이 안 읽음으로 되살아난다.
      UPDATE public.notifications n
      SET status = 'SENT',
          read_at = NULL
      WHERE n.review_log_id = v_pending_review_log_id
        AND n.user_id = v_user_id
        AND n.type = 'REVIEW'
        AND n.status = 'READ'
        AND n.read_at IS NOT NULL
        AND n.read_at >= v_review_completed_at;
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

-- 3) 직접 지정한 일정으로 옮기기. 완료 당일에는 오늘의 미래 시각으로만 허용하고,
--    옮기면 복습을 다시 시작시킨다.
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

-- 4) "기본 일정" 경로도 같다. 완료 당일 정책을 통과했다는 것은 복원된 일정이 오늘의
--    미래 시각이라는 뜻이므로, 그 일정이 실제로 발송되도록 완료 표시를 함께 푼다.
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
