BEGIN;

-- ============================================================================
-- AI Runs Removal Contract
-- ============================================================================
--
-- AI Runs 실행 기록 기능은 제거되었지만, 해당 기능을 생성했던 historical
-- migration은 이미 적용된 DB의 migration history와 신규 환경의 upgrade path를
-- 일치시키기 위해 그대로 유지한다.
--
-- 따라서 최종 schema에서는 historical migration이 생성했던 AI Runs 전용
-- table/function/cron job이 남아 있지 않아야 한다.
--
-- 또한 AI Runs 도입 과정에서 결과 ID를 기록하기 위해 jsonb 반환으로 변경했던
-- 기존 도메인 RPC들은 AI Runs 제거 후 원래의 text status 반환 계약으로 복원한다.
--
-- 이 테스트는 historical migration의 존재 여부가 아니라 모든 migration 적용 후의
-- 최종 DB 계약을 검증한다.

SELECT plan(9);


-- ============================================================================
-- AI Runs database objects are removed
-- ============================================================================

-- 공통 AI 실행 기록을 저장하던 테이블은 최종 schema에 존재하지 않아야 한다.
SELECT hasnt_table(
    'public',
    'ai_runs',
    'AI Runs table is removed'
);

-- 실제 AI 실행 결과를 ai_runs에 최종 기록하던 전용 finalizer는 제거한다.
SELECT hasnt_function(
    'public',
    'finalize_ai_run',
    ARRAY[
        'uuid',
        'uuid',
        'text',
        'timestamp with time zone',
        'text',
        'timestamp with time zone',
        'jsonb',
        'uuid[]'
    ]::name[],
    'finalize_ai_run is removed'
);

-- timeout된 running AI Run을 stale로 변경하던 sweeper도 더 이상 필요하지 않다.
SELECT hasnt_function(
    'public',
    'sweep_stale_ai_runs',
    ARRAY[]::name[],
    'AI Runs stale sweeper function is removed'
);

-- stale sweeper의 pg_cron 실행 이력을 정리하던 함수도 함께 제거한다.
SELECT hasnt_function(
    'public',
    'cleanup_stale_ai_run_cron_history',
    ARRAY[]::name[],
    'AI Runs cron history cleanup function is removed'
);


-- ============================================================================
-- AI Runs cron jobs are removed
-- ============================================================================

-- 제거된 sweep_stale_ai_runs()를 주기적으로 호출하던 cron job이
-- 최종 schema에 남아 있으면 안 된다.
SELECT is(
    (
        SELECT count(*)::integer
        FROM cron.job
        WHERE jobname = 'sweep-stale-ai-runs'
    ),
    0,
    'AI Runs stale sweeper cron job is removed'
);

-- 제거된 cleanup 함수의 cron job 역시 남아 있으면 안 된다.
SELECT is(
    (
        SELECT count(*)::integer
        FROM cron.job
        WHERE jobname = 'cleanup-stale-ai-run-cron-history'
    ),
    0,
    'AI Runs cron history cleanup job is removed'
);


-- ============================================================================
-- Domain RPC contracts are restored
-- ============================================================================
--
-- 아래 RPC들은 AI Runs에서 생성 결과 ID를 기록하기 위해 한때 jsonb를 반환하도록
-- 변경되었다. AI Runs 제거 후 현재 애플리케이션이 사용하는 기존 text status
-- 계약으로 복원되었는지 반환형을 명시적으로 검증한다.

-- Review Grading:
-- { status, gradingId } jsonb가 아니라 기존 status text를 반환해야 한다.
SELECT function_returns(
    'public',
    'finalize_review_grading',
    ARRAY['uuid', 'uuid', 'uuid', 'integer', 'jsonb'],
    'text',
    'Review grading finalizer returns text again'
);

-- Quiz Generation:
-- { status, quizId } jsonb가 아니라 기존 status text를 반환해야 한다.
SELECT function_returns(
    'public',
    'finalize_quiz_generation_v2',
    ARRAY[
        'uuid',
        'uuid',
        'text',
        'uuid',
        'jsonb',
        'jsonb',
        'text'
    ],
    'text',
    'Quiz generation finalizer returns text again'
);

-- Related Notes:
-- { status, relationIds } jsonb가 아니라 기존 status text를 반환해야 한다.
SELECT function_returns(
    'public',
    'replace_note_related_ai_recommendations',
    ARRAY[
        'uuid',
        'uuid',
        'timestamp with time zone',
        'jsonb'
    ],
    'text',
    'Related Notes replacement RPC returns text again'
);


SELECT * FROM finish();

ROLLBACK;
