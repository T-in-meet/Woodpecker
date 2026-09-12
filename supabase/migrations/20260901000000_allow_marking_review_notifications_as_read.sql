-- mark_notification_as_read:
--   REVIEW 알림도 "확인"으로 소비할 수 있게 한다.
--
--   지금까지 REVIEW 알림은 complete_review_and_schedule_next만 READ로 바꿀 수 있었다
--   (20260430000000). 벨이 복습 to-do 역할을 겸하도록 한 설계였는데, 복습을 미루면
--   알림이 계속 쌓여 다른 알림까지 묻히는 문제가 있었다.
--
--   이제 알림 상태와 복습 완료를 분리한다. 사용자가 알림을 확인하면 읽음 처리되고,
--   복습 완료 시 READ로 바꾸는 경로는 그대로 둔다 — 벨을 열지 않고 복습을 마친
--   경우에도 알림이 남지 않아야 하므로 두 경로가 함께 필요하다.
--
--   `type <> 'REVIEW'` 조건만 걷어내고 나머지 가드(인증·이메일 인증·소유권·SENT
--   상태)는 그대로 유지한다.
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
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

  UPDATE public.notifications
  SET status = 'READ',
      read_at = COALESCE(read_at, clock_timestamp())
  WHERE id = p_notification_id
    AND user_id = v_user_id
    AND status = 'SENT';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_as_read(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_as_read(uuid)
  TO authenticated;
