-- notes.review_completed_at:
--   사용자가 "이 노트는 이제 됐다"고 직접 끝내는 자율 완료 표시.
--
--   지금까지 노트 완료는 review_round가 상한(3)에 닿아야만 도달하는 시스템 판정이라
--   사용자가 스스로 끝낼 방법이 없었다. 회차 상한을 없애고 나면 그 판정 자체가
--   성립하지 않으므로, 그 전에 사용자가 직접 표시하는 경로를 먼저 만든다.
--
--   boolean 대신 timestamptz를 쓴다. NULL 여부가 곧 플래그이고, 언제 끝냈는지가
--   학습 통계로 쓸모가 있다.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS review_completed_at timestamptz;

COMMENT ON COLUMN public.notes.review_completed_at IS
  '사용자가 직접 복습을 끝냈다고 표시한 시각. NULL이면 아직 진행 중이다.';

-- claim_due_review_logs:
--   완료 표시한 노트에는 복습 알림을 보내지 않는다.
--
--   pending review_log는 지우지 않고 그대로 둔다. 사용자가 완료를 해제하면 원래
--   일정 그대로 알림이 다시 나가야 하므로, 삭제·복원 대신 발송 시점에 걸러낸다.
--
--   dead_lettered에도 같은 조건을 건다. 완료한 노트의 로그는 실패로 표시할 이유도
--   없으니 아예 건드리지 않는다.
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
        OR rl.notification_claimed_at < clock_timestamp() - interval '15 minutes'
      )
      AND EXISTS (
        SELECT 1
        FROM public.notes n
        WHERE n.id = rl.note_id
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
        OR rl.notification_claimed_at < clock_timestamp() - interval '15 minutes'
      )
      AND rl.scheduled_at <= clock_timestamp()
      AND EXISTS (
        SELECT 1
        FROM public.notes n
        WHERE n.id = rl.note_id
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
