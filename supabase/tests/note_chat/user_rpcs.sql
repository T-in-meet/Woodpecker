-- =========================================
-- note_chat / question RPCs
-- =========================================

BEGIN;

SELECT plan(27);

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

-- 기존 6-argument RPC는 새로운 service_role 전용 RPC로 대체되어
-- migration에서 함수 자체를 제거하므로 더 이상 존재하지 않아야 합니다.
SELECT hasnt_function(
  'public',
  'create_note_chat_question',
  ARRAY['uuid', 'jsonb', 'uuid', 'uuid', 'uuid', 'uuid'],
  $$legacy create_note_chat_question should be removed$$
);

SELECT hasnt_function(
  'public',
  'update_note_chat_user_message',
  ARRAY['uuid', 'jsonb', 'uuid', 'uuid', 'uuid', 'uuid'],
  $$legacy update_note_chat_user_message should be removed$$
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

-- 신규 RPC는 service_role에서만 직접 실행할 수 있습니다.
--
-- 일반 사용자 제한값은 실제 정책과 동일하게 10을 전달하지만,
-- authenticated 역할에는 함수 실행 권한 자체가 없어야 합니다.
SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"authenticated new"}'::jsonb,
      10,
      false
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
      '{"text":"authenticated update"}'::jsonb,
      10,
      false
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute service update_note_chat_user_message$$
);

RESET ROLE;

SET LOCAL ROLE service_role;

-- 일반 사용자 요청을 가정하므로
-- p_bypass_daily_execution_limit은 false를 전달합니다.
SELECT *
FROM public.create_note_chat_question(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  '{"text":"first question"}'::jsonb,
  10,
  false
)
\gset test_note_chat_rpc_first_

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_first_user_message_id'::uuid
  ),
  'user',
  $$create_note_chat_question should create a user message$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_first_user_message_id'::uuid
  ),
  1,
  $$first created user message should use sequence number 1$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_first_run_id'::uuid
  ),
  'pending',
  $$create_note_chat_question should create a pending run$$
);

SELECT ok(
  (
    SELECT updated_at > created_at
    FROM public.note_chat_conversations
    WHERE id = current_setting('test.note_chat_rpc_conversation_id')::uuid
  ),
  $$create_note_chat_question should update conversation updated_at$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_other_conversation_id')::uuid,
      '{"text":"blocked"}'::jsonb,
      10,
      false
    );
  $sql$,
  'P0001',
  'conversation not found',
  $$create_note_chat_question should reject another user's conversation$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '[]'::jsonb,
      10,
      false
    );
  $sql$,
  'P0001',
  'content must be a JSON object',
  $$create_note_chat_question should reject non-object content$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"invalid limit"}'::jsonb,
      0,
      false
    );
  $sql$,
  'P0001',
  'daily execution limit must be positive',
  $$create_note_chat_question should reject invalid daily limits$$
);

SELECT *
FROM public.create_note_chat_question(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  '{"text":"second question"}'::jsonb,
  10,
  false
)
\gset test_note_chat_rpc_second_

SELECT set_config(
  'test.note_chat_rpc_second_user_message_id',
  :'test_note_chat_rpc_second_user_message_id',
  true
);

RESET ROLE;

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

SET LOCAL ROLE service_role;

SELECT *
FROM public.update_note_chat_user_message(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  :'test_note_chat_rpc_second_user_message_id'::uuid,
  '{"text":"edited second question"}'::jsonb,
  10,
  false
)
\gset test_note_chat_rpc_edit_

SELECT is(
  (
    SELECT content->>'text'
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_second_user_message_id'::uuid
  ),
  'edited second question',
  $$update_note_chat_user_message should update target user message content$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_second_user_message_id'::uuid
  ),
  2,
  $$update_note_chat_user_message should keep the target sequence number$$
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
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_edit_run_id'::uuid
  ),
  'pending',
  $$update_note_chat_user_message should create a new pending run$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_deleted_message_id')::uuid,
      '{"text":"blocked"}'::jsonb,
      10,
      false
    );
  $sql$,
  'P0001',
  'user message not found',
  $$update_note_chat_user_message should reject missing or deleted user messages$$
);

RESET ROLE;

INSERT INTO public.note_chat_messages (conversation_id, role, content, sequence_number)
VALUES (
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  'assistant',
  '{"text":"assistant cannot be edited"}'::jsonb,
  3
);

