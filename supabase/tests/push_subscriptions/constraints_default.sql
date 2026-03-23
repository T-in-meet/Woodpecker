-- =========================================
-- push_subscriptions / constraints_default
-- =========================================

BEGIN;

SELECT plan(22);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_default_id_a', gen_random_uuid()::text, true);
SELECT set_config('test.ps_default_id_b', gen_random_uuid()::text, true);
SELECT set_config('test.ps_default_created_at_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_default_created_at_explicit_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_transition_before_id', gen_random_uuid()::text, true);

-- seed: auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    current_setting('test.user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: push_subscriptions (불변 조건용)
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_seed_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_seed_id'),
  'p256dh_seed',
  'auth_seed'
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- id를 생략하고 유효한 최소 데이터로 INSERT하면 새 행의 id가 자동 생성되어야 한다
SAVEPOINT push_subscriptions_default_id;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_default_id_a'),
  'p256dh_default_id_a',
  'auth_default_id_a'
);

SELECT ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint LIKE '%/' || current_setting('test.ps_default_id_a')) = 1
  AND (SELECT count(*) FROM public.push_subscriptions WHERE endpoint LIKE '%/' || current_setting('test.ps_default_id_a') AND id IS NOT NULL) = 1,
  $$id를 생략하고 유효한 최소 데이터로 INSERT하면 새 행의 id가 자동 생성되어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_id;

-- 서로 다른 두 INSERT에서 id를 모두 생략하면 각 행은 서로 다른 id를 가져야 한다
SAVEPOINT push_subscriptions_default_id_two;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES
  (
    current_setting('test.user_a_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_default_id_a') || '/a',
    'p256dh_default_id_a2',
    'auth_default_id_a2'
  ),
  (
    current_setting('test.user_a_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_default_id_b') || '/b',
    'p256dh_default_id_b2',
    'auth_default_id_b2'
  );

SELECT ok(
  (
    SELECT count(DISTINCT id)
    FROM public.push_subscriptions
    WHERE endpoint IN (
      'https://example.com/endpoint/' || current_setting('test.ps_default_id_a') || '/a',
      'https://example.com/endpoint/' || current_setting('test.ps_default_id_b') || '/b'
    )
  ) = 2,
  $$서로 다른 두 INSERT에서 id를 모두 생략하면 각 행은 서로 다른 id를 가져야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_id_two;

-- created_at을 생략하고 유효한 최소 데이터로 INSERT하면 새 행의 created_at이 자동 기록되어야 한다
SAVEPOINT push_subscriptions_default_created_at;
SELECT set_config('test.created_at_before', now()::text, true);
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_default_created_at_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_default_created_at_id'),
  'p256dh_default_created_at',
  'auth_default_created_at'
);
SELECT set_config('test.created_at_after', now()::text, true);

