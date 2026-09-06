BEGIN;

SELECT plan(15);

SELECT set_config('test.finalize_ai_run_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_missing_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_running_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_terminal_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_stale_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_identity_id', gen_random_uuid()::text, true);
SELECT set_config('test.finalize_ai_run_result_id', gen_random_uuid()::text, true);

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
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'finalize-ai-run-a-' || current_setting('test.finalize_ai_run_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.finalize_ai_run_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'finalize-ai-run-b-' || current_setting('test.finalize_ai_run_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

SELECT has_function(
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
  ],
  $$finalize_ai_run function should exist$$
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.finalize_ai_run(uuid,uuid,text,timestamp with time zone,text,timestamp with time zone,jsonb,uuid[])',
    'EXECUTE'
  ),
  $$service_role should execute finalize_ai_run$$
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.finalize_ai_run(uuid,uuid,text,timestamp with time zone,text,timestamp with time zone,jsonb,uuid[])',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.finalize_ai_run(uuid,uuid,text,timestamp with time zone,text,timestamp with time zone,jsonb,uuid[])',
    'EXECUTE'
  ),
  $$anon and authenticated should not execute finalize_ai_run$$
);

-- Create persistence가 없었던 Run도 동일한 logical Run ID로 terminal row를 복구해야 합니다.
SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_missing_id')::uuid,
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    'quiz-generation',
    TIMESTAMPTZ '2026-09-05 00:00:00+00',
    'succeeded',
    TIMESTAMPTZ '2026-09-05 00:01:00+00',
    '{"schemaVersion":1,"finalOutput":{"count":1}}'::jsonb,
    ARRAY[current_setting('test.finalize_ai_run_result_id')::uuid]
  ),
  'inserted',
  $$missing run should be inserted as terminal with the same id$$
);

SELECT ok(
  (
    SELECT
      user_id = current_setting('test.finalize_ai_run_user_a_id')::uuid
      AND feature_type = 'quiz-generation'
      AND status = 'succeeded'
      AND started_at = TIMESTAMPTZ '2026-09-05 00:00:00+00'
      AND completed_at = TIMESTAMPTZ '2026-09-05 00:01:00+00'
      AND snapshots = '{"schemaVersion":1,"finalOutput":{"count":1}}'::jsonb
      AND feature_result_ids = ARRAY[current_setting('test.finalize_ai_run_result_id')::uuid]
    FROM public.ai_runs
    WHERE id = current_setting('test.finalize_ai_run_missing_id')::uuid
  ),
  $$inserted terminal run should preserve final persistence payload$$
);

INSERT INTO public.ai_runs (
  id,
  user_id,
  feature_type,
  snapshots,
  started_at
)
VALUES (
  current_setting('test.finalize_ai_run_running_id')::uuid,
  current_setting('test.finalize_ai_run_user_a_id')::uuid,
  'note-chat',
  '{"schemaVersion":1,"checkpoint":"retrieval"}'::jsonb,
  TIMESTAMPTZ '2026-09-05 01:00:00+00'
);

SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_running_id')::uuid,
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    'note-chat',
    TIMESTAMPTZ '2026-09-05 01:00:00+00',
    'failed',
    TIMESTAMPTZ '2026-09-05 01:01:00+00',
    '{"schemaVersion":1,"error":{"stage":"answer"}}'::jsonb,
    '{}'::uuid[]
  ),
  'updated',
  $$running run should transition to terminal$$
);

SELECT ok(
  (
    SELECT
      status = 'failed'
      AND completed_at = TIMESTAMPTZ '2026-09-05 01:01:00+00'
      AND snapshots = '{"schemaVersion":1,"error":{"stage":"answer"}}'::jsonb
      AND feature_result_ids = '{}'::uuid[]
    FROM public.ai_runs
    WHERE id = current_setting('test.finalize_ai_run_running_id')::uuid
  ),
  $$running transition should persist the terminal payload$$
);

-- 응답 유실 뒤 동일 요청을 다시 보내도 이미 확정된 terminal row를 덮어쓰지 않아야 합니다.
SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_running_id')::uuid,
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    'note-chat',
    TIMESTAMPTZ '2026-09-05 01:00:00+00',
    'failed',
    TIMESTAMPTZ '2026-09-05 01:02:00+00',
    '{"schemaVersion":1,"error":{"stage":"different"}}'::jsonb,
    ARRAY[current_setting('test.finalize_ai_run_result_id')::uuid]
  ),
  'already_terminal',
  $$same terminal status should be idempotent$$
);

