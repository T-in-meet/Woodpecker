-- =========================================
-- note_chat / execution claims
-- =========================================

BEGIN;

SELECT plan(31);

/*
 * 각 시나리오가 서로의 quota/claim 상태에 영향을 주지 않도록
 * 일반 사용자, 관리자, 미인증 사용자, cross-conversation stale 회귀용 사용자를 분리합니다.
 */

SELECT set_config('test.note_chat_claims_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_admin_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_unverified_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_stale_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_second_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_admin_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_unverified_conversation_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_stale_conversation_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_stale_conversation_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_recent_running_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_expired_running_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_cross_conversation_stale_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_first_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_second_user_message_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_chat_claims_admin_user_message_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  (
    current_setting('test.note_chat_claims_user_id')::uuid,
    'note-chat-claims@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_claims_admin_user_id')::uuid,
    'note-chat-claims-admin@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_claims_unverified_user_id')::uuid,
    'note-chat-claims-unverified@example.com',
    NULL,
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_claims_stale_user_id')::uuid,
    'note-chat-claims-stale@example.com',
    now(),
    '{}'::jsonb
  );

UPDATE public.profiles
SET role = 'ADMIN'
WHERE id = current_setting('test.note_chat_claims_admin_user_id')::uuid;

INSERT INTO public.note_chat_conversations (id, user_id, title)
VALUES
  (
    current_setting('test.note_chat_claims_conversation_id')::uuid,
    current_setting('test.note_chat_claims_user_id')::uuid,
    'Claim conversation'
  ),
  (
    current_setting('test.note_chat_claims_second_conversation_id')::uuid,
    current_setting('test.note_chat_claims_user_id')::uuid,
    'Second claim conversation'
  ),
  (
    current_setting('test.note_chat_claims_admin_conversation_id')::uuid,
    current_setting('test.note_chat_claims_admin_user_id')::uuid,
    'Admin claim conversation'
  ),
  (
    current_setting('test.note_chat_claims_unverified_conversation_id')::uuid,
    current_setting('test.note_chat_claims_unverified_user_id')::uuid,
    'Unverified claim conversation'
  ),
  (
    current_setting('test.note_chat_claims_stale_conversation_a_id')::uuid,
    current_setting('test.note_chat_claims_stale_user_id')::uuid,
    'Stale claim conversation A'
  ),
  (
    current_setting('test.note_chat_claims_stale_conversation_b_id')::uuid,
    current_setting('test.note_chat_claims_stale_user_id')::uuid,
    'Stale claim conversation B'
  );

/*
 * Claim RPC는 서버(service_role)에서만 호출되어야 하므로
 * authenticated 사용자가 직접 실행할 수 없는지 먼저 검증합니다.
 */
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.note_chat_claims_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.claim_note_chat_execution(
      current_setting('test.note_chat_claims_user_id')::uuid,
      current_setting('test.note_chat_claims_conversation_id')::uuid,
      10
    );
  $sql$,
  '42501',
  NULL,
  $$authenticated should not execute Note Chat claim RPC$$
);

/*
 * 실제 애플리케이션의 서버 호출 경로와 같은 service_role로 전환한 뒤
 * Claim 생성/중복/완료/quota 정책을 검증합니다.
 */
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

/*
 * 실행 중인 Claim이 없는 Conversation에서는 running Claim 하나가 생성되어야 합니다.
 */
SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_first_

SELECT is(
  :'test_note_chat_claims_first_status'::text,
  'claimed',
  $$fresh conversation should create an execution claim$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = :'test_note_chat_claims_first_claim_id'::uuid
  ),
  'running',
  $$new execution claim should be stored as running$$
);

/*
 * 동일 Conversation에 유효한 running Claim이 있으면 새 Claim을 만들지 않고
 * duplicate로 반환하여 동시에 두 답변이 생성되는 것을 막아야 합니다.
 */
SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_duplicate_

SELECT is(
  :'test_note_chat_claims_duplicate_status'::text,
  'duplicate',
  $$running same conversation should be treated as duplicate$$
);

/*
 * 실패한 실행은 Claim을 failed로 종료하고 quota에서도 제외되어야 하므로,
 * 이후 동일 Conversation에서 새 실행을 다시 Claim할 수 있어야 합니다.
 */