SELECT ok(
  (
    (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_default_created_at_id')::uuid)
      BETWEEN current_setting('test.created_at_before')::timestamptz - interval '2 seconds'
          AND current_setting('test.created_at_after')::timestamptz + interval '2 seconds'
  ),
  $$created_at을 생략하고 유효한 최소 데이터로 INSERT하면 새 행의 created_at이 자동 기록되어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_created_at;

-- created_at을 생략해 생성된 행의 created_at은 해당 테스트 실행 시점에 대응하는 현재 시각 범위의 값이어야 한다
SAVEPOINT push_subscriptions_default_created_at_range;
SELECT set_config('test.created_at_range_before', now()::text, true);
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_default_created_at_explicit_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_default_created_at_explicit_id'),
  'p256dh_created_at_range',
  'auth_created_at_range'
);
SELECT set_config('test.created_at_range_after', now()::text, true);

SELECT ok(
  (
    (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_default_created_at_explicit_id')::uuid)
      BETWEEN current_setting('test.created_at_range_before')::timestamptz - interval '2 seconds'
          AND current_setting('test.created_at_range_after')::timestamptz + interval '2 seconds'
  ),
  $$created_at을 생략해 생성된 행의 created_at은 해당 테스트 실행 시점에 대응하는 현재 시각 범위의 값이어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_created_at_range;

-- [예외 조건]
-- 시스템 기본값을 사용하는 INSERT 결과에서 id가 비어 있는 상태의 행이 생성되어서는 안 된다
SAVEPOINT push_subscriptions_default_id_not_null;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_default_id_a') || '/nn',
  'p256dh_default_id_nn',
  'auth_default_id_nn'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://example.com/endpoint/' || current_setting('test.ps_default_id_a') || '/nn' AND id IS NULL),
  0::bigint,
  $$시스템 기본값을 사용하는 INSERT 결과에서 id가 비어 있는 상태의 행이 생성되어서는 안 된다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_id_not_null;

-- id를 명시적으로 NULL로 제공한 INSERT는 기본값 보정 대상이 아니라 무효 입력으로 거부되어야 한다
SELECT set_config(
  'test.row_count_before_null_id',
  (SELECT count(*) FROM public.push_subscriptions)::text,
  true
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (NULL, current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-id', 'p256dh_null', 'auth_null');
  $sql$,
  '23502',
  NULL,
  $$id를 명시적으로 NULL로 제공한 INSERT는 기본값 보정 대상이 아니라 무효 입력으로 거부되어야 한다$$
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  current_setting('test.row_count_before_null_id')::bigint,
  $$id를 명시적으로 NULL로 제공한 INSERT 실패 후에도 push_subscriptions 전체 행 수는 변하지 않아야 한다$$
);

-- 시스템 기본값을 사용하는 INSERT 결과에서 created_at이 비어 있는 상태의 행이 생성되어서는 안 된다
SAVEPOINT push_subscriptions_default_created_at_not_null;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_transition_before_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_transition_before_id'),
  'p256dh_default_created_at_nn',
  'auth_default_created_at_nn'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_transition_before_id')::uuid AND created_at IS NULL),
  0::bigint,
  $$시스템 기본값을 사용하는 INSERT 결과에서 created_at이 비어 있는 상태의 행이 생성되어서는 안 된다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_created_at_not_null;

-- created_at을 명시적으로 NULL로 제공한 INSERT는 기본값 보정 대상이 아니라 무효 입력으로 거부되어야 한다
SELECT set_config(
  'test.row_count_before_null_created_at',
  (SELECT count(*) FROM public.push_subscriptions)::text,
  true
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-created-at', 'p256dh_null_ca', 'auth_null_ca', NULL);
  $sql$,
  '23502',
  NULL,
  $$created_at을 명시적으로 NULL로 제공한 INSERT는 기본값 보정 대상이 아니라 무효 입력으로 거부되어야 한다$$
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  current_setting('test.row_count_before_null_created_at')::bigint,
  $$created_at을 명시적으로 NULL로 제공한 INSERT 실패 후에도 push_subscriptions 전체 행 수는 변하지 않아야 한다$$
);

-- [경계 조건]
-- 허용 경계: id를 완전히 생략한 INSERT는 성공해야 한다
SAVEPOINT push_subscriptions_default_boundary_id_omit;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_boundary_id_omit',
  'auth_boundary_id_omit'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE p256dh = 'p256dh_boundary_id_omit'),
  1::bigint,
  $$허용 경계: id를 완전히 생략한 INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_boundary_id_omit;

-- 허용 경계: id를 명시적으로 유효한 UUID로 제공한 INSERT는 성공해야 한다
SAVEPOINT push_subscriptions_default_boundary_id_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  gen_random_uuid(),
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_boundary_id_explicit',
  'auth_boundary_id_explicit'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE p256dh = 'p256dh_boundary_id_explicit'),
  1::bigint,
  $$허용 경계: id를 명시적으로 유효한 UUID로 제공한 INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_boundary_id_explicit;

-- 경계 바깥: id를 명시적으로 NULL로 제공한 INSERT는 실패해야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (NULL, current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-id-2', 'p256dh_boundary_null', 'auth_boundary_null');
  $sql$,
  '23502',
  NULL,
  $$경계 바깥: id를 명시적으로 NULL로 제공한 INSERT는 실패해야 한다$$
);

-- 경계 바깥: id를 UUID 형식이 아닌 값으로 제공한 INSERT는 실패해야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES ('not-a-uuid', current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/bad-id', 'p256dh_boundary_bad', 'auth_boundary_bad');
  $sql$,
  '22P02',
  NULL,
  $$경계 바깥: id를 UUID 형식이 아닌 값으로 제공한 INSERT는 실패해야 한다$$
);

-- 허용 경계: created_at을 완전히 생략한 INSERT는 성공해야 한다
SAVEPOINT push_subscriptions_default_boundary_created_at_omit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  gen_random_uuid(),
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_boundary_created_at_omit',
  'auth_boundary_created_at_omit'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE p256dh = 'p256dh_boundary_created_at_omit') IS NOT NULL,
  $$허용 경계: created_at을 완전히 생략한 INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_boundary_created_at_omit;

-- 허용 경계: created_at을 명시적으로 유효한 timestamptz 값으로 제공한 INSERT는 성공해야 한다
SAVEPOINT push_subscriptions_default_boundary_created_at_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth,
  created_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_boundary_created_at_explicit',
  'auth_boundary_created_at_explicit',
  now() - interval '1 day'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE p256dh = 'p256dh_boundary_created_at_explicit') IS NOT NULL,
  $$허용 경계: created_at을 명시적으로 유효한 timestamptz 값으로 제공한 INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_boundary_created_at_explicit;

