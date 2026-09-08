-- =========================================
-- note_chat / RLS
-- =========================================

BEGIN;

SELECT plan(10);

SELECT set_config('test.note_chat_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_conversation_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_conversation_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_conversation_unverified_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_message_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_rls_message_b_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_rls_user_a_id')::uuid,
    'note_chat_rls_a_' || current_setting('test.note_chat_rls_user_a_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_rls_user_b_id')::uuid,
    'note_chat_rls_b_' || current_setting('test.note_chat_rls_user_b_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_rls_unverified_id')::uuid,
    'note_chat_rls_unverified_' || current_setting('test.note_chat_rls_unverified_id') || '@example.com',
    NULL,
    '{}'::jsonb
  );

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES
  (
    current_setting('test.note_chat_rls_conversation_a_id')::uuid,
    current_setting('test.note_chat_rls_user_a_id')::uuid,
    'User A conversation'
  ),
  (
    current_setting('test.note_chat_rls_conversation_b_id')::uuid,
    current_setting('test.note_chat_rls_user_b_id')::uuid,
    'User B conversation'
  ),
  (
    current_setting('test.note_chat_rls_conversation_unverified_id')::uuid,
    current_setting('test.note_chat_rls_unverified_id')::uuid,
    'Unverified conversation'
  );

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES
  (
    current_setting('test.note_chat_rls_message_a_id')::uuid,
    current_setting('test.note_chat_rls_conversation_a_id')::uuid,
    'user',
    '{"text":"a question"}'::jsonb,
    1
  ),
  (
    current_setting('test.note_chat_rls_message_b_id')::uuid,
    current_setting('test.note_chat_rls_conversation_b_id')::uuid,
    'user',
    '{"text":"b question"}'::jsonb,
    1
  );

SELECT ok(
  has_column_privilege('authenticated', 'public.note_chat_conversations', 'title', 'UPDATE'),
  $$authenticated should have title column update privilege$$
);

SELECT ok(
  has_column_privilege('authenticated', 'public.note_chat_conversations', 'updated_at', 'UPDATE'),
  $$authenticated should have updated_at column update privilege$$
);

SELECT ok(
  NOT has_column_privilege('authenticated', 'public.note_chat_conversations', 'user_id', 'UPDATE'),
  $$authenticated should not have user_id update privilege$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.note_chat_conversations),
  1::bigint,
  $$authenticated users should select only their own conversations$$
);

SELECT is(
  (SELECT count(*) FROM public.note_chat_messages),
  1::bigint,
  $$authenticated users should select only their own messages$$
);

WITH updated AS (
  UPDATE public.note_chat_conversations
  SET title = 'Renamed conversation',
      updated_at = now()
  WHERE id = current_setting('test.note_chat_rls_conversation_a_id')::uuid
  RETURNING title
)
SELECT is(
  (SELECT title FROM updated),
  'Renamed conversation',
  $$confirmed owner should update conversation title and updated_at$$
);

WITH updated AS (
  UPDATE public.note_chat_conversations
  SET title = 'Blocked other'
  WHERE id = current_setting('test.note_chat_rls_conversation_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$users should not update other users' conversation titles$$
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.note_chat_conversations
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_chat_rls_user_b_id'),
    current_setting('test.note_chat_rls_conversation_a_id')
  ),
  '42501',
  NULL,
  $$users should not update conversation user_id even for their own row$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_rls_unverified_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.note_chat_conversations
  SET title = 'Unverified blocked',
      updated_at = now()
  WHERE id = current_setting('test.note_chat_rls_conversation_unverified_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$unverified owners should not update conversation title$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT count(*)
    FROM public.note_chat_conversations;
  $sql$,
  '42501',
  NULL,
  $$anon should not select conversations$$
);

SELECT * FROM finish();
ROLLBACK;