SELECT is(
  public.complete_note_chat_execution_claim(
    :'test_note_chat_claims_first_claim_id'::uuid,
    'failed'
  ),
  :'test_note_chat_claims_first_claim_id'::uuid,
  $$execution claim should complete as failed$$
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_after_failed_

SELECT is(
  :'test_note_chat_claims_after_failed_status'::text,
  'claimed',
  $$failed claim should not block a new conversation execution$$
);

/*
 * P2 success path:
 * 기능 성공의 정합성 경계는 Assistant Message 저장 + Claim succeeded 전환입니다.
 * 두 작업은 complete_note_chat_execution_success RPC 하나에서 함께 완료되어야 합니다.
 */
INSERT INTO public.note_chat_messages (
  id,
  conversation_id,
  role,
  content,
  sequence_number
)
VALUES (
  current_setting('test.note_chat_claims_first_user_message_id')::uuid,
  current_setting('test.note_chat_claims_conversation_id')::uuid,
  'user',
  '{"text":"First successful question"}'::jsonb,
  1
);

SELECT public.complete_note_chat_execution_success(
  current_setting('test.note_chat_claims_user_id')::uuid,
  :'test_note_chat_claims_after_failed_claim_id'::uuid,
  current_setting('test.note_chat_claims_first_user_message_id')::uuid,
  '{"text":"First successful answer","usedNoteIds":[]}'::jsonb
) AS assistant_message_id
\gset test_note_chat_claims_first_success_

SELECT ok(
  :'test_note_chat_claims_first_success_assistant_message_id'::uuid IS NOT NULL,
  $$successful execution should return the created assistant message ID$$
);

SELECT is(
  (
    SELECT content
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_claims_first_success_assistant_message_id'::uuid
      AND role = 'assistant'
  ),
  '{"text":"First successful answer","usedNoteIds":[]}'::jsonb,
  $$successful execution should persist the assistant message$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = :'test_note_chat_claims_after_failed_claim_id'::uuid
  ),
  'succeeded',
  $$successful execution should complete its claim as succeeded$$
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_after_succeeded_

SELECT is(
  :'test_note_chat_claims_after_succeeded_status'::text,
  'claimed',
  $$succeeded conversation claim should count quota but not block later turns$$
);

SELECT is(
  public.complete_note_chat_execution_claim(
    :'test_note_chat_claims_after_succeeded_claim_id'::uuid,
    'failed'
  ),
  :'test_note_chat_claims_after_succeeded_claim_id'::uuid,
  $$later failed claim should complete successfully$$
);

/*
 * stale 기준보다 최근인 running Claim은 아직 유효한 실행이므로
 * 자동 정리하지 않고 duplicate로 취급해야 합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at
)
VALUES (
  current_setting('test.note_chat_claims_recent_running_id')::uuid,
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  'running',
  clock_timestamp() - interval '2 minutes'
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_recent_running_

SELECT is(
  :'test_note_chat_claims_recent_running_status'::text,
  'duplicate',
  $$recent running claim should still be treated as duplicate$$
);

UPDATE public.note_chat_execution_claims
SET
  status = 'stale',
  completed_at = clock_timestamp()
WHERE id = current_setting('test.note_chat_claims_recent_running_id')::uuid;

/*
 * P1 regression:
 * stale 정리는 현재 Conversation에 한정되지 않고 사용자 전체 running Claim을
 * 대상으로 해야 합니다. Conversation A의 오래된 Claim이 남아 있어도
 * Conversation B의 새 실행 전에 stale 처리되어 quota를 점유하지 않아야 합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at
)
VALUES (
  current_setting('test.note_chat_claims_cross_conversation_stale_id')::uuid,
  current_setting('test.note_chat_claims_stale_user_id')::uuid,
  current_setting('test.note_chat_claims_stale_conversation_a_id')::uuid,
  'running',
  clock_timestamp() - interval '4 minutes'
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_stale_user_id')::uuid,
  current_setting('test.note_chat_claims_stale_conversation_b_id')::uuid,
  1
)
\gset test_note_chat_claims_cross_conversation_

SELECT is(
  :'test_note_chat_claims_cross_conversation_status'::text,
  'claimed',
  $$stale running claim in another conversation should not consume daily quota$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_claims_cross_conversation_stale_id')::uuid
  ),
  'stale',
  $$claiming another conversation should stale expired running claims for the same user$$
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_claims_cross_conversation_stale_id')::uuid
  ),
  $$cross-conversation stale claim should receive completed_at$$
);

SELECT public.complete_note_chat_execution_claim(
  :'test_note_chat_claims_cross_conversation_claim_id'::uuid,
  'failed'
);

/*
 * 같은 Conversation의 오래된 running Claim도 새 Claim 전에 stale로 회수되어야 합니다.
 * 이는 orphan Claim 때문에 동일 대화가 장시간 막히는 기존 문제를 방지합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at
)
VALUES (
  current_setting('test.note_chat_claims_expired_running_id')::uuid,
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  'running',
  clock_timestamp() - interval '4 minutes'
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  10
)
\gset test_note_chat_claims_expired_running_

SELECT is(
  :'test_note_chat_claims_expired_running_status'::text,
  'claimed',
  $$expired running claim should allow a new execution claim$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_claims_expired_running_id')::uuid
  ),
  'stale',
  $$expired running claim should be completed as stale$$
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL
    FROM public.note_chat_execution_claims
    WHERE id = current_setting('test.note_chat_claims_expired_running_id')::uuid
  ),
  $$expired running claim should receive completed_at$$
);

INSERT INTO public.note_chat_messages (
  id,
  conversation_id,
  role,
  content,
  sequence_number
)
VALUES (
  current_setting('test.note_chat_claims_second_user_message_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  'user',
  '{"text":"Second successful question"}'::jsonb,
  1
);

SELECT public.complete_note_chat_execution_success(
  current_setting('test.note_chat_claims_user_id')::uuid,
  :'test_note_chat_claims_expired_running_claim_id'::uuid,
  current_setting('test.note_chat_claims_second_user_message_id')::uuid,
  '{"text":"Second successful answer","usedNoteIds":[]}'::jsonb
) AS assistant_message_id
\gset test_note_chat_claims_second_success_

SELECT ok(
  :'test_note_chat_claims_second_success_assistant_message_id'::uuid IS NOT NULL,
  $$new claim after expiring stale running claim should persist an assistant message$$
);

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = :'test_note_chat_claims_expired_running_claim_id'::uuid
  ),
  'succeeded',
  $$new claim after expiring stale running claim should complete as succeeded$$
);

/*
 * 일일 quota는 running + succeeded만 집계하고 failed/stale은 제외합니다.
 * 성공 Claim들이 한도를 채운 상태에서는 새 Claim을 거부해야 합니다.
 */
SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  2
)
\gset test_note_chat_claims_limit_

