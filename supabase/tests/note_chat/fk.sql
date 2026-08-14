-- =========================================
-- note_chat / foreign keys
-- =========================================

BEGIN;

SELECT plan(8);

-- 각 FK 관계를 서로 독립적으로 검증할 수 있도록 테스트 전용 식별자를 생성한다.
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

-- note_chat 데이터의 소유자로 사용할 테스트 사용자를 생성한다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES (
  current_setting('test.note_chat_fk_user_id')::uuid,
  'note_chat_fk_' || current_setting('test.note_chat_fk_user_id') || '@example.com',
  now(),
  '{}'::jsonb
);

-- run이 참조할 Chat/Embedding 모델을 각각 생성한다.
-- ai_model_configs.key는 제거되었으므로 현재 모델 스키마의 식별 정보만 사용한다.
-- Embedding 모델은 현재 vector 계약에 맞춰 dimensions=1536을 사용한다.
INSERT INTO public.ai_model_configs (
  id,
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
    'FK Chat Model',
    'test',
    'fk-chat',
    'chat',
    NULL,
    NULL
  ),
  (
    current_setting('test.note_chat_fk_embedding_model_id')::uuid,
    'FK Embedding Model',
    'test',
    'fk-embedding',
    'embedding',
    1536,
    'cosine'
  );

-- run.agent_id의 ON DELETE SET NULL 동작을 검증하기 위한 Agent를 생성한다.
-- ai_prompt_agents.key는 제거되었으므로 표시 이름만 테스트 fixture로 사용한다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES
  (
    current_setting('test.note_chat_fk_agent_id')::uuid,
    'FK Agent'
  ),
  (
    current_setting('test.note_chat_fk_agent_only_id')::uuid,
    'FK Agent Only'
  );

-- Prompt Version이 소속될 Family를 생성한다.
-- ai_prompt_families.key는 제거되었으므로 Agent 관계와 표시 이름만 지정한다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES (
  current_setting('test.note_chat_fk_family_id')::uuid,
  current_setting('test.note_chat_fk_agent_id')::uuid,
  'FK Family'
);

-- run.prompt_version_id의 ON DELETE SET NULL 동작을 검증할 Prompt Version을 생성한다.
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

-- 메시지와 run의 상위 객체가 될 대화를 생성한다.
INSERT INTO public.note_chat_conversations (
  id,
  user_id,
  title
)
VALUES (
  current_setting('test.note_chat_fk_conversation_id')::uuid,
  current_setting('test.note_chat_fk_user_id')::uuid,
  'FK conversation'
);

-- run의 입력/출력 메시지 FK를 검증할 사용자/어시스턴트 메시지를 생성한다.
INSERT INTO public.note_chat_messages (
  id,
  conversation_id,
  role,
  content,
  sequence_number
)
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

-- Agent, Prompt Version, Chat 모델, Embedding 모델을 모두 참조하는 완료 run을 생성한다.
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

-- Agent 삭제 동작을 다른 FK 검증과 분리하기 위한 별도 run을 생성한다.
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

-- Agent가 삭제되어도 실행 이력은 유지하고 agent_id만 NULL로 전환되어야 한다.
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

-- Prompt Version 삭제 시 실행 이력은 유지하고 prompt_version_id만 NULL이어야 한다.
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

-- Chat 모델 삭제 시 실행 이력은 유지하고 chat_model_config_id만 NULL이어야 한다.
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

-- Embedding 모델 삭제 시 실행 이력은 유지하고 embedding_model_config_id만 NULL이어야 한다.
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

-- run 삭제가 연결된 메시지를 삭제하지 않는지 확인한다.
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

-- 사용자 메시지 삭제 시 해당 메시지를 기준으로 생성된 run은 함께 삭제되어야 한다.
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

-- 대화 삭제 시 대화에 속한 모든 메시지가 함께 삭제되어야 한다.
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