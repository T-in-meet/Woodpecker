BEGIN;

SELECT plan(5);

/*
 * get_note_chat_daily_usage() 테스트용 사용자를 생성합니다.
 *
 * Note Chat 일일 사용량은 현재 인증 사용자의 execution claim만 조회하므로,
 * 다른 사용자의 Claim이 사용량에 포함되지 않는지도 함께 검증합니다.
 */
SELECT set_config(
  'test.note_chat_daily_usage_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.note_chat_daily_usage_other_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.note_chat_daily_usage_conversation_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.note_chat_daily_usage_other_conversation_id',
  gen_random_uuid()::text,
  true
);

INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES
  (
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    'note-chat-daily-usage@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.note_chat_daily_usage_other_user_id')::uuid,
    'note-chat-daily-usage-other@example.com',
    now(),
    '{}'::jsonb
  );

/*
 * execution claim의 conversation_id FK를 만족시키기 위해
 * 각 테스트 사용자의 실제 Note Chat conversation을 생성합니다.
 */
INSERT INTO public.note_chat_conversations (
  id,
  user_id,
  title
)
VALUES
  (
    current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    'Daily usage conversation'
  ),
  (
    current_setting('test.note_chat_daily_usage_other_conversation_id')::uuid,
    current_setting('test.note_chat_daily_usage_other_user_id')::uuid,
    'Other daily usage conversation'
  );

/*
 * 현재 사용자의 JWT context를 설정합니다.
 */
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    current_setting('test.note_chat_daily_usage_user_id'),
    'role',
    'authenticated'
  )::text,
  true
);

-- 오늘 Claim이 없으면 사용량은 0입니다.
SELECT is(
  public.get_note_chat_daily_usage(),
  0,
  'returns 0 when there are no note chat execution claims today'
);

RESET ROLE;

/*
 * 현재 사용자의 오늘 Claim을 상태별로 생성합니다.
 *
 * 실제 quota 정책과 동일하게 running + succeeded만 사용량에 포함되고,
 * failed + stale은 제외되어야 합니다.
 *
 * completion check에 따라 running은 completed_at을 비워 두고,
 * 종료 상태인 succeeded/failed/stale은 completed_at을 기록합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at,
  completed_at
)
VALUES
  (
    gen_random_uuid(),
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
    'running',
    (
      (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
      + time '12:00:00'
    ) AT TIME ZONE 'Asia/Seoul',
    NULL
  ),
  (
    gen_random_uuid(),
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
    'succeeded',
    (
      (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
      + time '12:01:00'
    ) AT TIME ZONE 'Asia/Seoul',
    clock_timestamp()
  ),
  (
    gen_random_uuid(),
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
    'failed',
    (
      (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
      + time '12:02:00'
    ) AT TIME ZONE 'Asia/Seoul',
    clock_timestamp()
  ),
  (
    gen_random_uuid(),
    current_setting('test.note_chat_daily_usage_user_id')::uuid,
    current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
    'stale',
    (
      (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
      + time '12:03:00'
    ) AT TIME ZONE 'Asia/Seoul',
    clock_timestamp()
  );

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    current_setting('test.note_chat_daily_usage_user_id'),
    'role',
    'authenticated'
  )::text,
  true
);

-- running + succeeded Claim만 오늘 사용량으로 계산합니다.
SELECT is(
  public.get_note_chat_daily_usage(),
  2,
  'counts only running and succeeded note chat execution claims'
);

RESET ROLE;

/*
 * 다른 사용자의 오늘 running Claim을 생성합니다.
 *
 * SECURITY DEFINER 함수이지만 auth.uid()를 기준으로 조회하므로
 * 다른 사용자의 Claim은 현재 사용자의 사용량에 포함되지 않아야 합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at,
  completed_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.note_chat_daily_usage_other_user_id')::uuid,
  current_setting('test.note_chat_daily_usage_other_conversation_id')::uuid,
  'running',
  (
    (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
    + time '12:04:00'
  ) AT TIME ZONE 'Asia/Seoul',
  NULL
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    current_setting('test.note_chat_daily_usage_user_id'),
    'role',
    'authenticated'
  )::text,
  true
);

-- 다른 사용자의 Claim은 현재 사용자의 사용량에 포함하지 않습니다.
SELECT is(
  public.get_note_chat_daily_usage(),
  2,
  'does not count another user note chat execution claims'
);

RESET ROLE;

/*
 * 현재 사용자의 KST 기준 전날 succeeded Claim을 생성합니다.
 *
 * UTC 날짜가 아니라 실제 quota 정책과 동일한 Asia/Seoul 날짜 경계를
 * 기준으로 오늘 사용량에서 제외되는지 검증합니다.
 *
 * succeeded는 종료 상태이므로 completion check를 만족하도록
 * completed_at도 함께 기록합니다.
 */
INSERT INTO public.note_chat_execution_claims (
  id,
  user_id,
  conversation_id,
  status,
  claimed_at,
  completed_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.note_chat_daily_usage_user_id')::uuid,
  current_setting('test.note_chat_daily_usage_conversation_id')::uuid,
  'succeeded',
  (
    ((clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date - 1)
    + time '23:59:59'
  ) AT TIME ZONE 'Asia/Seoul',
  clock_timestamp()
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    current_setting('test.note_chat_daily_usage_user_id'),
    'role',
    'authenticated'
  )::text,
  true
);

-- KST 기준 이전 날짜의 Claim은 오늘 사용량에서 제외합니다.
SELECT is(
  public.get_note_chat_daily_usage(),
  2,
  'does not count previous KST day note chat execution claims'
);

RESET ROLE;

/*
 * anon에는 get_note_chat_daily_usage() EXECUTE 권한을 부여하지 않았으므로
 * 함수 실행 자체가 거부되어야 합니다.
 */
SET LOCAL ROLE anon;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'role',
    'anon'
  )::text,
  true
);

SELECT throws_ok(
  'SELECT public.get_note_chat_daily_usage()',
  '42501',
  NULL,
  'anon cannot execute get_note_chat_daily_usage'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;