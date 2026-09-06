BEGIN;

SELECT plan(59);

SELECT set_config('test.ai_runs_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_cascade_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_stale_target_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_recent_running_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_terminal_succeeded_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_terminal_failed_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_terminal_stale_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_runs_result_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    current_setting('test.ai_runs_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-runs-a-' || current_setting('test.ai_runs_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.ai_runs_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-runs-b-' || current_setting('test.ai_runs_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

-- ai_runs 테이블은 공통 AI 실행 이력 기반으로 존재해야 합니다.
SELECT ok(
  to_regclass('public.ai_runs') IS NOT NULL,
  $$ai_runs table should exist$$
);

-- 필수 시각과 Snapshot을 포함한 유효한 running Run은 생성할 수 있어야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        id,
        user_id,
        feature_type,
        snapshots,
        started_at
      )
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        'note-chat',
        '{"input":{"noteId":"n1"}}'::jsonb,
        TIMESTAMPTZ '2026-09-03 00:00:00+00'
      );
    $sql$,
    current_setting('test.ai_runs_valid_id'),
    current_setting('test.ai_runs_user_a_id')
  ),
  $$valid ai_run should be insertable$$
);

-- 기본값으로 생성 ID, 빈 feature_result_ids, running 상태, created_at이 설정되어야 합니다.
SELECT ok(
  (
    SELECT
      id = current_setting('test.ai_runs_valid_id')::uuid
      AND feature_result_ids = '{}'::uuid[]
      AND status = 'running'
      AND created_at IS NOT NULL
    FROM public.ai_runs
    WHERE id = current_setting('test.ai_runs_valid_id')::uuid
  ),
  $$ai_runs should apply expected defaults$$
);

-- started_at은 실제 실행 시작 시각이므로 암묵적인 DB 기본값이 없어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots)
      VALUES ('%s'::uuid, 'note-chat', '{}'::jsonb);
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23502',
  NULL,
  $$started_at should be required without a DB default$$
);

-- user_id는 auth.users를 참조해야 합니다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.ai_runs (
      user_id,
      feature_type,
      snapshots,
      started_at
    )
    VALUES (
      gen_random_uuid(),
      'note-chat',
      '{}'::jsonb,
      now()
    );
  $sql$,
  '23503',
  NULL,
  $$ai_runs should reject missing auth.users rows$$
);

-- 사용자를 삭제하면 해당 사용자의 AI Run 이력도 cascade 삭제되어야 합니다.
INSERT INTO public.ai_runs (
  id,
  user_id,
  feature_type,
  snapshots,
  started_at
)
VALUES (
  current_setting('test.ai_runs_cascade_id')::uuid,
  current_setting('test.ai_runs_user_b_id')::uuid,
  'quiz-generation',
  '{}'::jsonb,
  now()
);

DELETE FROM auth.users
WHERE id = current_setting('test.ai_runs_user_b_id')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_runs
    WHERE id = current_setting('test.ai_runs_cascade_id')::uuid
  ),
  0::bigint,
  $$deleting auth.users should cascade delete ai_runs$$
);

-- 프로젝트에서 사용하는 AI 기능 식별값은 feature_type으로 허용되어야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$feature_type should accept note-chat$$
);

-- Related Notes는 기존 하이픈 형식의 AI 기능 식별값을 사용해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'related-notes', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$feature_type should accept related-notes$$
);

-- Quiz 생성은 quiz-generation 기능 식별값을 사용해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'quiz-generation', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$feature_type should accept quiz$$
);

-- Review 채점은 review-grading 기능 식별값을 사용해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'review-grading', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$feature_type should accept review$$
);

-- 지원하지 않는 feature_type 값은 거부되어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'invalid', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$feature_type should reject unsupported values$$
);

-- 확정된 프로젝트 기능 식별값과 다른 기존 언더스코어 형식은 허용하지 않아야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'note_chat', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$feature_type should reject non-project note_chat key$$
);

-- running은 유효한 비종료 상태입니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, status, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', 'running', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$status should accept running$$
);

