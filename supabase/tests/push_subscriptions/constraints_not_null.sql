-- =========================================
-- push_subscriptions / constraints_not_null
-- =========================================
-- Contract:
-- 이 테스트는 public.push_subscriptions의 NOT NULL 제약만 검증한다.
-- 값의 형식/도메인 유효성(예: endpoint 형식, 문자열 포맷 등)은 다른 constraints 테스트에서 담당한다.

BEGIN;

SELECT plan(62);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_updated_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_endpoint_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_p256dh_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_auth_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_valid_created_at_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_endpoint_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_p256dh_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_auth_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_created_at_id', gen_random_uuid()::text, true);

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
  ),
  (
    current_setting('test.user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: push_subscriptions
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
-- id를 생략하고 INSERT하면 성공해야 한다.
SAVEPOINT ps_not_null_id_omit;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_id'),
  'p256dh_valid_id',
  'auth_valid_id'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://example.com/endpoint/' || current_setting('test.ps_valid_id') AND id IS NOT NULL),
  1::bigint,
  $$id를 생략하고 INSERT하면 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_id_omit;

-- 유효한 UUID를 id에 명시하여 INSERT하면 성공해야 한다.
SAVEPOINT ps_not_null_id_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_id') || '/explicit',
  'p256dh_valid_id_explicit',
  'auth_valid_id_explicit'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_id')::uuid),
  1::bigint,
  $$유효한 UUID를 id에 명시하여 INSERT하면 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_id_explicit;

-- 기존 유효 행에서 id를 다른 유효한 UUID로 변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_id_update_valid;
UPDATE public.push_subscriptions
SET id = current_setting('test.ps_updated_id')::uuid
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_updated_id')::uuid),
  1::bigint,
  $$기존 유효 행에서 id를 다른 유효한 UUID로 변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_id_update_valid;

-- 유효한 auth.users.id를 user_id로 사용한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_user_id_insert;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_user_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_user_id'),
  'p256dh_valid_user',
  'auth_valid_user'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_user_id')::uuid),
  1::bigint,
  $$유효한 auth.users.id를 user_id로 사용한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_user_id_insert;

-- 기존 유효 행에서 user_id를 다른 유효한 auth.users.id로 변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_user_id_update_valid;
UPDATE public.push_subscriptions
SET user_id = current_setting('test.user_b_id')::uuid
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT is(
  (SELECT user_id FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid),
  current_setting('test.user_b_id')::uuid,
  $$기존 유효 행에서 user_id를 다른 유효한 auth.users.id로 변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_user_id_update_valid;

-- 비NULL endpoint를 사용한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_endpoint_insert;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_endpoint_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_endpoint_id'),
  'p256dh_valid_endpoint',
  'auth_valid_endpoint'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_endpoint_id')::uuid),
  1::bigint,
  $$비NULL endpoint를 사용한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_endpoint_insert;

-- 기존 유효 행에서 endpoint를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_endpoint_update;
UPDATE public.push_subscriptions
SET endpoint = endpoint || '/u'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT endpoint FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효 행에서 endpoint를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_endpoint_update;

-- 비NULL p256dh를 사용한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_p256dh_insert;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_p256dh_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_p256dh_id'),
  'p256dh_valid_p256dh',
  'auth_valid_p256dh'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_p256dh_id')::uuid),
  1::bigint,
  $$비NULL p256dh를 사용한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_p256dh_insert;

-- 기존 유효 행에서 p256dh를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_p256dh_update;
UPDATE public.push_subscriptions
SET p256dh = 'p256dh_updated'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT p256dh FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효 행에서 p256dh를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_p256dh_update;

-- 비NULL auth를 사용한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_auth_insert;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_auth_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_auth_id'),
  'p256dh_valid_auth',
  'auth_valid_auth'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_auth_id')::uuid),
  1::bigint,
  $$비NULL auth를 사용한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_auth_insert;

-- 기존 유효 행에서 auth를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_auth_update;
UPDATE public.push_subscriptions
SET auth = 'auth_updated'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT auth FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효 행에서 auth를 NULL이 아닌 다른 유효값으로 유지·변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_auth_update;

-- created_at을 생략한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_created_at_omit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_valid_created_at_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_created_at_id'),
  'p256dh_valid_created_at',
  'auth_valid_created_at'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_valid_created_at_id')::uuid) IS NOT NULL,
  $$created_at을 생략한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_created_at_omit;

-- 유효한 timestamp를 created_at에 명시한 INSERT는 성공해야 한다.
SAVEPOINT ps_not_null_created_at_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth,
  created_at
)
VALUES (
  current_setting('test.ps_valid_created_at_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_valid_created_at_id') || '/explicit',
  'p256dh_valid_created_at_explicit',
  'auth_valid_created_at_explicit',
  now() - interval '1 day'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE endpoint = 'https://example.com/endpoint/' || current_setting('test.ps_valid_created_at_id') || '/explicit') IS NOT NULL,
  $$유효한 timestamp를 created_at에 명시한 INSERT는 성공해야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_created_at_explicit;

-- 기존 유효 행에서 created_at을 다른 유효한 timestamp로 변경하는 작업은 허용되어야 한다.
SAVEPOINT ps_not_null_created_at_update_valid;
UPDATE public.push_subscriptions
SET created_at = created_at + interval '1 hour'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효 행에서 created_at을 다른 유효한 timestamp로 변경하는 작업은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_not_null_created_at_update_valid;

-- [예외 조건]
-- id를 NULL로 명시한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (NULL, current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-id', 'p256dh_null', 'auth_null');
  $sql$,
  '23502',
  'null value in column "id" of relation "push_subscriptions" violates not-null constraint',
  $$id를 NULL로 명시한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 id = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "id" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 id = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- user_id를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), NULL, 'https://example.com/endpoint/null-user', 'p256dh_null_user', 'auth_null_user');
  $sql$,
  '23502',
  'null value in column "user_id" of relation "push_subscriptions" violates not-null constraint',
  $$user_id를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 user_id = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "user_id" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 user_id = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- endpoint를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, NULL, 'p256dh_null_endpoint', 'auth_null_endpoint');
  $sql$,
  '23502',
  'null value in column "endpoint" of relation "push_subscriptions" violates not-null constraint',
  $$endpoint를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 endpoint = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET endpoint = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "endpoint" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 endpoint = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- p256dh를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-p256dh', NULL, 'auth_null_p256dh');
  $sql$,
  '23502',
  'null value in column "p256dh" of relation "push_subscriptions" violates not-null constraint',
  $$p256dh를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 p256dh = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET p256dh = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "p256dh" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 p256dh = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- auth를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-auth', 'p256dh_null_auth', NULL);
  $sql$,
  '23502',
  'null value in column "auth" of relation "push_subscriptions" violates not-null constraint',
  $$auth를 NULL로 입력한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 auth = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET auth = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "auth" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 auth = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- created_at을 NULL로 명시한 INSERT 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-created-at', 'p256dh_null_created_at', 'auth_null_created_at', NULL);
  $sql$,
  '23502',
  'null value in column "created_at" of relation "push_subscriptions" violates not-null constraint',
  $$created_at을 NULL로 명시한 INSERT 시도는 허용되지 않아야 한다.$$
);

