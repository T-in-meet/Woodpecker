-- 같은 날 두 번째 이후 완료가 다음 일정을 과거 시각으로 잡지 않게 한다.
--
--   20260901050000의 complete_review_and_schedule_next는 그날 이미 완료한 경우
--   방금 소비한 로그의 scheduled_at을 그대로 다음 로그에 물려준다. 케이던스를
--   하루에 여러 번 완료했다고 뒤로 밀지 않기 위한 처리인데, 물려받는 값이 이미
--   지난 시각일 수 있다.
--
--     D일 10:00 완료 -> 다음 로그 L2가 D+1로 생성
--     사용자가 L2를 D일 21:00으로 옮김 (update_notification_schedule은
--       p_scheduled_at > now()만 요구하므로 허용된다)
--     D일 21:00 알림을 받고 다시 완료 -> v_already_completed_today가 true라
--       다음 로그가 D일 21:00, 즉 과거 시각으로 INSERT된다
--
--   그러면 notes.next_review_at이 오늘로 잡혀 방금 끝낸 노트가 즉시 다시 '오늘
--   복습'으로 뜨고, 다음 cron 실행이 그 로그를 바로 집어가 push를 한 번 더 보낸다.
--
--   물려받을 일정이 아직 미래일 때만 그대로 쓰고, 이미 지났으면 지금을 기준으로
--   다시 잡는다. 이때 복습한 날짜 수는 늘리지 않으므로(오늘 몫은 첫 완료에서 이미
--   소비했다) 케이던스는 그대로다 — 첫 완료가 쓴 것과 같은 간격을 쓴다.
--
--   나머지 동작은 20260901050000과 같다.
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