SELECT set_config(
  'test.note_chat_rpc_assistant_message_id',
  (
    SELECT id::text
    FROM public.note_chat_messages
    WHERE conversation_id = current_setting('test.note_chat_rpc_conversation_id')::uuid
      AND role = 'assistant'
    ORDER BY sequence_number DESC
    LIMIT 1
  ),
  true
);

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_assistant_message_id')::uuid,
      '{"text":"blocked assistant"}'::jsonb,
      10,
      false
    );
  $sql$,
  'P0001',
  'user message not found',
  $$update_note_chat_user_message should reject assistant messages$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_unverified_id')::uuid,
      current_setting('test.note_chat_rpc_unverified_conversation_id')::uuid,
      '{"text":"unverified"}'::jsonb,
      10,
      false
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified users should not create note chat questions$$
);

-- ============================================================================
-- 일반 사용자 일일 제한
-- ============================================================================

-- 이미 오늘 생성된 Run이 있으므로 제한값을 1로 낮추면
-- 일반 사용자(false)는 추가 질문을 생성할 수 없어야 합니다.
--
-- 일일 실행 제한 초과는 일반 예외(P0001)가 아니라
-- Route가 429로 식별하는 전용 SQLSTATE WP002를 반환해야 합니다.
SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"limit create"}'::jsonb,
      1,
      false
    );
  $sql$,
  'WP002',
  'DAILY_EXECUTION_LIMIT_EXCEEDED',
  $$create_note_chat_question should reject requests at the daily limit$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_messages
    WHERE content->>'text' = 'limit create'
  ),
  0::bigint,
  $$daily limit failure should not create a user message$$
);

-- 질문 수정도 새로운 Run을 생성하므로 동일한 제한을 적용합니다.
SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.update_note_chat_user_message(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_second_user_message_id')::uuid,
      '{"text":"limit update"}'::jsonb,
      1,
      false
    );
  $sql$,
  'WP002',
  'DAILY_EXECUTION_LIMIT_EXCEEDED',
  $$update_note_chat_user_message should reject requests at the daily limit$$
);

SELECT is(
  (
    SELECT content->>'text'
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_rpc_second_user_message_id'::uuid
  ),
  'edited second question',
  $$daily limit failure should not edit the target message$$
);

-- ============================================================================
-- 관리자 일일 제한 우회
-- ============================================================================

-- DB는 관리자 여부를 직접 판단하지 않습니다.
--
-- Route에서 관리자로 확인된 사용자에 대해서만
-- p_bypass_daily_execution_limit = true를 전달합니다.
--
-- 여기서는 제한값이 이미 초과된 상태에서도 true를 전달하면
-- quota 검사를 건너뛰는 RPC 동작만 검증합니다.

SELECT *
FROM public.create_note_chat_question(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  current_setting('test.note_chat_rpc_conversation_id')::uuid,
  '{"text":"admin bypass create"}'::jsonb,
  1,
  true
)
\gset test_note_chat_rpc_admin_create_

SELECT is(
  (
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_admin_create_run_id'::uuid
  ),
  'pending',
  $$create_note_chat_question should bypass the daily limit$$
);

SELECT *
FROM public.update_note_chat_user_message(
  current_setting('test.note_chat_rpc_user_id')::uuid,
  :'test_note_chat_rpc_second_user_message_id'::uuid,
  '{"text":"admin bypass update"}'::jsonb,
  1,
  true
)
\gset test_note_chat_rpc_admin_update_

SELECT is(
  (
    SELECT status
    FROM public.note_chat_runs
    WHERE id = :'test_note_chat_rpc_admin_update_run_id'::uuid
  ),
  'pending',
  $$update_note_chat_user_message should bypass the daily limit$$
);

RESET ROLE;

ALTER TABLE public.note_chat_runs
ADD CONSTRAINT note_chat_runs_test_atomic_failure
CHECK (status <> 'pending') NOT VALID;

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.create_note_chat_question(
      current_setting('test.note_chat_rpc_user_id')::uuid,
      current_setting('test.note_chat_rpc_conversation_id')::uuid,
      '{"text":"atomic marker"}'::jsonb,
      10,
      false
    );
  $sql$,
  '23514',
  NULL,
  $$run insert failure should fail the RPC atomically$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.note_chat_messages
    WHERE content->>'text' = 'atomic marker'
  ),
  0::bigint,
  $$run insert failure should leave no orphan user message$$
);

SELECT * FROM finish();

ROLLBACK;