-- 기존 유효 행을 created_at = NULL로 변경하는 시도는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET created_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "created_at" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 created_at = NULL로 변경하는 시도는 허용되지 않아야 한다.$$
);

-- [경계 조건]
-- id 생략 INSERT는 성공해야 한다. (기본값 적용 경계)
SAVEPOINT ps_boundary_id_omit;
INSERT INTO public.push_subscriptions (
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_id'),
  'p256dh_boundary_id',
  'auth_boundary_id'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://example.com/endpoint/' || current_setting('test.ps_boundary_id')),
  1::bigint,
  $$id 생략 INSERT는 성공해야 한다. (기본값 적용 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_id_omit;

-- id에 유효한 UUID 명시 INSERT는 성공해야 한다. (명시값 경계)
SAVEPOINT ps_boundary_id_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_id') || '/explicit',
  'p256dh_boundary_id_explicit',
  'auth_boundary_id_explicit'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_id')::uuid),
  1::bigint,
  $$id에 유효한 UUID 명시 INSERT는 성공해야 한다. (명시값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_id_explicit;

-- id = NULL 명시 INSERT는 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (NULL, current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-id-boundary', 'p256dh_boundary_null', 'auth_boundary_null');
  $sql$,
  '23502',
  'null value in column "id" of relation "push_subscriptions" violates not-null constraint',
  $$id = NULL 명시 INSERT는 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효 UUID 값을 가진 행을 다른 유효 UUID 값으로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_id_update_valid;
UPDATE public.push_subscriptions
SET id = current_setting('test.ps_updated_id')::uuid
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_updated_id')::uuid),
  1::bigint,
  $$기존 유효 UUID 값을 가진 행을 다른 유효 UUID 값으로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_id_update_valid;

-- 기존 유효 행을 id = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "id" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 id = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 유효한 user_id를 가진 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)
SAVEPOINT ps_boundary_user_id_valid;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_user_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_user_id'),
  'p256dh_boundary_user_id',
  'auth_boundary_user_id'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_user_id')::uuid),
  1::bigint,
  $$유효한 user_id를 가진 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_user_id_valid;

-- user_id = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), NULL, 'https://example.com/endpoint/null-user-boundary', 'p256dh_boundary_user_null', 'auth_boundary_user_null');
  $sql$,
  '23502',
  'null value in column "user_id" of relation "push_subscriptions" violates not-null constraint',
  $$user_id = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효한 user_id를 다른 유효한 auth.users.id로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_user_id_update_valid;
UPDATE public.push_subscriptions
SET user_id = current_setting('test.user_b_id')::uuid
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT is(
  (SELECT user_id FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid),
  current_setting('test.user_b_id')::uuid,
  $$기존 유효한 user_id를 다른 유효한 auth.users.id로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_user_id_update_valid;

-- 기존 유효 행을 user_id = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "user_id" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 user_id = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 고유한 비NULL endpoint를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)
SAVEPOINT ps_boundary_endpoint_valid;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_endpoint_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_endpoint_id'),
  'p256dh_boundary_endpoint',
  'auth_boundary_endpoint'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_endpoint_id')::uuid),
  1::bigint,
  $$고유한 비NULL endpoint를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_endpoint_valid;

-- endpoint = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, NULL, 'p256dh_boundary_endpoint_null', 'auth_boundary_endpoint_null');
  $sql$,
  '23502',
  'null value in column "endpoint" of relation "push_subscriptions" violates not-null constraint',
  $$endpoint = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효한 비NULL endpoint를 다른 유효한 비NULL endpoint로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_endpoint_update_valid;
