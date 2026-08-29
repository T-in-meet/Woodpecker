-- =========================================
-- note_chat / question and edit RPCs
-- =========================================

BEGIN;

SELECT plan(16);

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

SELECT hasnt_function(
  'public',
  'create_note_chat_question',
  ARRAY['uuid', 'uuid', 'jsonb', 'integer', 'uuid', 'uuid', 'uuid', 'uuid'],
  $$run/quota-coupled create_note_chat_question should be removed$$
);

SELECT hasnt_function(
  'public',
  'update_note_chat_user_message',
  ARRAY['uuid', 'uuid', 'jsonb', 'integer', 'uuid', 'uuid', 'uuid', 'uuid'],
  $$run/quota-coupled update_note_chat_user_message should be removed$$
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
    SELECT public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"authenticated new"}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute service create_note_chat_question$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      gen_random_uuid(),
      '{"text":"authenticated update"}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute service update_note_chat_user_message$$
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT set_config(
  'test.note_chat_rpc_first_user_message_id',
  public.create_note_chat_question(
    current_setting('test.note_chat_rpc_user_id')::uuid,
    current_setting('test.note_chat_rpc_conversation_id')::uuid,
    '{"text":"first question"}'::jsonb
  )::text,
  true
);

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_rpc_first_user_message_id')::uuid
  ),
  'user',
  $$create_note_chat_question should create a user message$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_rpc_first_user_message_id')::uuid
  ),
  1,
  $$first created user message should use sequence number 1$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_runs
    WHERE user_message_id = current_setting('test.note_chat_rpc_first_user_message_id')::uuid
  ),
  0::bigint,
  $$create_note_chat_question should not create a Run audit record$$
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
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
    SELECT public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '[]'::jsonb
    );
  $sql$,
  'P0001',
  'content must be a JSON object',
  $$create_note_chat_question should reject non-object content$$
);

SELECT set_config(
  'test.note_chat_rpc_second_user_message_id',
  public.create_note_chat_question(
    current_setting('test.note_chat_rpc_user_id')::uuid,
    current_setting('test.note_chat_rpc_conversation_id')::uuid,
    '{"text":"second question"}'::jsonb
  )::text,
  true
);

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

SELECT *
FROM public.update_note_chat_user_message(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  current_setting('test.note_chat_rpc_second_user_message_id')::uuid,
  '{"text":"edited second question"}'::jsonb
)
\gset test_note_chat_rpc_edit_

SELECT is(
  :'test_note_chat_rpc_edit_conversation_id'::uuid,
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  $$update_note_chat_user_message should return the conversation ID$$
);

SELECT is(
  (
    SELECT content->>'text'
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_rpc_second_user_message_id')::uuid
  ),
  'edited second question',
  $$update_note_chat_user_message should update target user message content$$
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
    SELECT count(*)
    FROM public.note_chat_runs
    WHERE user_message_id = current_setting('test.note_chat_rpc_second_user_message_id')::uuid
  ),
  0::bigint,
  $$update_note_chat_user_message should not create a Run audit record$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_deleted_message_id')::uuid,
      '{"text":"blocked"}'::jsonb
    );
  $sql$,
  'P0001',
  'user message not found',
  $$update_note_chat_user_message should reject missing or deleted user messages$$
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_chat_question(
      current_setting('test.note_chat_rpc_unverified_id')::uuid,
      current_setting('test.note_chat_rpc_unverified_conversation_id')::uuid,
      '{"text":"unverified"}'::jsonb
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified users should not create note chat questions$$
);

SELECT * FROM finish();

ROLLBACK;