SELECT is(
  :'test_note_chat_claims_limit_status'::text,
  'daily_limit_exceeded',
  $$daily limit should count only running and succeeded execution claims$$
);

UPDATE public.note_chat_execution_claims
SET
  status = 'failed',
  completed_at = clock_timestamp()
WHERE id = :'test_note_chat_claims_expired_running_claim_id'::uuid;

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_user_id')::uuid,
  current_setting('test.note_chat_claims_second_conversation_id')::uuid,
  2
)
\gset test_note_chat_claims_failed_excluded_

SELECT is(
  :'test_note_chat_claims_failed_excluded_status'::text,
  'claimed',
  $$failed and stale claims should be excluded from daily quota count$$
);

/*
 * ADMIN은 기존 정책대로 일일 실행 제한을 우회해야 합니다.
 * 성공 처리 자체는 일반 사용자와 동일한 success RPC를 사용합니다.
 */
INSERT INTO public.note_chat_messages (
  id,
  conversation_id,
  role,
  content,
  sequence_number
)
VALUES (
  current_setting('test.note_chat_claims_admin_user_message_id')::uuid,
  current_setting('test.note_chat_claims_admin_conversation_id')::uuid,
  'user',
  '{"text":"Admin question"}'::jsonb,
  1
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_admin_user_id')::uuid,
  current_setting('test.note_chat_claims_admin_conversation_id')::uuid,
  1
)
\gset test_note_chat_claims_admin_first_

SELECT public.complete_note_chat_execution_success(
  current_setting('test.note_chat_claims_admin_user_id')::uuid,
  :'test_note_chat_claims_admin_first_claim_id'::uuid,
  current_setting('test.note_chat_claims_admin_user_message_id')::uuid,
  '{"text":"Admin answer","usedNoteIds":[]}'::jsonb
) AS assistant_message_id
\gset test_note_chat_claims_admin_success_