UPDATE public.push_subscriptions
SET endpoint = endpoint || '/boundary'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT endpoint FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효한 비NULL endpoint를 다른 유효한 비NULL endpoint로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_endpoint_update_valid;

-- 기존 유효 행을 endpoint = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET endpoint = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "endpoint" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 endpoint = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 비NULL p256dh를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)
SAVEPOINT ps_boundary_p256dh_valid;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_p256dh_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_p256dh_id'),
  'p256dh_boundary_p256dh',
  'auth_boundary_p256dh'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_p256dh_id')::uuid),
  1::bigint,
  $$비NULL p256dh를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_p256dh_valid;

-- p256dh = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-p256dh-boundary', NULL, 'auth_boundary_p256dh_null');
  $sql$,
  '23502',
  'null value in column "p256dh" of relation "push_subscriptions" violates not-null constraint',
  $$p256dh = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효한 비NULL p256dh를 다른 유효한 비NULL 값으로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_p256dh_update_valid;
UPDATE public.push_subscriptions
SET p256dh = p256dh || '_boundary'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT p256dh FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효한 비NULL p256dh를 다른 유효한 비NULL 값으로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_p256dh_update_valid;

-- 기존 유효 행을 p256dh = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET p256dh = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "p256dh" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 p256dh = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 비NULL auth를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)
SAVEPOINT ps_boundary_auth_valid;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_auth_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_auth_id'),
  'auth_boundary_auth',
  'auth_boundary_auth'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_auth_id')::uuid),
  1::bigint,
  $$비NULL auth를 사용한 최소 유효 데이터 INSERT는 성공해야 한다. (유효값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_auth_valid;

-- auth = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-auth-boundary', 'p256dh_boundary_auth_null', NULL);
  $sql$,
  '23502',
  'null value in column "auth" of relation "push_subscriptions" violates not-null constraint',
  $$auth = NULL 입력은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효한 비NULL auth를 다른 유효한 비NULL 값으로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_auth_update_valid;
UPDATE public.push_subscriptions
SET auth = auth || '_boundary'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT auth FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효한 비NULL auth를 다른 유효한 비NULL 값으로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_auth_update_valid;

-- 기존 유효 행을 auth = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET auth = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "auth" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 auth = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- created_at 생략 INSERT는 성공해야 한다. (기본값 적용 경계)
SAVEPOINT ps_boundary_created_at_omit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_created_at_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_created_at_id'),
  'p256dh_boundary_created_at',
  'auth_boundary_created_at'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_created_at_id')::uuid) IS NOT NULL,
  $$created_at 생략 INSERT는 성공해야 한다. (기본값 적용 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_created_at_omit;

-- 유효한 timestamp 명시 INSERT는 성공해야 한다. (명시값 경계)
SAVEPOINT ps_boundary_created_at_explicit;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth,
  created_at
)
VALUES (
  current_setting('test.ps_boundary_created_at_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_created_at_id') || '/explicit',
  'p256dh_boundary_created_at_explicit',
  'auth_boundary_created_at_explicit',
  now() - interval '2 hours'
);

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE endpoint = 'https://example.com/endpoint/' || current_setting('test.ps_boundary_created_at_id') || '/explicit') IS NOT NULL,
  $$유효한 timestamp 명시 INSERT는 성공해야 한다. (명시값 경계)$$
);
ROLLBACK TO SAVEPOINT ps_boundary_created_at_explicit;

