-- =========================================
-- note_chat / conversation list view
-- =========================================

BEGIN;

SELECT plan(10);

SELECT set_config('test.note_chat_view_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_view_empty_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_view_old_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_view_new_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  current_setting('test.note_chat_view_user_id')::uuid,
  'note_chat_view_' || current_setting('test.note_chat_view_user_id') || '@example.com',
  now(),
  '{}'::jsonb
);

INSERT INTO public.note_chat_conversations (id, user_id, title, created_at, updated_at)
VALUES
  (
    current_setting('test.note_chat_view_empty_id')::uuid,
    current_setting('test.note_chat_view_user_id')::uuid,
    'Empty topic',
    '2026-08-01T00:00:00Z',
    '2026-08-01T00:00:00Z'
  ),
  (
    current_setting('test.note_chat_view_old_id')::uuid,
    current_setting('test.note_chat_view_user_id')::uuid,
    'Alpha topic',
    '2026-08-01T00:00:00Z',
    '2026-08-02T00:00:00Z'
  ),
  (
    current_setting('test.note_chat_view_new_id')::uuid,
    current_setting('test.note_chat_view_user_id')::uuid,
    'Beta topic',
    '2026-08-01T00:00:00Z',
    '2026-08-03T00:00:00Z'
  );

INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number, created_at)
VALUES
  (
    current_setting('test.note_chat_view_old_id')::uuid,
    'user',
    '{"text":"old question"}'::jsonb,
    1,
    '2026-08-02T00:00:00Z'
  ),
  (
    current_setting('test.note_chat_view_old_id')::uuid,
    'assistant',
    '{"text":"old answer"}'::jsonb,
    2,
    '2026-08-02T00:01:00Z'
  ),
  (
    current_setting('test.note_chat_view_new_id')::uuid,
    'user',
    '{"text":"new question"}'::jsonb,
    1,
    '2026-08-03T00:00:00Z'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_view_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_conversation_list
  ),
  3::bigint,
  $$conversation list view should include conversations without messages$$
);

SELECT is(
  (
    SELECT last_message_role
    FROM public.note_chat_conversation_list
    WHERE id = current_setting('test.note_chat_view_old_id')::uuid
  ),
  'assistant',
  $$conversation list view should return the actual last message role$$
);

SELECT is(
  (
    SELECT last_message_content->>'text'
    FROM public.note_chat_conversation_list
    WHERE id = current_setting('test.note_chat_view_old_id')::uuid
  ),
  'old answer',
  $$conversation list view should return the actual last message content$$
);

SELECT is(
  (
    SELECT last_message_id
    FROM public.note_chat_conversation_list
    WHERE id = current_setting('test.note_chat_view_empty_id')::uuid
  ),
  NULL::uuid,
  $$conversation list view should return null last message values for empty conversations$$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'note_chat_conversation_list'
      AND column_name = 'user_id'
  ),
  0,
  $$conversation list view should not expose user_id$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_conversation_list
    WHERE title ILIKE '%Alpha%'
  ),
  1::bigint,
  $$callers should search titles by querying the view$$
);

SELECT is(
  (
    SELECT id
    FROM public.note_chat_conversation_list
    ORDER BY updated_at DESC
    LIMIT 1
  ),
  current_setting('test.note_chat_view_new_id')::uuid,
  $$callers should sort the view by recent activity$$
);

SELECT is(
  (
    SELECT id
    FROM public.note_chat_conversation_list
    ORDER BY updated_at DESC
    LIMIT 1
    OFFSET 1
  ),
  current_setting('test.note_chat_view_old_id')::uuid,
  $$callers should paginate the sorted view with limit and offset$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_conversation_list
    WHERE title ILIKE '%topic%'
  ),
  3::bigint,
  $$callers should count filtered rows on the view$$
);

SELECT ok(
  has_table_privilege('authenticated', 'public.note_chat_conversation_list', 'SELECT'),
  $$authenticated should be able to select the user conversation list view$$
);

SELECT * FROM finish();
ROLLBACK;