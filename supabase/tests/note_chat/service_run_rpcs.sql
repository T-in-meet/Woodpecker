-- =========================================
-- note_chat / service message RPCs
-- =========================================

BEGIN;

SELECT plan(14);

SELECT set_config('test.note_chat_service_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_service_claim_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_service_user_id')::uuid,
    'note_chat_service_' || current_setting('test.note_chat_service_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_service_other_user_id')::uuid,
    'note_chat_service_other_' || current_setting('test.note_chat_service_other_user_id') || '@example.com',
    now(),
    '{}'::jsonb
  );

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES (
  current_setting('test.note_chat_service_conversation_id')::uuid,
  current_setting('test.note_chat_service_user_id')::uuid,
  'Service conversation'
);

INSERT INTO public.note_chat_messages (id, conversation_id, role, content, sequence_number)
VALUES (
  current_setting('test.note_chat_service_user_message_id')::uuid,
  current_setting('test.note_chat_service_conversation_id')::uuid,
  'user',
  '{"text":"service question"}'::jsonb,
  1
);

/*
 * 성공 RPC는 running Claim을 성공 상태로 전환하면서 Assistant Message를
 * 같은 transaction에서 생성합니다. service_role 성공 경로를 검증하기 위해
 * 해당 Conversation의 running Claim을 준비합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status
)
VALUES (
  current_setting('test.note_chat_service_claim_id')::uuid,
  current_setting('test.note_chat_service_user_id')::uuid,
  current_setting('test.note_chat_service_conversation_id')::uuid,
  'running'
);

/*
 * Run은 더 이상 기능 성공/실패를 확정하는 RPC를 사용하지 않고,
 * 애플리케이션에서 best-effort 감사 기록으로 갱신합니다.
 * 따라서 이전 Run completion RPC가 다시 노출되지 않는지 검증합니다.
 */
SELECT hasnt_function(
  'public',
  'complete_note_chat_run_success',
  ARRAY['uuid', 'jsonb', 'jsonb', 'jsonb'],
  $$Run success completion RPC should be removed$$
);

SELECT hasnt_function(
  'public',
  'complete_note_chat_run_failure',
  ARRAY['uuid', 'jsonb'],
  $$Run failure completion RPC should be removed$$
);

/*
 * Assistant Message 단독 저장 helper는 외부 RPC 경로가 아닙니다.
 * authenticated는 물론 service_role도 직접 실행할 수 없어야 하며,
 * 기능 성공은 complete_note_chat_execution_success를 통해서만 확정해야 합니다.
 */
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_service_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_chat_assistant_message(
      current_setting('test.note_chat_service_user_id')::uuid,
      current_setting('test.note_chat_service_user_message_id')::uuid,
      '{"text":"blocked"}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute assistant message creation helper$$
);

SELECT throws_ok(
  $sql$
    SELECT public.complete_note_chat_execution_success(
      current_setting('test.note_chat_service_user_id')::uuid,
      current_setting('test.note_chat_service_claim_id')::uuid,
      current_setting('test.note_chat_service_user_message_id')::uuid,
      '{"text":"blocked","usedNoteIds":[]}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute note chat success RPC$$
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_chat_assistant_message(
      current_setting('test.note_chat_service_user_id')::uuid,
      current_setting('test.note_chat_service_user_message_id')::uuid,
      '{"text":"blocked","usedNoteIds":[]}'::jsonb
    );
  $sql$,
  '42501',
  NULL,
  $$service_role should not execute assistant message creation helper directly$$
);

/*
 * service_role에는 성공 확정 RPC만 노출합니다.
 * 이 호출이 실제로 성공하면 SECURITY DEFINER 실행 컨텍스트에서도 내부 helper를
 * 호출할 수 있음을 함께 검증하므로 함수 owner/권한 전제가 깨졌는지도 잡아냅니다.
 */
SELECT set_config(
  'test.note_chat_service_assistant_message_id',
  public.complete_note_chat_execution_success(
    current_setting('test.note_chat_service_user_id')::uuid,
    current_setting('test.note_chat_service_claim_id')::uuid,
    current_setting('test.note_chat_service_user_message_id')::uuid,
    '{"text":"service answer","usedNoteIds":[]}'::jsonb
  )::text,
  true
);

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_service_assistant_message_id')::uuid
  ),
  'assistant',
  $$success RPC should create an assistant message$$
);

SELECT is(
  (
    SELECT sequence_number
    FROM public.note_chat_messages
    WHERE id = current_setting('test.note_chat_service_assistant_message_id')::uuid
  ),
  2,
  $$success RPC should append the next message sequence$$
);

SELECT ok(
  (
    SELECT updated_at > created_at
    FROM public.note_chat_conversations
    WHERE id = current_setting('test.note_chat_service_conversation_id')::uuid
  ),
  $$success RPC should update conversation updated_at$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_service_claim_id')::uuid
  ),
  'succeeded',
  $$success RPC should complete the running claim$$
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_service_claim_id')::uuid
  ),
  $$success RPC should set claim completed_at$$
);

/*
 * 실제 실행 결과뿐 아니라 catalog 권한도 함께 확인해,
 * 이후 GRANT/REVOKE 변경으로 외부 노출 경계가 무너지는 회귀를 막습니다.
 */
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.complete_note_chat_execution_success(uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  $$service_role should execute note chat success RPC$$
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.complete_note_chat_execution_success(uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  $$authenticated should not execute note chat success RPC$$
);

SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.create_note_chat_assistant_message(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  $$service_role should not execute assistant message creation helper directly$$
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.create_note_chat_assistant_message(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  $$authenticated should not execute assistant message creation helper$$
);

SELECT * FROM finish();

ROLLBACK;