-- succeeded는 completed_at이 존재할 때 유효한 종료 상태입니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        snapshots,
        started_at,
        completed_at
      )
      VALUES ('%s'::uuid, 'note-chat', 'succeeded', '{}'::jsonb, now(), now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$status should accept succeeded$$
);

-- failed는 completed_at이 존재할 때 유효한 종료 상태입니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        snapshots,
        started_at,
        completed_at
      )
      VALUES ('%s'::uuid, 'note-chat', 'failed', '{}'::jsonb, now(), now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$status should accept failed$$
);

-- stale은 completed_at이 존재할 때 유효한 종료 상태입니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        snapshots,
        started_at,
        completed_at
      )
      VALUES ('%s'::uuid, 'note-chat', 'stale', '{}'::jsonb, now(), now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$status should accept stale$$
);

-- 지원하지 않는 status 값은 거부되어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, status, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', 'pending', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$status should reject unsupported values$$
);

-- running row에는 completed_at이 없어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        snapshots,
        started_at,
        completed_at
      )
      VALUES ('%s'::uuid, 'note-chat', 'running', '{}'::jsonb, now(), now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$running ai_runs should reject completed_at$$
);

-- succeeded row에는 completed_at이 반드시 있어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, status, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', 'succeeded', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$succeeded ai_runs should require completed_at$$
);

-- failed row에는 completed_at이 반드시 있어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, status, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', 'failed', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$failed ai_runs should require completed_at$$
);

-- stale row에는 completed_at이 반드시 있어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, status, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', 'stale', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$stale ai_runs should require completed_at$$
);

-- completed_at은 started_at보다 빠를 수 없습니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        snapshots,
        started_at,
        completed_at
      )
      VALUES (
        '%s'::uuid,
        'note-chat',
        'succeeded',
        '{}'::jsonb,
        TIMESTAMPTZ '2026-09-03 01:00:00+00',
        TIMESTAMPTZ '2026-09-03 00:59:59+00'
      );
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$completed_at should not precede started_at$$
);

-- snapshots는 최상위 JSON object여야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', '[]'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23514',
  NULL,
  $$snapshots should reject non-object JSON$$
);

-- snapshots는 필수이며 NULL을 허용하지 않아야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', NULL, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23502',
  NULL,
  $$snapshots should be required$$
);

-- snapshots에는 암묵적인 '{}' 기본값이 없으므로 생략하면 실패해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, started_at)
      VALUES ('%s'::uuid, 'note-chat', now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '23502',
  NULL,
  $$snapshots should not have an implicit default object$$
);

-- 결과 저장은 AI 실행과 분리되어 있으므로 succeeded row도 빈 feature_result_ids를 허용해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        status,
        feature_result_ids,
        snapshots,
        started_at,
        completed_at
      )
      VALUES (
        '%s'::uuid,
        'related-notes',
        'succeeded',
        '{}'::uuid[],
        '{}'::jsonb,
        now(),
        now()
      );
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$succeeded ai_runs should allow empty feature_result_ids$$
);

-- 여러 결과 row를 생성하는 Run의 feature_result_ids에는 여러 결과 ID가 들어갈 수 있어야 합니다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (
        user_id,
        feature_type,
        feature_result_ids,
        snapshots,
        started_at
      )
      VALUES (
        '%s'::uuid,
        'related-notes',
        ARRAY[gen_random_uuid(), gen_random_uuid()],
        '{}'::jsonb,
        now()
      );
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  $$feature_result_ids should allow multiple result ids$$
);

-- feature_type마다 대상 테이블이 다르므로 feature_result_ids에는 의도적으로 foreign key를 두지 않습니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM pg_constraint
    WHERE conrelid = 'public.ai_runs'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.ai_runs'::regclass
            AND attname = 'feature_result_ids'
        )
      ]::smallint[]
  ),
  0::bigint,
  $$feature_result_ids should not have foreign key constraints$$
);