SELECT is(
  (
    SELECT status
    FROM public.note_chat_execution_claims
    WHERE id = :'test_note_chat_claims_admin_first_claim_id'::uuid
  ),
  'succeeded',
  $$admin first claim should complete as succeeded through the success RPC$$
);

SELECT *
FROM public.claim_note_chat_execution(
  current_setting('test.note_chat_claims_admin_user_id')::uuid,
  current_setting('test.note_chat_claims_admin_conversation_id')::uuid,
  1
)
\gset test_note_chat_claims_admin_second_

SELECT is(
  :'test_note_chat_claims_admin_second_status'::text,
  'claimed',
  $$admin should bypass daily execution claim limits$$
);

SELECT throws_ok(
  $sql$
    SELECT *
    FROM public.claim_note_chat_execution(
      current_setting('test.note_chat_claims_unverified_user_id')::uuid,
      current_setting('test.note_chat_claims_unverified_conversation_id')::uuid,
      10
    );
  $sql$,
  'P0001',
  'email not confirmed',
  $$unverified user should be rejected$$
);

/*
 * P2 hardening:
 * succeeded 전환은 반드시 Assistant Message 생성과 묶인 success RPC를 통해서만 해야 하므로
 * failure cleanup RPC가 succeeded를 직접 받을 수 없어야 합니다.
 */
SELECT throws_ok(
  format(
    'SELECT public.complete_note_chat_execution_claim(%L::uuid, %L::text);',
    :'test_note_chat_claims_failed_excluded_claim_id',
    'succeeded'
  ),
  'P0001',
  'execution claim completion status is invalid',
  $$succeeded must be rejected by the failure cleanup RPC$$
);

/*
 * 필수 user_message_id가 없을 때는 conversation mismatch 같은 간접 오류가 아니라
 * 입력 누락 원인을 명확히 드러내는 오류를 반환해야 합니다.
 */
SELECT throws_ok(
  format(
    'SELECT public.complete_note_chat_execution_success(%L::uuid, %L::uuid, NULL::uuid, %L::jsonb);',
    current_setting('test.note_chat_claims_user_id'),
    :'test_note_chat_claims_failed_excluded_claim_id',
    '{"text":"Answer","usedNoteIds":[]}'
  ),
  'P0001',
  'user_message_id is required',
  $$success RPC should reject a missing user message ID explicitly$$
);

/*
 * Claim과 다른 Conversation의 user message를 결합하면 잘못된 실행 결과가 저장될 수 있으므로
 * success RPC가 두 리소스의 Conversation 일치를 강제해야 합니다.
 */
SELECT throws_ok(
  format(
    'SELECT public.complete_note_chat_execution_success(%L::uuid, %L::uuid, %L::uuid, %L::jsonb);',
    current_setting('test.note_chat_claims_user_id'),
    :'test_note_chat_claims_failed_excluded_claim_id',
    current_setting('test.note_chat_claims_first_user_message_id'),
    '{"text":"Answer","usedNoteIds":[]}'
  ),
  'P0001',
  'claim does not match user message conversation',
  $$success RPC should reject a user message from another conversation$$
);

/*
 * Assistant Message helper를 service_role이 직접 호출할 수 있으면
 * Claim succeeded 전환을 우회할 수 있으므로 외부 실행 권한이 없어야 합니다.
 */
SELECT throws_ok(
  format(
    'SELECT public.create_note_chat_assistant_message(%L::uuid, %L::uuid, %L::jsonb);',
    current_setting('test.note_chat_claims_user_id'),
    current_setting('test.note_chat_claims_first_user_message_id'),
    '{"text":"Direct helper call","usedNoteIds":[]}'
  ),
  '42501',
  NULL,
  $$service role should not execute the assistant message helper directly$$
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL
    FROM public.note_chat_execution_claims
    WHERE id = :'test_note_chat_claims_after_failed_claim_id'::uuid
  ),
  $$successful execution claim should receive completed_at$$
);

SELECT is(
  (
    SELECT role
    FROM public.note_chat_messages
    WHERE id = :'test_note_chat_claims_admin_success_assistant_message_id'::uuid
  ),
  'assistant',
  $$success RPC should create an assistant message for the admin execution$$
);

SELECT * FROM finish();

ROLLBACK;