SELECT ok(
  (
    SELECT
      completed_at = TIMESTAMPTZ '2026-09-05 01:01:00+00'
      AND snapshots = '{"schemaVersion":1,"error":{"stage":"answer"}}'::jsonb
      AND feature_result_ids = '{}'::uuid[]
    FROM public.ai_runs
    WHERE id = current_setting('test.finalize_ai_run_running_id')::uuid
  ),
  $$idempotent retry should not overwrite the existing terminal payload$$
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
VALUES (
  current_setting('test.finalize_ai_run_terminal_id')::uuid,
  current_setting('test.finalize_ai_run_user_a_id')::uuid,
  'related-notes',
  'succeeded',
  '{"schemaVersion":1,"finalOutput":{"existing":true}}'::jsonb,
  TIMESTAMPTZ '2026-09-05 02:00:00+00',
  TIMESTAMPTZ '2026-09-05 02:01:00+00'
);

SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_terminal_id')::uuid,
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    'related-notes',
    TIMESTAMPTZ '2026-09-05 02:00:00+00',
    'failed',
    TIMESTAMPTZ '2026-09-05 02:02:00+00',
    '{"schemaVersion":1,"replacement":true}'::jsonb,
    '{}'::uuid[]
  ),
  'conflict',
  $$different terminal status should conflict$$
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
VALUES (
  current_setting('test.finalize_ai_run_stale_id')::uuid,
  current_setting('test.finalize_ai_run_user_a_id')::uuid,
  'review-grading',
  'stale',
  '{"schemaVersion":1,"checkpoint":"initial"}'::jsonb,
  TIMESTAMPTZ '2026-09-05 03:00:00+00',
  TIMESTAMPTZ '2026-09-05 03:03:00+00'
);

-- timeout 기반 stale 상태는 늦게 도착한 실제 terminal 결과로 교정할 수 있어야 합니다.
SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_stale_id')::uuid,
    current_setting('test.finalize_ai_run_user_a_id')::uuid,
    'review-grading',
    TIMESTAMPTZ '2026-09-05 03:00:00+00',
    'succeeded',
    TIMESTAMPTZ '2026-09-05 03:04:00+00',
    '{"schemaVersion":1,"finalOutput":{"score":80}}'::jsonb,
    ARRAY[current_setting('test.finalize_ai_run_result_id')::uuid]
  ),
  'updated',
  $$stale run should transition to the late terminal result$$
);

SELECT ok(
  (
    SELECT
      status = 'succeeded'
      AND completed_at = TIMESTAMPTZ '2026-09-05 03:04:00+00'
      AND snapshots = '{"schemaVersion":1,"finalOutput":{"score":80}}'::jsonb
      AND feature_result_ids = ARRAY[current_setting('test.finalize_ai_run_result_id')::uuid]
    FROM public.ai_runs
    WHERE id = current_setting('test.finalize_ai_run_stale_id')::uuid
  ),
  $$stale transition should persist the late terminal payload$$
);

INSERT INTO public.ai_runs (
  id,
  user_id,
  feature_type,
  snapshots,
  started_at
)
VALUES (
  current_setting('test.finalize_ai_run_identity_id')::uuid,
  current_setting('test.finalize_ai_run_user_a_id')::uuid,
  'note-chat',
  '{"schemaVersion":1,"checkpoint":"initial"}'::jsonb,
  TIMESTAMPTZ '2026-09-05 04:00:00+00'
);

SELECT is(
  public.finalize_ai_run(
    current_setting('test.finalize_ai_run_identity_id')::uuid,
    current_setting('test.finalize_ai_run_user_b_id')::uuid,
    'note-chat',
    TIMESTAMPTZ '2026-09-05 04:00:00+00',
    'succeeded',
    TIMESTAMPTZ '2026-09-05 04:01:00+00',
    '{"schemaVersion":1,"replacement":true}'::jsonb,
    '{}'::uuid[]
  ),
  'conflict',
  $$identity mismatch should conflict$$
);

SELECT ok(
  (
    SELECT
      user_id = current_setting('test.finalize_ai_run_user_a_id')::uuid
      AND feature_type = 'note-chat'
      AND status = 'running'
      AND completed_at IS NULL
      AND snapshots = '{"schemaVersion":1,"checkpoint":"initial"}'::jsonb
    FROM public.ai_runs
    WHERE id = current_setting('test.finalize_ai_run_identity_id')::uuid
  ),
  $$identity conflict should not mutate the existing run$$
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.finalize_ai_run(
        '%s'::uuid,
        '%s'::uuid,
        'note-chat',
        TIMESTAMPTZ '2026-09-05 05:00:00+00',
        'stale',
        TIMESTAMPTZ '2026-09-05 05:01:00+00',
        '{}'::jsonb,
        '{}'::uuid[]
      );
    $sql$,
    gen_random_uuid(),
    current_setting('test.finalize_ai_run_user_a_id')
  ),
  NULL,
  NULL,
  $$finalize_ai_run should reject non-success-failure terminal status$$
);

SELECT * FROM finish();

ROLLBACK;
