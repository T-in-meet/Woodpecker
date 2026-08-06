-- =========================================
-- note_chat / user RPCs
-- =========================================

BEGIN;

SELECT plan(17);

SELECT set_config('test.note_chat_rpc_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rpc_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rpc_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rpc_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rpc_other_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rpc_unverified_conversation_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_rpc_user_id')::uuid,
    'note_chat_rpc_' || current_setting('test.note_chat_rpc_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_rpc_other_user_id')::uuid,
    'note_chat_rpc_other_' || current_setting('test.note_chat_rpc_other_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_rpc_unverified_id')::uuid,
    'note_chat_rpc_unverified_' || current_setting('test.note_chat_rpc_unverified_id') || '@example.com',
    NULL,
    '{}'::jsonb
  );

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES
  (
    current_setting('test.note_chat_rpc_conversation_id')::uuid,
    current_setting('test.note_chat_rpc_user_id')::uuid,
    'RPC conversation'
  ),
  (
    current_setting('test.note_chat_rpc_other_conversation_id')::uuid,
    current_setting('test.note_chat_rpc_other_user_id')::uuid,
    'Other RPC conversation'
  ),
  (
    current_setting('test.note_chat_rpc_unverified_conversation_id')::uuid,
    current_setting('test.note_chat_rpc_unverified_id')::uuid,
    'Unverified RPC conversation'
  );

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"anon"}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$anon should not execute create_note_chat_question$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT *
FROM public.create_note_chat_question(
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  '{"text":"first question"}'::jsonb
)
\gset test_note_chat_rpc_first_

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_first_user_message_id'::uuid
  ),
  'user',
  $$create_note_chat_question should create a user message$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_first_user_message_id'::uuid
  ),
  1,
  $$first created user message should use sequence number 1$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_first_run_id'::uuid
  ),
  'pending',
  $$create_note_chat_question should create a pending run$$
);

SELECT ok(
  (
    SELECT updated_at > created_at
    FROM public.note_chat_conversations
    WHERE id = current_setting('test.note_chat_rpc_conversation_id')::uuid
  ),
  $$create_note_chat_question should update conversation updated_at$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_other_conversation_id')::uuid,
      '{"text":"blocked"}'::jsonb
    );
  $sql$,
  'P0001',
  'conversation not found',
  $$create_note_chat_question should reject another user's conversation$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '[]'::jsonb
    );
  $sql$,
  'P0001',
  'content must be a JSON object',
  $$create_note_chat_question should reject non-object content$$
);

SELECT *
FROM public.create_note_chat_question(
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  '{"text":"second question"}'::jsonb
)
\gset test_note_chat_rpc_second_

RESET ROLE;

INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
VALUES
  (
    current_setting('test.note_chat_rpc_conversation_id')::uuid,
    'assistant',
    '{"text":"answer after second"}'::jsonb,
    3
  ),
  (
    current_setting('test.note_chat_rpc_conversation_id')::uuid,
    'user',
    '{"text":"third question"}'::jsonb,
    4
  );

SELECT set_config(
  'test.note_chat_rpc_deleted_message_id',
  (
    SELECT id::text
    FROM public.note_chat_messages
    WHERE conversation_id = current_setting('test.note_chat_rpc_conversation_id')::uuid
      AND sequence_number = 4
  ),
  true
);

INSERT INTO public.note_chat_runs (user_message_id)
VALUES (current_setting('test.note_chat_rpc_deleted_message_id')::uuid);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT *
FROM public.update_note_chat_user_message(
  :'test_note_chat_rpc_second_user_message_id'::uuid,
  '{"text":"edited second question"}'::jsonb
)
\gset test_note_chat_rpc_edit_

SELECT is(
  (
    SELECT content->>'text'
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_second_user_message_id'::uuid
  ),
  'edited second question',
  $$update_note_chat_user_message should update target user message content$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_second_user_message_id'::uuid
  ),
  2,
  $$update_note_chat_user_message should keep the target sequence number$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_messages
    WHERE conversation_id = current_setting('test.note_chat_rpc_conversation_id')::uuid
      AND sequence_number > 2
  ),
  0::bigint,
  $$update_note_chat_user_message should delete later messages$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_runs
    WHERE user_message_id = current_setting('test.note_chat_rpc_deleted_message_id')::uuid
  ),
  0::bigint,
  $$deleting later messages should cascade to connected runs$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_edit_run_id'::uuid
  ),
  'pending',
  $$update_note_chat_user_message should create a new pending run$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_deleted_message_id')::uuid,
      '{"text":"blocked"}'::jsonb
    );
  $sql$,
  'P0001',
  'user message not found',
  $$update_note_chat_user_message should reject missing or deleted user messages$$
);

RESET ROLE;

INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
VALUES (
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  'assistant',
  '{"text":"assistant cannot be edited"}'::jsonb,
  3
);

SELECT set_config(
  'test.note_chat_rpc_assistant_message_id',
  (
    SELECT id::text
    FROM public.note_chat_messages
    WHERE conversation_id = current_setting('test.note_chat_rpc_conversation_id')::uuid
      AND role = 'assistant'
    ORDER BY sequence_number DESC
    LIMIT 1
  ),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_assistant_message_id')::uuid,
      '{"text":"blocked assistant"}'::jsonb
    );
  $sql$,
  'P0001',
  'user message not found',
  $$update_note_chat_user_message should reject assistant messages$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rpc_unverified_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_unverified_conversation_id')::uuid,
      '{"text":"unverified"}'::jsonb
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified users should not create note chat questions$$
);

RESET ROLE;

ALTER TABLE public.note_chat_runs
ADD CONSTRAINT note_chat_runs_test_atomic_failure
CHECK (status <> 'pending') NOT VALID;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"atomic marker"}'::jsonb
    );
  $sql$,
  '23514',
  NULL,
  $$run insert failure should fail the RPC atomically$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_messages
    WHERE content->>'text' = 'atomic marker'
  ),
  0::bigint,
  $$run insert failure should leave no orphan user message$$
);

SELECT * FROM finish();
ROLLBACK;