-- created_at = NULL 명시 INSERT는 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://example.com/endpoint/null-created-at-boundary', 'p256dh_boundary_created_at_null', 'auth_boundary_created_at_null', NULL);
  $sql$,
  '23502',
  'null value in column "created_at" of relation "push_subscriptions" violates not-null constraint',
  $$created_at = NULL 명시 INSERT는 허용되지 않아야 한다. (경계 바깥값)$$
);

-- 기존 유효한 timestamp 값을 다른 유효한 timestamp 값으로 변경하는 것은 허용되어야 한다.
SAVEPOINT ps_boundary_created_at_update_valid;
UPDATE public.push_subscriptions
SET created_at = created_at + interval '2 minutes'
WHERE id = current_setting('test.ps_seed_id')::uuid;

SELECT ok(
  (SELECT created_at FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid) IS NOT NULL,
  $$기존 유효한 timestamp 값을 다른 유효한 timestamp 값으로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT ps_boundary_created_at_update_valid;

-- 기존 유효 행을 created_at = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET created_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "created_at" of relation "push_subscriptions" violates not-null constraint',
  $$기존 유효 행을 created_at = NULL로 바꾸는 것은 허용되지 않아야 한다. (경계 바깥값)$$
);

-- [불변 조건]
-- public.push_subscriptions에는 id IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 id IS NULL인 행이 존재해서는 안 된다.$$
);

-- public.push_subscriptions에는 user_id IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 user_id IS NULL인 행이 존재해서는 안 된다.$$
);

-- public.push_subscriptions에는 endpoint IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 endpoint IS NULL인 행이 존재해서는 안 된다.$$
);

-- public.push_subscriptions에는 p256dh IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE p256dh IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 p256dh IS NULL인 행이 존재해서는 안 된다.$$
);

-- public.push_subscriptions에는 auth IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE auth IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 auth IS NULL인 행이 존재해서는 안 된다.$$
);

-- public.push_subscriptions에는 created_at IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE created_at IS NULL),
  0::bigint,
  $$public.push_subscriptions에는 created_at IS NULL인 행이 존재해서는 안 된다.$$
);

-- endpoint = NULL 업데이트 실패 시도 이후에도 seed 행의 endpoint 값은 시도 전과 동일하게 유지되어야 한다. (Transition)
DO $$
BEGIN
  PERFORM set_config(
    'test.endpoint_before_null_update',
    (SELECT endpoint::text
     FROM public.push_subscriptions
     WHERE id = current_setting('test.ps_seed_id')::uuid),
    true
  );
END $$;

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET endpoint = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "endpoint" of relation "push_subscriptions" violates not-null constraint',
  $$endpoint = NULL 업데이트 시도는 허용되지 않아야 한다. (Transition 전제)$$
);

SELECT is(
  (SELECT endpoint::text FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid),
  current_setting('test.endpoint_before_null_update'),
  $$endpoint = NULL 업데이트 실패 시도 이후에도 seed 행의 endpoint 값은 시도 전과 동일하게 유지되어야 한다. (Transition)$$
);

-- auth = NULL 업데이트 실패 시도 이후에도 seed 행의 auth 값은 시도 전과 동일하게 유지되어야 한다. (Transition)
DO $$
BEGIN
  PERFORM set_config(
    'test.auth_before_null_update',
    (SELECT auth::text
     FROM public.push_subscriptions
     WHERE id = current_setting('test.ps_seed_id')::uuid),
    true
  );
END $$;

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET auth = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.ps_seed_id')
  ),
  '23502',
  'null value in column "auth" of relation "push_subscriptions" violates not-null constraint',
  $$auth = NULL 업데이트 시도는 허용되지 않아야 한다. (Transition 전제)$$
);

SELECT is(
  (SELECT auth::text FROM public.push_subscriptions WHERE id = current_setting('test.ps_seed_id')::uuid),
  current_setting('test.auth_before_null_update'),
  $$auth = NULL 업데이트 실패 시도 이후에도 seed 행의 auth 값은 시도 전과 동일하게 유지되어야 한다. (Transition)$$
);

SELECT * FROM finish();
ROLLBACK;