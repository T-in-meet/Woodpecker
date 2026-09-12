-- =========================================
-- note_chat / schema
-- =========================================

BEGIN;

SELECT plan(24);

SELECT ok(to_regclass('public.note_chat_conversations') IS NOT NULL, $$conversations table should exist$$);
SELECT ok(to_regclass('public.note_chat_messages') IS NOT NULL, $$messages table should exist$$);
SELECT ok(to_regclass('public.note_chat_execution_claims') IS NOT NULL, $$execution claims table should exist$$);

SELECT is(
  (
    SELECT format_type(atttypid, atttypmod)
    FROM pg_attribute
    WHERE attrelid = 'public.note_chat_conversations'::regclass
      AND attname = 'title'
  ),
  'text',
  $$conversation title should be text$$
);

SELECT ok(
  (
    SELECT attnotnull
    FROM pg_attribute
    WHERE attrelid = 'public.note_chat_conversations'::regclass
      AND attname = 'title'
  ),
  $$conversation title should be not null$$
);

SELECT set_config('test.note_chat_schema_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_schema_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_schema_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_schema_assistant_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_schema_claim_conversation_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.note_chat_schema_user_id')::uuid,
  'note_chat_schema_' || current_setting('test.note_chat_schema_user_id') || '@example.com',
  now(),
  '{}'::jsonb
);

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES (
  current_setting('test.note_chat_schema_conversation_id')::uuid,
  current_setting('test.note_chat_schema_user_id')::uuid,
  'Valid title'
);

/*
 * Claim completion 제약 테스트는 기존 running Claim의 partial unique index와
 * 충돌하지 않도록 별도 conversation을 사용합니다.
 */
INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES (
  current_setting('test.note_chat_schema_claim_conversation_id')::uuid,
  current_setting('test.note_chat_schema_user_id')::uuid,
  'Claim constraint test'
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_conversations (user_id, title)
      VALUES ('%s'::uuid, repeat('a', 51));
    $sql$,
    current_setting('test.note_chat_schema_user_id')
  ),
  '23514',
  NULL,
  $$conversation title should reject values longer than 50 characters$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_conversations (user_id, title)
      VALUES ('%s'::uuid, '   ');
    $sql$,
    current_setting('test.note_chat_schema_user_id')
  ),
  '23514',
  NULL,
  $$conversation title should reject blank values$$
);

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
      VALUES ('%s'::uuid, '%s'::uuid, 'user', '{"text":"question"}'::jsonb, 1);
    $sql$,
    current_setting('test.note_chat_schema_user_message_id'),
    current_setting('test.note_chat_schema_conversation_id')
  ),
  $$user message with object content should be accepted$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
      VALUES ('%s'::uuid, 'system', '{"text":"blocked"}'::jsonb, 2);
    $sql$,
    current_setting('test.note_chat_schema_conversation_id')
  ),
  '23514',
  NULL,
  $$message role should reject unsupported values$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
      VALUES ('%s'::uuid, 'user', '[]'::jsonb, 2);
    $sql$,
    current_setting('test.note_chat_schema_conversation_id')
  ),
  '23514',
  NULL,
  $$message content should be a JSON object$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
      VALUES ('%s'::uuid, 'user', '{"text":"blocked"}'::jsonb, 0);
    $sql$,
    current_setting('test.note_chat_schema_conversation_id')
  ),
  '23514',
  NULL,
  $$message sequence number should be positive$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
      VALUES ('%s'::uuid, 'assistant', '{"text":"duplicate"}'::jsonb, 1);
    $sql$,
    current_setting('test.note_chat_schema_conversation_id')
  ),
  '23505',
  NULL,
  $$message sequence number should be unique per conversation$$
);

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES (
  current_setting('test.note_chat_schema_assistant_message_id')::uuid,
  current_setting('test.note_chat_schema_conversation_id')::uuid,
  'assistant',
  '{"text":"answer"}'::jsonb,
  2
);

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (user_id, conversation_id)
      VALUES ('%s'::uuid, '%s'::uuid);
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_conversation_id')
  ),
  $$running execution claim should be accepted with defaults$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (user_id, conversation_id, status)
      VALUES ('%s'::uuid, '%s'::uuid, 'cancelled');
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_conversation_id')
  ),
  '23514',
  NULL,
  $$execution claim status should reject unsupported values$$
);

/*
 * Claim status와 completed_at은 실행 제어의 정합성을 함께 표현합니다.
 * running Claim에 완료 시각이 있거나 terminal Claim에 완료 시각이 없으면
 * quota/in-flight 판단이 서로 다른 상태를 읽게 되므로 DB 제약으로 차단합니다.
 */
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (
        user_id,
        conversation_id,
        status,
        completed_at
      )
      VALUES ('%s'::uuid, '%s'::uuid, 'running', now());
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_claim_conversation_id')
  ),
  '23514',
  NULL,
  $$running execution claim should reject completed_at$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (user_id, conversation_id, status)
      VALUES ('%s'::uuid, '%s'::uuid, 'succeeded');
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_claim_conversation_id')
  ),
  '23514',
  NULL,
  $$succeeded execution claim should require completed_at$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (user_id, conversation_id, status)
      VALUES ('%s'::uuid, '%s'::uuid, 'failed');
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_claim_conversation_id')
  ),
  '23514',
  NULL,
  $$failed execution claim should require completed_at$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_execution_claims (user_id, conversation_id, status)
      VALUES ('%s'::uuid, '%s'::uuid, 'stale');
    $sql$,
    current_setting('test.note_chat_schema_user_id'),
    current_setting('test.note_chat_schema_claim_conversation_id')
  ),
  '23514',
  NULL,
  $$stale execution claim should require completed_at$$
);

SELECT ok(to_regclass('public.note_chat_conversations_user_updated_at_idx') IS NOT NULL, $$conversation list index should exist$$);
SELECT ok(to_regclass('public.note_chat_conversations_title_trgm_idx') IS NOT NULL, $$conversation title trigram index should exist$$);
SELECT ok(to_regclass('public.note_chat_messages_conversation_sequence_idx') IS NOT NULL, $$message sequence index should exist$$);

/*
 * Claim 조회는 conversation 단위 in-flight 차단, 사용자별 일일 quota 계산,
 * stale 실행 정리의 세 경로에서 반복되므로 각 접근 패턴의 인덱스를 보장합니다.
 */
SELECT ok(
  to_regclass('public.note_chat_execution_claims_active_uidx') IS NOT NULL,
  $$execution claim active unique index should exist$$
);

SELECT ok(
  to_regclass('public.note_chat_execution_claims_user_claimed_idx') IS NOT NULL,
  $$execution claim user quota index should exist$$
);

SELECT ok(
  to_regclass('public.note_chat_execution_claims_status_claimed_idx') IS NOT NULL,
  $$execution claim status cleanup index should exist$$
);

SELECT * FROM finish();

ROLLBACK;
