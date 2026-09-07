-- =========================================
-- note_chat / foreign keys
-- =========================================

BEGIN;

SELECT plan(1);

-- 대화와 메시지의 FK 관계를 검증할 테스트 전용 식별자를 생성한다.
SELECT set_config('test.note_chat_fk_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_fk_assistant_message_id', gen_random_uuid()::text, true);

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

-- 메시지의 상위 객체가 될 대화를 생성한다.
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

-- 대화 삭제 시 cascade 동작을 검증할 사용자/어시스턴트 메시지를 생성한다.
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
