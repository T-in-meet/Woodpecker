-- =========================================
-- note_chat / schema
-- =========================================

BEGIN;

SELECT plan(26);

SELECT ok(to_regclass('public.note_chat_conversations') IS NOT NULL, $$conversations table should exist$$);
SELECT ok(to_regclass('public.note_chat_messages') IS NOT NULL, $$messages table should exist$$);
SELECT ok(to_regclass('public.note_chat_runs') IS NOT NULL, $$runs table should exist$$);

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
      INSERT INTO public.note_chat_runs (user_message_id)
      VALUES ('%s'::uuid);
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  $$pending run should be accepted with defaults$$
);

SELECT is(
  (
    SELECT sources
    FROM public.note_chat_runs
    WHERE user_message_id = current_setting('test.note_chat_schema_user_message_id')::uuid
    ORDER BY created_at DESC
    LIMIT 1
  ),
  '[]'::jsonb,
  $$run sources should default to an empty array$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (user_message_id, status)
      VALUES ('%s'::uuid, 'cancelled');
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  '23514',
  NULL,
  $$run status should reject unsupported values$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (user_message_id, sources)
      VALUES ('%s'::uuid, '{}'::jsonb);
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  '23514',
  NULL,
  $$run sources should be a JSON array$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (user_message_id, usage)
      VALUES ('%s'::uuid, '[]'::jsonb);
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  '23514',
  NULL,
  $$run usage should be null or a JSON object$$
);

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (user_message_id, memo)
      VALUES ('%s'::uuid, repeat('m', 500));
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  $$run memo should allow 500 characters$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (user_message_id, memo)
      VALUES ('%s'::uuid, repeat('m', 501));
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  '23514',
  NULL,
  $$run memo should reject values longer than 500 characters$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (
        user_message_id,
        status,
        started_at
      )
      VALUES ('%s'::uuid, 'succeeded', now());
    $sql$,
    current_setting('test.note_chat_schema_user_message_id')
  ),
  '23514',
  NULL,
  $$succeeded run should require completed_at and assistant message$$
);

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (
        user_message_id,
        assistant_message_id,
        status,
        started_at,
        completed_at
      )
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        'succeeded',
        now(),
        now()
      );
    $sql$,
    current_setting('test.note_chat_schema_user_message_id'),
    current_setting('test.note_chat_schema_assistant_message_id')
  ),
  $$succeeded run should allow a connected assistant message$$
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.note_chat_runs (
        user_message_id,
        assistant_message_id,
        status,
        started_at,
        completed_at
      )
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        'succeeded',
        now(),
        now()
      );
    $sql$,
    current_setting('test.note_chat_schema_user_message_id'),
    current_setting('test.note_chat_schema_assistant_message_id')
  ),
  '23505',
  NULL,
  $$assistant message should be connected to at most one run$$
);

SELECT ok(to_regclass('public.note_chat_conversations_user_updated_at_idx') IS NOT NULL, $$conversation list index should exist$$);
SELECT ok(to_regclass('public.note_chat_conversations_title_trgm_idx') IS NOT NULL, $$conversation title trigram index should exist$$);
SELECT ok(to_regclass('public.note_chat_messages_conversation_sequence_idx') IS NOT NULL, $$message sequence index should exist$$);
SELECT ok(to_regclass('public.note_chat_runs_status_created_at_idx') IS NOT NULL, $$run status index should exist$$);

SELECT * FROM finish();
ROLLBACK;