-- 계약에 정의된 조회 인덱스가 정확한 이름으로 존재해야 합니다.
SELECT ok(to_regclass('public.ai_runs_started_at_idx') IS NOT NULL, $$started_at index should exist$$);
SELECT ok(to_regclass('public.ai_runs_user_started_at_idx') IS NOT NULL, $$user started_at index should exist$$);
SELECT ok(to_regclass('public.ai_runs_feature_type_started_at_idx') IS NOT NULL, $$feature_type started_at index should exist$$);
SELECT ok(to_regclass('public.ai_runs_feature_result_ids_idx') IS NOT NULL, $$feature_result_ids GIN index should exist$$);
SELECT ok(to_regclass('public.ai_runs_running_started_at_idx') IS NOT NULL, $$running partial index should exist$$);

-- ai_runs에는 Row Level Security가 활성화되어 있어야 합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_runs'::regclass
  ),
  $$ai_runs should have RLS enabled$$
);

-- 이 실행 이력 테이블에는 authenticated 직접 접근용 RLS policy가 없어야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_runs'
  ),
  0::bigint,
  $$ai_runs should not define general authenticated RLS policies$$
);

-- authenticated에는 ai_runs 직접 CRUD table privilege가 없어야 합니다.
SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.ai_runs',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$authenticated should not have direct ai_runs CRUD privileges$$
);

-- anon에는 ai_runs 직접 CRUD table privilege가 없어야 합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_runs',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  $$anon should not have direct ai_runs CRUD privileges$$
);

-- service_role은 신뢰된 서버 저장을 위한 CRUD 접근 권한을 유지해야 합니다.
SELECT ok(
  has_table_privilege('service_role', 'public.ai_runs', 'SELECT')
  AND has_table_privilege('service_role', 'public.ai_runs', 'INSERT')
  AND has_table_privilege('service_role', 'public.ai_runs', 'UPDATE')
  AND has_table_privilege('service_role', 'public.ai_runs', 'DELETE'),
  $$service_role should have ai_runs CRUD privileges$$
);

-- 공통 stale sweeper 함수가 후속 migration으로 생성되어야 합니다.
SELECT has_function(
  'public',
  'sweep_stale_ai_runs',
  ARRAY[]::text[],
  $$stale sweeper function should exist$$
);

-- stale sweeper Cron job은 중복 없이 하나만 등록되어야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM cron.job
    WHERE jobname = 'sweep-stale-ai-runs'
  ),
  1::bigint,
  $$stale sweeper cron job should exist once$$
);

-- stale sweeper Cron job은 매 1분 실행되어야 합니다.
SELECT is(
  (
    SELECT schedule
    FROM cron.job
    WHERE jobname = 'sweep-stale-ai-runs'
  ),
  '* * * * *',
  $$stale sweeper cron job should run every minute$$
);

-- Cron job은 공통 stale sweeper 함수만 실행해야 합니다.
SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'sweep-stale-ai-runs'
  ),
  'SELECT public.sweep_stale_ai_runs();',
  $$stale sweeper cron job should call the shared function$$
);

INSERT INTO public.ai_runs (
  id,
  user_id,
  feature_type,
  feature_result_ids,
  snapshots,
  started_at
)
VALUES
  (
    current_setting('test.ai_runs_stale_target_id')::uuid,
    current_setting('test.ai_runs_user_a_id')::uuid,
    'note-chat',
    ARRAY[current_setting('test.ai_runs_result_id')::uuid],
    '{"schemaVersion":1,"checkpoint":"retrieval"}'::jsonb,
    statement_timestamp() - interval '3 minutes 1 second'
  ),
  (
    current_setting('test.ai_runs_recent_running_id')::uuid,
    current_setting('test.ai_runs_user_a_id')::uuid,
    'related-notes',
    '{}'::uuid[],
    '{"schemaVersion":1}'::jsonb,
    statement_timestamp() - interval '2 minutes 59 seconds'
  );

INSERT INTO public.ai_runs (
  id,
  user_id,
  feature_type,
  status,
  snapshots,
  started_at,
  completed_at
)
VALUES
  (
    current_setting('test.ai_runs_terminal_succeeded_id')::uuid,
    current_setting('test.ai_runs_user_a_id')::uuid,
    'quiz-generation',
    'succeeded',
    '{"schemaVersion":1}'::jsonb,
    statement_timestamp() - interval '10 minutes',
    statement_timestamp() - interval '9 minutes'
  ),
  (
    current_setting('test.ai_runs_terminal_failed_id')::uuid,
    current_setting('test.ai_runs_user_a_id')::uuid,
    'review-grading',
    'failed',
    '{"schemaVersion":1}'::jsonb,
    statement_timestamp() - interval '10 minutes',
    statement_timestamp() - interval '9 minutes'
  ),
  (
    current_setting('test.ai_runs_terminal_stale_id')::uuid,
    current_setting('test.ai_runs_user_a_id')::uuid,
    'related-notes',
    'stale',
    '{"schemaVersion":1}'::jsonb,
    statement_timestamp() - interval '10 minutes',
    statement_timestamp() - interval '9 minutes'
  );

