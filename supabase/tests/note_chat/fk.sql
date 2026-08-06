-- =========================================
-- note_chat / foreign keys
-- =========================================

BEGIN;

SELECT plan(8);

SELECT set_config('test.note_chat_fk_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_assistant_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_run_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_agent_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_agent_only_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_agent_only_run_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_family_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_prompt_version_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_chat_model_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_embedding_model_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.note_chat_fk_user_id')::uuid,
  'note_chat_fk_' || current_setting('test.note_chat_fk_user_id') || '@example.com',
  now(),
  '{}'::jsonb
);

INSERT INTO public.ai_model_configs (
  id,
  key,
  display_name,
  provider,
  model,
  capability,
  dimensions,
  distance_metric
)
VALUES
  (
    current_setting('test.note_chat_fk_chat_model_id')::uuid,
    'tests.note-chat-fk-chat',
    'FK Chat Model',
    'test',
    'fk-chat',
    'chat',
    NULL,
    NULL
  ),
  (
    current_setting('test.note_chat_fk_embedding_model_id')::uuid,
    'tests.note-chat-fk-embedding',
    'FK Embedding Model',
    'test',
    'fk-embedding',
    'embedding',
    1536,
    'cosine'
  );

INSERT INTO public.ai_prompt_agents (id, key, display_name)
VALUES
  (
    current_setting('test.note_chat_fk_agent_id')::uuid,
    'tests.note.chat.fk',
    'FK Agent'
  ),
  (
    current_setting('test.note_chat_fk_agent_only_id')::uuid,
    'tests.note.chat.fk_agent_only',
    'FK Agent Only'
  );

INSERT INTO public.ai_prompt_families (id, agent_id, key, display_name)
VALUES (
  current_setting('test.note_chat_fk_family_id')::uuid,
  current_setting('test.note_chat_fk_agent_id')::uuid,
  'fk-family',
  'FK Family'
);

INSERT INTO public.ai_prompt_versions (
  id,
  family_id,
  version_number,
  display_name,
  lifecycle_status,
  system_template,
  user_template,
  created_by_kind,
  created_by
)
VALUES (
  current_setting('test.note_chat_fk_prompt_version_id')::uuid,
  current_setting('test.note_chat_fk_family_id')::uuid,
  1,
  'FK Prompt Version',
  'draft',
  'System',
  'User',
  'user',
  current_setting('test.note_chat_fk_user_id')::uuid
);

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES (
  current_setting('test.note_chat_fk_conversation_id')::uuid,
  current_setting('test.note_chat_fk_user_id')::uuid,
  'FK conversation'
);

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES
  (
    current_setting('test.note_chat_fk_user_message_id')::uuid,
    current_setting('test.note_chat_fk_conversation_id')::uuid,
    'user',
    '{"text":"question"}'::jsonb,
    1
  ),
  (
    current_setting('test.note_chat_fk_assistant_message_id')::uuid,
    current_setting('test.note_chat_fk_conversation_id')::uuid,
    'assistant',
    '{"text":"answer"}'::jsonb,
    2
  );

INSERT INTO public.note_chat_runs (
  id,
  user_message_id,
  assistant_message_id,
  status,
  agent_id,
  prompt_version_id,
  chat_model_config_id,
  embedding_model_config_id,
  started_at,
  completed_at
)
VALUES (
  current_setting('test.note_chat_fk_run_id')::uuid,
  current_setting('test.note_chat_fk_user_message_id')::uuid,
  current_setting('test.note_chat_fk_assistant_message_id')::uuid,
  'succeeded',
  current_setting('test.note_chat_fk_agent_id')::uuid,
  current_setting('test.note_chat_fk_prompt_version_id')::uuid,
  current_setting('test.note_chat_fk_chat_model_id')::uuid,
  current_setting('test.note_chat_fk_embedding_model_id')::uuid,
  now(),
  now()
);

INSERT INTO public.note_chat_runs (
  id,
  user_message_id,
  status,
  agent_id
)
VALUES (
  current_setting('test.note_chat_fk_agent_only_run_id')::uuid,
  current_setting('test.note_chat_fk_user_message_id')::uuid,
  'pending',
  current_setting('test.note_chat_fk_agent_only_id')::uuid
);

DELETE FROM public.ai_prompt_agents
WHERE id = current_setting('test.note_chat_fk_agent_only_id')::uuid;

SELECT is(
  (
    SELECT agent_id
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_fk_agent_only_run_id')::uuid
  ),
  NULL::uuid,
  $$deleting an agent should set run.agent_id to null$$
);

DELETE FROM public.ai_prompt_versions
WHERE id = current_setting('test.note_chat_fk_prompt_version_id')::uuid;

SELECT is(
  (
    SELECT prompt_version_id
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_fk_run_id')::uuid
  ),
  NULL::uuid,
  $$deleting a prompt version should set run.prompt_version_id to null$$
);

DELETE FROM public.ai_model_configs
WHERE id = current_setting('test.note_chat_fk_chat_model_id')::uuid;

SELECT is(
  (
    SELECT chat_model_config_id
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_fk_run_id')::uuid
  ),
  NULL::uuid,
  $$deleting a chat model should set run.chat_model_config_id to null$$
);

DELETE FROM public.ai_model_configs
WHERE id = current_setting('test.note_chat_fk_embedding_model_id')::uuid;

SELECT is(
  (
    SELECT embedding_model_config_id
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_fk_run_id')::uuid
  ),
  NULL::uuid,
  $$deleting an embedding model should set run.embedding_model_config_id to null$$
);

DELETE FROM public.note_chat_runs
WHERE id = current_setting('test.note_chat_fk_run_id')::uuid;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_fk_user_message_id')::uuid
  ),
  $$deleting a run should not delete the user message$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_fk_assistant_message_id')::uuid
  ),
  $$deleting a run should not delete the assistant message$$
);

INSERT INTO public.note_chat_runs (
  id,
  user_message_id,
  status
)
VALUES (
  current_setting('test.note_chat_fk_run_id')::uuid,
  current_setting('test.note_chat_fk_user_message_id')::uuid,
  'pending'
);

DELETE FROM public.note_chat_messages
WHERE id = current_setting('test.note_chat_fk_user_message_id')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_runs
    WHERE id = current_setting('test.note_chat_fk_run_id')::uuid
  ),
  0::bigint,
  $$deleting a user message should cascade to runs$$
);

DELETE FROM public.note_chat_conversations
WHERE id = current_setting('test.note_chat_fk_conversation_id')::uuid;

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_messages
    WHERE conversation_id = current_setting('test.note_chat_fk_conversation_id')::uuid
  ),
  0::bigint,
  $$deleting a conversation should cascade to messages$$
);

SELECT * FROM finish();
ROLLBACK;
