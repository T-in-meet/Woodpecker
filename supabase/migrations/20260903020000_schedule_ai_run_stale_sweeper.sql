-- pg_cron을 사용해 비정상 종료 후 running에 남은 AI Run을 공통 정리합니다.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 시작 후 3분이 지난 running Run만 stale terminal 상태로 전환합니다.
CREATE OR REPLACE FUNCTION public.sweep_stale_ai_runs()
RETURNS bigint
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_updated_count bigint;
BEGIN
  -- status guard가 요청 경로 terminal UPDATE와의 경합에서 기존 종료 상태를 보호합니다.
  UPDATE public.ai_runs
  SET
    status = 'stale',
    completed_at = statement_timestamp()
  WHERE status = 'running'
    AND started_at <= statement_timestamp() - interval '3 minutes';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.sweep_stale_ai_runs() IS
  '시작 후 3분이 지난 running AI Run을 stale로 전환하고 변경 행 수를 반환합니다.';

-- 일반 클라이언트가 sweeper를 직접 실행할 수 없도록 실행 권한을 제한합니다.
REVOKE ALL ON FUNCTION public.sweep_stale_ai_runs() FROM PUBLIC, anon, authenticated;

-- 동일 이름의 job을 1분 주기로 등록하며 SQL 실패는 pg_cron 실행 이력에 남깁니다.
SELECT cron.schedule(
  'sweep-stale-ai-runs',
  '* * * * *',
  'SELECT public.sweep_stale_ai_runs();'
);