-- sweeper는 3분을 넘은 running Run을 하나 이상 stale로 전환해야 합니다.
SELECT cmp_ok(
  public.sweep_stale_ai_runs(),
  '>=',
  1::bigint,
  $$stale sweeper should transition eligible running rows$$
);

-- stale 대상은 lifecycle constraint에 맞는 완료 시각과 상태를 가져야 합니다.
SELECT ok(
  (
    SELECT status = 'stale'
      AND completed_at IS NOT NULL
      AND completed_at >= started_at
    FROM public.ai_runs
    WHERE id = current_setting('test.ai_runs_stale_target_id')::uuid
  ),
  $$stale sweeper should set terminal status and completed_at$$
);

-- stale 전환은 마지막 Snapshot과 결과 ID를 변경하지 않아야 합니다.
SELECT ok(
  (
    SELECT snapshots = '{"schemaVersion":1,"checkpoint":"retrieval"}'::jsonb
      AND feature_result_ids = ARRAY[current_setting('test.ai_runs_result_id')::uuid]
    FROM public.ai_runs
    WHERE id = current_setting('test.ai_runs_stale_target_id')::uuid
  ),
  $$stale sweeper should preserve snapshots and feature result ids$$
);

-- 3분 threshold 이내의 running Run은 변경하지 않아야 합니다.
SELECT ok(
  (
    SELECT status = 'running' AND completed_at IS NULL
    FROM public.ai_runs
    WHERE id = current_setting('test.ai_runs_recent_running_id')::uuid
  ),
  $$stale sweeper should preserve recent running rows$$
);

-- 이미 종료된 모든 상태는 오래됐더라도 sweeper가 덮어쓰지 않아야 합니다.
SELECT ok(
  (
    SELECT array_agg(status ORDER BY status) = ARRAY['failed', 'stale', 'succeeded']
    FROM public.ai_runs
    WHERE id IN (
      current_setting('test.ai_runs_terminal_succeeded_id')::uuid,
      current_setting('test.ai_runs_terminal_failed_id')::uuid,
      current_setting('test.ai_runs_terminal_stale_id')::uuid
    )
  ),
  $$stale sweeper should preserve every terminal row$$
);

-- stale sweeper cron 이력 cleanup 함수가 후속 migration으로 생성되어야 합니다.
SELECT has_function(
  'public',
  'cleanup_stale_ai_run_cron_history',
  ARRAY[]::text[],
  $$stale sweeper cron history cleanup function should exist$$
);

-- cleanup Cron job은 중복 없이 하나만 등록되어야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM cron.job
    WHERE jobname = 'cleanup-stale-ai-run-cron-history'
  ),
  1::bigint,
  $$stale sweeper cron history cleanup job should exist once$$
);

-- cleanup Cron job은 하루 한 번 실행되어야 합니다.
SELECT is(
  (
    SELECT schedule
    FROM cron.job
    WHERE jobname = 'cleanup-stale-ai-run-cron-history'
  ),
  '0 0 * * *',
  $$stale sweeper cron history cleanup job should run daily$$
);

-- cleanup Cron job은 공통 cleanup 함수만 실행해야 합니다.
SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'cleanup-stale-ai-run-cron-history'
  ),
  'SELECT public.cleanup_stale_ai_run_cron_history();',
  $$stale sweeper cron history cleanup job should call the shared function$$
);

-- 기존 로컬 실행 이력이 테스트 결과에 영향을 주지 않도록
-- stale sweeper의 7일 초과 이력만 테스트 전에 정리합니다.
DELETE FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'sweep-stale-ai-runs'
)
  AND end_time < statement_timestamp() - interval '7 days';

