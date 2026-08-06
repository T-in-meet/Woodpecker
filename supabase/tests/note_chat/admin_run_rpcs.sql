-- =========================================
-- note_chat / admin run views and RPCs
-- =========================================

BEGIN;

SELECT plan(15);

SELECT set_config('test.note_chat_admin_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_conversation_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_conversation_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_message_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_message_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_message_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_run_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_run_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_run_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_chat_model_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_admin_chat_model_b_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_admin_user_a_id')::uuid,
    'note_chat_admin_a_' || current_setting('test.note_chat_admin_user_a_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_admin_user_b_id')::uuid,
    'note_chat_admin_b_' || current_setting('test.note_chat_admin_user_b_id') || '@example.com',
    now(),
    '{}'::jsonb
  );

UPDATE public.profiles
SET nickname = 'AlphaUser'
WHERE id = current_setting('test.note_chat_admin_user_a_id')::uuid;

UPDATE public.profiles
SET nickname = 'BetaUser'
WHERE id = current_setting('test.note_chat_admin_user_b_id')::uuid;

INSERT INTO public.ai_model_configs (id, key, display_name, provider, model, capability)
VALUES
  (
    current_setting('test.note_chat_admin_chat_model_a_id')::uuid,
    'tests.note-chat-admin-chat-a',
    'Admin Chat A',
    'test',
    'admin-chat-a',
    'chat'
  ),
  (
    current_setting('test.note_chat_admin_chat_model_b_id')::uuid,
    'tests.note-chat-admin-chat-b',
    'Admin Chat B',
    'test',
    'admin-chat-b',
    'chat'
  );

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES
  (
    current_setting('test.note_chat_admin_conversation_a_id')::uuid,
    current_setting('test.note_chat_admin_user_a_id')::uuid,
    'Admin A conversation'
  ),
  (
    current_setting('test.note_chat_admin_conversation_b_id')::uuid,
    current_setting('test.note_chat_admin_user_b_id')::uuid,
    'Admin B conversation'
  );

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES
  (
    current_setting('test.note_chat_admin_message_a_id')::uuid,
    current_setting('test.note_chat_admin_conversation_a_id')::uuid,
    'user',
    '{"text":"alpha searchable question"}'::jsonb,
    1
  ),
  (
    current_setting('test.note_chat_admin_message_b_id')::uuid,
    current_setting('test.note_chat_admin_conversation_b_id')::uuid,
    'user',
    '{"text":"beta searchable question"}'::jsonb,
    1
  ),
  (
    current_setting('test.note_chat_admin_message_c_id')::uuid,
    current_setting('test.note_chat_admin_conversation_b_id')::uuid,
    'user',
    '{"text":"gamma question"}'::jsonb,
    2
  );

INSERT INTO public.note_chat_runs (
  id,
  user_message_id,
  status,
  chat_model_config_id,
  memo,
  created_at
)
VALUES
  (
    current_setting('test.note_chat_admin_run_a_id')::uuid,
    current_setting('test.note_chat_admin_message_a_id')::uuid,
    'pending',
    current_setting('test.note_chat_admin_chat_model_a_id')::uuid,
    NULL,
    '2026-08-01T00:00:00Z'
  ),
  (
    current_setting('test.note_chat_admin_run_b_id')::uuid,
    current_setting('test.note_chat_admin_message_b_id')::uuid,
    'pending',
    current_setting('test.note_chat_admin_chat_model_b_id')::uuid,
    'memo exists',
    '2026-08-02T00:00:00Z'
  ),
  (
    current_setting('test.note_chat_admin_run_c_id')::uuid,
    current_setting('test.note_chat_admin_message_c_id')::uuid,
    'pending',
    current_setting('test.note_chat_admin_chat_model_a_id')::uuid,
    '   ',
    '2026-08-03T00:00:00Z'
  );

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (
    SELECT conversation_title
    FROM public.admin_note_chat_run_detail
    WHERE id = current_setting('test.note_chat_admin_run_a_id')::uuid
  ),
  'Admin A conversation',
  $$admin run detail should expose conversation title$$
);

SELECT is(
  (
    SELECT user_nickname
    FROM public.admin_note_chat_run_detail
    WHERE id = current_setting('test.note_chat_admin_run_b_id')::uuid
  ),
  'BetaUser',
  $$admin run detail should expose user nickname$$
);

DELETE FROM public.ai_model_configs
WHERE id = current_setting('test.note_chat_admin_chat_model_b_id')::uuid;

SELECT is(
  (
    SELECT chat_model_display_name
    FROM public.admin_note_chat_run_detail
    WHERE id = current_setting('test.note_chat_admin_run_b_id')::uuid
  ),
  NULL::text,
  $$admin run detail should keep rows and return null display values for deleted FK targets$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      'alpha',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  1::bigint,
  $$admin run list should search user nickname and question text$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      ARRAY['pending']::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  3::bigint,
  $$admin run list should filter by statuses$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      ARRAY[current_setting('test.note_chat_admin_chat_model_a_id')::uuid],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  2::bigint,
  $$admin run list should filter by chat model ids$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      true,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  1::bigint,
  $$admin run list should treat nonblank memo as has memo$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      false,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  2::bigint,
  $$admin run list should treat null or blank memo as no memo$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      '2026-08-02T00:00:00Z',
      '2026-08-04T00:00:00Z',
      'createdAt',
      'desc',
      1,
      10
    )
  ),
  2::bigint,
  $$admin run list should filter by created_at range$$
);

SELECT is(
  (
    SELECT items->0->>'id'
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      1,
      1
    )
  ),
  current_setting('test.note_chat_admin_run_c_id'),
  $$admin run list should sort by createdAt desc by default-compatible input$$
);

SELECT is(
  (
    SELECT items->0->>'user_nickname'
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'userNickname',
      'asc',
      1,
      1
    )
  ),
  'AlphaUser',
  $$admin run list should sort by user nickname$$
);

SELECT is(
  (
    SELECT jsonb_array_length(items)
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      99,
      1
    )
  ),
  0,
  $$admin run list should return empty items for empty pages$$
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      '',
      NULL::text[],
      NULL::uuid[],
      NULL::boolean,
      NULL::timestamptz,
      NULL::timestamptz,
      'createdAt',
      'desc',
      99,
      1
    )
  ),
  3::bigint,
  $$admin run list should preserve total count for empty pages$$
);

SELECT ok(
  has_table_privilege('service_role', 'public.admin_note_chat_run_detail', 'SELECT'),
  $$service_role should select admin run detail view$$
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_admin_note_chat_run_list(text,text[],uuid[],boolean,timestamp with time zone,timestamp with time zone,text,text,integer,integer)',
    'EXECUTE'
  ),
  $$service_role should execute admin run list RPC$$
);

SELECT * FROM finish();
ROLLBACK;
