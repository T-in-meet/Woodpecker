-- =========================================
-- note_chat / admin run views and RPCs
-- =========================================

BEGIN;

SELECT plan(15);

-- =========================================
-- Test fixture identifiers
-- =========================================
--
-- 각 fixture는 매 실행마다 고유 UUID를 사용해 기존 데이터와 충돌하지 않도록 합니다.
-- 목록 RPC 테스트는 아래 검색 토큰을 공통으로 사용하여 seed 데이터가 결과에
-- 포함되지 않도록 테스트 범위를 명시적으로 격리합니다.
-- =========================================

SELECT set_config(
  'test.note_chat_admin_search_token',
  'note-chat-admin-rpc',
  true
);

SELECT set_config(
  'test.note_chat_admin_user_a_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_user_b_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_conversation_a_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_conversation_b_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_message_a_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_message_b_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_message_c_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_run_a_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_run_b_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_run_c_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_chat_model_a_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.note_chat_admin_chat_model_b_id',
  gen_random_uuid()::text,
  true
);


-- =========================================
-- Users
-- =========================================

INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES
  (
    current_setting('test.note_chat_admin_user_a_id')::uuid,
    'note_chat_admin_a_'
      || current_setting('test.note_chat_admin_user_a_id')
      || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_admin_user_b_id')::uuid,
    'note_chat_admin_b_'
      || current_setting('test.note_chat_admin_user_b_id')
      || '@example.com',
    now(),
    '{}'::jsonb
  );

UPDATE public.profiles
SET nickname = 'AlphaUser'
WHERE id = current_setting('test.note_chat_admin_user_a_id')::uuid;

UPDATE public.profiles
SET nickname = 'BetaUser'
WHERE id = current_setting('test.note_chat_admin_user_b_id')::uuid;


-- =========================================
-- AI models
-- =========================================

INSERT INTO public.ai_model_configs (
  id,
  display_name,
  provider,
  model,
  capability
)
VALUES
  (
    current_setting('test.note_chat_admin_chat_model_a_id')::uuid,
    'Admin Chat A',
    'test',
    'admin-chat-a',
    'chat'
  ),
  (
    current_setting('test.note_chat_admin_chat_model_b_id')::uuid,
    'Admin Chat B',
    'test',
    'admin-chat-b',
    'chat'
  );


-- =========================================
-- Conversations
-- =========================================

INSERT INTO public.note_chat_conversations (
  id,
  user_id,
  title
)
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


-- =========================================
-- Messages
-- =========================================
--
-- 모든 user message에 공통 테스트 검색 토큰을 포함합니다.
-- get_admin_note_chat_run_list의 검색 조건으로 이 토큰을 전달하면
-- seed.sql에 저장된 실제 Note Chat Run은 목록 결과에서 제외됩니다.
-- =========================================

INSERT INTO public.note_chat_messages (
  id,
  conversation_id,
  role,
  content,
  sequence_number
)
VALUES
  (
    current_setting('test.note_chat_admin_message_a_id')::uuid,
    current_setting('test.note_chat_admin_conversation_a_id')::uuid,
    'user',
    jsonb_build_object(
      'text',
      current_setting('test.note_chat_admin_search_token')
        || ' alpha searchable question'
    ),
    1
  ),
  (
    current_setting('test.note_chat_admin_message_b_id')::uuid,
    current_setting('test.note_chat_admin_conversation_b_id')::uuid,
    'user',
    jsonb_build_object(
      'text',
      current_setting('test.note_chat_admin_search_token')
        || ' beta searchable question'
    ),
    1
  ),
  (
    current_setting('test.note_chat_admin_message_c_id')::uuid,
    current_setting('test.note_chat_admin_conversation_b_id')::uuid,
    'user',
    jsonb_build_object(
      'text',
      current_setting('test.note_chat_admin_search_token')
        || ' gamma question'
    ),
    2
  );


-- =========================================
-- Runs
-- =========================================

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


-- =========================================
-- Service role context
-- =========================================

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);


-- =========================================
-- Admin run detail view
-- =========================================

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

-- 참조 대상 모델이 삭제되더라도 Run 자체는 보존되고,
-- 삭제된 FK 대상의 표시 값만 NULL이 되는지 검증합니다.
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


-- =========================================
-- Admin run list: search
-- =========================================

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


-- =========================================
-- Admin run list: status filter
-- =========================================
--
-- 검색 토큰으로 fixture 3건만 먼저 격리한 뒤 status 필터 동작을 검증합니다.
-- seed에 pending Run이 추가되어도 기대값이 변하지 않아야 합니다.
-- =========================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
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


-- =========================================
-- Admin run list: chat model filter
-- =========================================
--
-- 모델 UUID 자체가 매 테스트마다 고유하므로 이 테스트는 seed와 독립적입니다.
-- 검색 토큰도 함께 사용해 목록 RPC 테스트의 격리 기준을 일관되게 유지합니다.
-- =========================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
      NULL::text[],
      ARRAY[
        current_setting(
          'test.note_chat_admin_chat_model_a_id'
        )::uuid
      ],
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


-- =========================================
-- Admin run list: memo filters
-- =========================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
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
      current_setting('test.note_chat_admin_search_token'),
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


-- =========================================
-- Admin run list: created_at range
-- =========================================
--
-- 검색 토큰으로 fixture를 격리한 상태에서 날짜 범위의 경계 동작만 검증합니다.
-- =========================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
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


-- =========================================
-- Admin run list: sorting
-- =========================================

SELECT is(
  (
    SELECT items->0->>'id'
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
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
      current_setting('test.note_chat_admin_search_token'),
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


-- =========================================
-- Admin run list: pagination
-- =========================================
--
-- 전체 DB가 아니라 fixture 3건만 대상으로 페이지네이션을 검증합니다.
-- seed Run 개수와 무관하게 빈 페이지의 items와 total_count 계약이 유지되어야 합니다.
-- =========================================

SELECT is(
  (
    SELECT jsonb_array_length(items)
    FROM public.get_admin_note_chat_run_list(
      current_setting('test.note_chat_admin_search_token'),
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
      current_setting('test.note_chat_admin_search_token'),
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


-- =========================================
-- Permissions
-- =========================================

SELECT ok(
  has_table_privilege(
    'service_role',
    'public.admin_note_chat_run_detail',
    'SELECT'
  ),
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