-- 복습 회차 상한과 당일 1회 완료 제한을 함께 걷어낸다.
--
--   지금까지 복습을 막는 제한은 두 겹이었다.
--     횟수 — 노트당 3회 (notes_review_round_check, RPC의 `IF v_current_round < 3`)
--     빈도 — 노트당 KST 하루 1회 (WP001, review_logs_one_completed_..._idx)
--
--   둘 중 하나만 없애면 "회차는 무제한인데 하루엔 한 번" 또는 "하루에 여러 번인데
--   3회에서 끝"이라는 어중간한 상태가 남으므로 한 번에 정리한다.
--
--   대신 간격 계산 기준을 "완료 횟수"에서 "복습한 서로 다른 KST 날짜 수"로 바꾼다.
--   하루에 몇 번을 완료하든 그날은 한 칸만 진행하므로, 몰아서 완료해도 케이던스가
--   무너지지 않는다. WP001이 제약으로 지키던 것을 계산 방식으로 흡수하는 셈이다.

-- 1. 기존 자동 완료 노트를 자율 완료 표시로 옮긴다.
--    회차 상한이 사라지면 `review_round >= 3 AND next_review_at IS NULL`이라는
--    완료 판정도 함께 사라진다. 이미 3회를 마친 노트가 "준비 중"으로 되돌아가지
--    않도록, 그 노트들을 사용자가 완료 표시한 것과 같은 상태로 만들어 둔다.
UPDATE public.notes
SET review_completed_at = COALESCE(review_completed_at, updated_at, now())
WHERE review_completed_at IS NULL
  AND next_review_at IS NULL
  AND review_round >= 3;

-- 2. 당일 1회 완료 제한 해제.
DROP INDEX IF EXISTS public.review_logs_one_completed_per_note_per_kst_day_idx;

-- 3. 회차 상한 해제. 하한만 남긴다.
ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_review_round_check;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_review_round_check CHECK (review_round >= 0);

ALTER TABLE public.review_logs
  DROP CONSTRAINT IF EXISTS review_logs_round_check;
ALTER TABLE public.review_logs
  ADD CONSTRAINT review_logs_round_check CHECK (round >= 1);

ALTER TABLE public.review_gradings
  DROP CONSTRAINT IF EXISTS review_gradings_round_check;
ALTER TABLE public.review_gradings
  ADD CONSTRAINT review_gradings_round_check CHECK (round >= 1);

-- 4. 간격 시퀀스.
--    src/lib/constants/reviewIntervals.ts의 REVIEW_INTERVALS_DAYS와 같은 값을
--    유지해야 한다. 시퀀스를 넘어서면 마지막 값(30일)을 반복하므로 무한히 복습해도
--    다음 일정이 항상 존재한다.
CREATE OR REPLACE FUNCTION public.review_interval_days(p_reviewed_day_count integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (ARRAY[1, 3, 7, 14, 30])[
    LEAST(GREATEST(COALESCE(p_reviewed_day_count, 0), 0), 4) + 1
  ];
$$;

-- 5. 완료 처리 RPC.
CREATE OR REPLACE FUNCTION public.complete_review_and_schedule_next(
  p_note_id uuid,
  p_review_log_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
-- review_logs intentionally has no UPDATE policy, so this RPC performs the
-- ownership check explicitly and updates the locked row within the same transaction.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_current_round integer;
  v_current_scheduled_at timestamptz;
  v_current_base_scheduled_at timestamptz;
  v_note_review_round integer;
  v_notification_time_of_day time;
  v_already_completed_today boolean;
  v_reviewed_day_count integer;
  v_base_next_review_at timestamptz;
  v_next_review_at timestamptz;
  -- Use wall-clock time so completion and the next schedule share the same actual timestamp.
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- DB-level guard mirroring the app-level email verification redirects so that
  -- direct RPC callers cannot bypass the "verified email required" policy.
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

  SELECT rl.round,
         rl.scheduled_at,
         rl.notification_base_scheduled_at,
         n.review_round,
         n.notification_time_of_day
    INTO v_current_round,
         v_current_scheduled_at,
         v_current_base_scheduled_at,
         v_note_review_round,
         v_notification_time_of_day
  FROM public.review_logs rl
  JOIN public.notes n
    ON n.id = rl.note_id
  WHERE rl.id = p_review_log_id
    AND rl.note_id = p_note_id
    AND rl.user_id = v_user_id
    AND rl.completed_at IS NULL
    AND n.user_id = v_user_id
  FOR UPDATE OF rl, n;

  IF v_current_round IS NULL THEN
    RAISE EXCEPTION 'pending review log not found';
  END IF;

  IF v_current_round <> v_note_review_round + 1 THEN
    RAISE EXCEPTION 'review log round does not match current note state';
  END IF;

  -- 오늘 이미 이 노트를 완료했는지. 완료 자체를 막지는 않고, 일정을 다시 밀지
  -- 말지를 가르는 데 쓴다.
  SELECT EXISTS (
    SELECT 1
    FROM public.review_logs
    WHERE note_id = p_note_id
      AND user_id = v_user_id
      AND completed_at IS NOT NULL
      AND public.kst_date(completed_at) = public.kst_date(v_now)
  )
    INTO v_already_completed_today;

  -- 이번 완료를 포함해 이 노트를 복습한 서로 다른 KST 날짜 수.
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
    -- 같은 날 두 번째 이후 완료는 일정을 옮기지 않는다. 방금 소비한 로그의 일정을
    -- 그대로 물려주어 다음 복습이 하루에 여러 번 했다고 뒤로 밀리지 않게 한다.
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

  -- The bell treats SENT review notifications as actionable pending work.
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

  -- 회차 상한이 없으므로 다음 로그는 항상 만든다. 복습을 그만두는 경로는
  -- notes.review_completed_at(자율 완료 표시)이다.
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