-- 7일이 지난 stale sweeper 실행 이력을 준비합니다.
INSERT INTO cron.job_run_details (
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
)
SELECT
  COALESCE((SELECT min(runid) FROM cron.job_run_details), 0) - 1,
  jobid,
  current_database(),
  current_user,
  command,
  'succeeded',
  'pgTAP-old-stale-sweeper',
  statement_timestamp() - interval '8 days 1 minute',
  statement_timestamp() - interval '8 days'
FROM cron.job
WHERE jobname = 'sweep-stale-ai-runs';

-- 아직 7일이 지나지 않은 stale sweeper 실행 이력을 준비합니다.
INSERT INTO cron.job_run_details (
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
)
SELECT
  COALESCE((SELECT min(runid) FROM cron.job_run_details), 0) - 1,
  jobid,
  current_database(),
  current_user,
  command,
  'succeeded',
  'pgTAP-recent-stale-sweeper',
  statement_timestamp() - interval '6 days 1 minute',
  statement_timestamp() - interval '6 days'
FROM cron.job
WHERE jobname = 'sweep-stale-ai-runs';

-- 다른 cron job의 오래된 실행 이력도 준비해 cleanup 범위를 검증합니다.
INSERT INTO cron.job_run_details (
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
)
SELECT
  COALESCE((SELECT min(runid) FROM cron.job_run_details), 0) - 1,
  jobid,
  current_database(),
  current_user,
  command,
  'succeeded',
  'pgTAP-old-other-job',
  statement_timestamp() - interval '8 days 1 minute',
  statement_timestamp() - interval '8 days'
FROM cron.job
WHERE jobname = 'cleanup-stale-ai-run-cron-history';

-- cleanup은 7일이 지난 stale sweeper 이력만 삭제해야 합니다.
SELECT is(
  public.cleanup_stale_ai_run_cron_history(),
  1::bigint,
  $$cron history cleanup should delete only expired stale sweeper rows$$
);

-- 7일이 지난 stale sweeper 실행 이력은 삭제되어야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM cron.job_run_details
    WHERE return_message = 'pgTAP-old-stale-sweeper'
  ),
  0::bigint,
  $$cron history cleanup should delete expired stale sweeper history$$
);

-- 아직 7일이 지나지 않은 stale sweeper 실행 이력은 유지되어야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM cron.job_run_details
    WHERE return_message = 'pgTAP-recent-stale-sweeper'
  ),
  1::bigint,
  $$cron history cleanup should preserve recent stale sweeper history$$
);

-- 다른 cron job의 실행 이력은 7일이 지났더라도 삭제하지 않아야 합니다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM cron.job_run_details
    WHERE return_message = 'pgTAP-old-other-job'
  ),
  1::bigint,
  $$cron history cleanup should preserve other cron job history$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.ai_runs_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- authenticated 클라이언트는 ai_runs를 직접 조회할 수 없어야 합니다.
SELECT throws_ok(
  $$ SELECT count(*) FROM public.ai_runs; $$,
  '42501',
  NULL,
  $$authenticated should not directly SELECT ai_runs$$
);

-- authenticated 클라이언트는 ai_runs에 직접 INSERT할 수 없어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_runs (user_id, feature_type, snapshots, started_at)
      VALUES ('%s'::uuid, 'note-chat', '{}'::jsonb, now());
    $sql$,
    current_setting('test.ai_runs_user_a_id')
  ),
  '42501',
  NULL,
  $$authenticated should not directly INSERT ai_runs$$
);

-- authenticated 클라이언트는 ai_runs를 직접 UPDATE할 수 없어야 합니다.
SELECT throws_ok(
  $$ UPDATE public.ai_runs SET status = 'failed'; $$,
  '42501',
  NULL,
  $$authenticated should not directly UPDATE ai_runs$$
);

-- authenticated 클라이언트는 ai_runs를 직접 DELETE할 수 없어야 합니다.
SELECT throws_ok(
  $$ DELETE FROM public.ai_runs; $$,
  '42501',
  NULL,
  $$authenticated should not directly DELETE ai_runs$$
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