-- 경계 바깥: created_at을 명시적으로 NULL로 제공한 INSERT는 실패해야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-created-at-2', 'p256dh_boundary_ca_null', 'auth_boundary_ca_null', NULL);
  $sql$,
  '23502',
  NULL,
  $$경계 바깥: created_at을 명시적으로 NULL로 제공한 INSERT는 실패해야 한다$$
);

-- 경계 바깥: created_at을 timestamptz로 해석할 수 없는 값으로 제공한 INSERT는 실패해야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/bad-created-at', 'p256dh_boundary_ca_bad', 'auth_boundary_ca_bad', 'not-a-timestamp');
  $sql$,
  '22007',
  NULL,
  $$경계 바깥: created_at을 timestamptz로 해석할 수 없는 값으로 제공한 INSERT는 실패해야 한다$$
);

-- [불변 조건]
-- Status: push_subscriptions 테이블에는 id가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id IS NULL),
  0::bigint,
  $$Status: push_subscriptions 테이블에는 id가 NULL인 행이 존재해서는 안 된다$$
);

-- Status: push_subscriptions 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE created_at IS NULL),
  0::bigint,
  $$Status: push_subscriptions 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다$$
);

-- Transition: id를 생략한 새 행 생성 전후를 비교했을 때, 새로 생성된 행은 항상 고유한 식별 가능한 id를 가져야 한다
SAVEPOINT push_subscriptions_default_transition_id;
SELECT set_config(
  'test.transition_id_before',
  (SELECT count(*) FROM public.push_subscriptions)::text,
  true
);

INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_transition',
  'auth_transition'
)
RETURNING id;

SELECT ok(
  (
    (SELECT count(*) FROM public.push_subscriptions) = current_setting('test.transition_id_before')::bigint + 1
    AND (SELECT count(*) FROM public.push_subscriptions WHERE p256dh = 'p256dh_transition' AND id IS NOT NULL) = 1
  ),
  $$Transition: id를 생략한 새 행 생성 전후를 비교했을 때, 새로 생성된 행은 항상 고유한 식별 가능한 id를 가져야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_transition_id;

-- Transition: created_at을 생략한 새 행 생성 전후를 비교했을 때, 새로 생성된 행은 항상 생성 시점을 나타내는 값이 기록되어 있어야 한다
SAVEPOINT push_subscriptions_default_transition_created_at;
SELECT set_config(
  'test.transition_created_at_before',
  now()::text,
  true
);

INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  gen_random_uuid(),
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || gen_random_uuid(),
  'p256dh_transition_created_at',
  'auth_transition_created_at'
);

SELECT ok(
  (
    (SELECT created_at FROM public.push_subscriptions WHERE p256dh = 'p256dh_transition_created_at')
      >= current_setting('test.transition_created_at_before')::timestamptz
  ),
  $$Transition: created_at을 생략한 새 행 생성 전후를 비교했을 때, 새로 생성된 행은 항상 생성 시점을 나타내는 값이 기록되어 있어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_default_transition_created_at;

SELECT * FROM finish();
ROLLBACK;