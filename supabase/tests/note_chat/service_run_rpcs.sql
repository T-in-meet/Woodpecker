-- =========================================
-- note_chat / service run RPCs
-- =========================================

BEGIN;

SELECT plan(14);

SELECT set_config('test.note_chat_service_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_unverified_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_unverified_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_success_run_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_failure_run_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_unverified_run_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_service_user_id')::uuid,
    'note_chat_service_' || current_setting('test.note_chat_service_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_service_unverified_id')::uuid,
    'note_chat_service_unverified_' || current_setting('test.note_chat_service_unverified_id') || '@example.com',
    NULL,
    '{}'::jsonb
  );

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES
  (
    current_setting('test.note_chat_service_conversation_id')::uuid,
    current_setting('test.note_chat_service_user_id')::uuid,
    'Service conversation'
  ),
  (
    current_setting('test.note_chat_service_unverified_conversation_id')::uuid,
    current_setting('test.note_chat_service_unverified_id')::uuid,
    'Service unverified conversation'
  );

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES
  (
    current_setting('test.note_chat_service_user_message_id')::uuid,
    current_setting('test.note_chat_service_conversation_id')::uuid,
    'user',
    '{"text":"service question"}'::jsonb,
    1
  ),
  (
    current_setting('test.note_chat_service_unverified_message_id')::uuid,
    current_setting('test.note_chat_service_unverified_conversation_id')::uuid,
    'user',
    '{"text":"unverified service question"}'::jsonb,
    1
  );

INSERT INTO public.note_chat_runs (id, user_message_id, status, started_at)
VALUES
  (
    current_setting('test.note_chat_service_success_run_id')::uuid,
    current_setting('test.note_chat_service_user_message_id')::uuid,
    'running',
    now()
  ),
  (
    current_setting('test.note_chat_service_failure_run_id')::uuid,
    current_setting('test.note_chat_service_user_message_id')::uuid,
    'running',
    now()
  ),
  (
    current_setting('test.note_chat_service_unverified_run_id')::uuid,
    current_setting('test.note_chat_service_unverified_message_id')::uuid,
    'running',
    now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_service_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_success(
      current_setting('test.note_chat_service_success_run_id')::uuid,
      '{"text":"blocked"}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute success completion RPC$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_failure(
      current_setting('test.note_chat_service_failure_run_id')::uuid,
      '{}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute failure completion RPC$$
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT set_config(
  'test.note_chat_service_assistant_message_id',
  public.complete_note_chat_run_success(
    current_setting('test.note_chat_service_success_run_id')::uuid,
    '{"text":"service answer"}'::jsonb,
    '[{"noteId":"note-1"}]'::jsonb,
    '{"chat":{"totalTokens":10}}'::jsonb
  )::text,
  true
);

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_service_assistant_message_id')::uuid
  ),
  'assistant',
  $$success RPC should create an assistant message$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_service_assistant_message_id')::uuid
  ),
  2,
  $$success RPC should append the next message sequence$$
);

SELECT ok(
  (
    SELECT status = 'succeeded'
      AND assistant_message_id = current_setting('test.note_chat_service_assistant_message_id')::uuid
      AND completed_at IS NOT NULL
      AND sources = '[{"noteId":"note-1"}]'::jsonb
      AND usage = '{"chat":{"totalTokens":10}}'::jsonb
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_service_success_run_id')::uuid
  ),
  $$success RPC should update the run with completion data$$
);

SELECT ok(
  (
    SELECT updated_at > created_at
    FROM public.note_chat_conversations
    WHERE id = current_setting('test.note_chat_service_conversation_id')::uuid
  ),
  $$success RPC should update conversation updated_at$$
);

SELECT is(
  public.complete_note_chat_run_failure(
    current_setting('test.note_chat_service_failure_run_id')::uuid,
    '{"chat":{"totalTokens":3}}'::jsonb
  ),
  current_setting('test.note_chat_service_failure_run_id')::uuid,
  $$failure RPC should return the run id$$
);

SELECT ok(
  (
    SELECT status = 'failed'
      AND assistant_message_id IS NULL
      AND completed_at IS NOT NULL
      AND usage = '{"chat":{"totalTokens":3}}'::jsonb
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_service_failure_run_id')::uuid
  ),
  $$failure RPC should update the run without creating an assistant message$$
);

SELECT set_config(
  'test.note_chat_service_unverified_assistant_id',
  public.complete_note_chat_run_success(
    current_setting('test.note_chat_service_unverified_run_id')::uuid,
    '{"text":"unverified completed"}'::jsonb
  )::text,
  true
);

SELECT ok(
  (
    SELECT status = 'succeeded'
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_service_unverified_run_id')::uuid
  ),
  $$service completion RPC should not block on user email verification$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_success(
      current_setting('test.note_chat_service_success_run_id')::uuid,
      '{"text":"already completed"}'::jsonb
    );
  $sql$,
  'P0001',
  'run is not running',
  $$success RPC should reject runs that are not running$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_success(
      gen_random_uuid(),
      '{"text":"missing"}'::jsonb
    );
  $sql$,
  'P0001',
  'run not found',
  $$success RPC should reject missing runs$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_success(
      current_setting('test.note_chat_service_success_run_id')::uuid,
      '[]'::jsonb
    );
  $sql$,
  'P0001',
  'content must be a JSON object',
  $$success RPC should reject non-object content$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_run_failure(
      current_setting('test.note_chat_service_success_run_id')::uuid,
      '[]'::jsonb
    );
  $sql$,
  'P0001',
  'usage must be a JSON object',
  $$failure RPC should reject non-object usage$$
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.complete_note_chat_run_success(uuid,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  $$service_role should execute success completion RPC$$
);

SELECT * FROM finish();
ROLLBACK;
