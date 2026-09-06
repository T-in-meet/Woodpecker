-- stale AI Run sweeper의 pg_cron 실행 이력은 최근 7일만 보존합니다.
CREATE OR REPLACE FUNCTION public.cleanup_stale_ai_run_cron_history()
RETURNS bigint
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  -- 다른 cron 작업의 실행 이력은 건드리지 않고 stale sweeper 기록만 정리합니다.
  DELETE FROM cron.job_run_details
  WHERE jobid = (
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'sweep-stale-ai-runs'
  )
    AND end_time < statement_timestamp() - interval '7 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_ai_run_cron_history() IS
  'sweep-stale-ai-runs cron 실행 이력 중 종료 후 7일이 지난 기록을 삭제하고 삭제 건수를 반환합니다.';

-- 일반 클라이언트가 cleanup 함수를 직접 실행할 수 없도록 실행 권한을 제한합니다.
REVOKE ALL
ON FUNCTION public.cleanup_stale_ai_run_cron_history()
FROM PUBLIC, anon, authenticated;

-- stale sweeper 실행 이력을 하루 한 번 정리합니다.
SELECT cron.schedule(
  'cleanup-stale-ai-run-cron-history',
  '0 0 * * *',
  'SELECT public.cleanup_stale_ai_run_cron_history();'
);
