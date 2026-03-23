-- =========================================
-- push_subscriptions / RLS
-- =========================================

BEGIN;

SELECT plan(29);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_d_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_b2_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_d1_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_insert_own_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_update_own_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_delete_own_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_boundary_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_visibility_id', gen_random_uuid()::text, true);

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
  ),
  (
    current_setting('test.user_c_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_c_' || current_setting('test.user_c_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.user_d_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_d_' || current_setting('test.user_d_id') || '@example.com',
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
VALUES
  (
    current_setting('test.ps_a1_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_a1_id'),
    'p256dh_a1',
    'auth_a1'
  ),
  (
    current_setting('test.ps_a2_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_a2_id'),
    'p256dh_a2',
    'auth_a2'
  ),
  (
    current_setting('test.ps_b1_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_b1_id'),
    'p256dh_b1',
    'auth_b1'
  ),
  (
    current_setting('test.ps_b2_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_b2_id'),
    'p256dh_b2',
    'auth_b2'
  ),
  (
    current_setting('test.ps_d1_id')::uuid,
    current_setting('test.user_d_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_d1_id'),
    'p256dh_d1',
    'auth_d1'
  )
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- [정답 조건]
-- [SELECT] user_a로 인증 후 조건 없는 전체 조회를 하면 user_a 소유 행만 조회할 수 있어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  2::bigint,
  $$[SELECT] user_a로 인증 후 조건 없는 전체 조회를 하면 user_a 소유 행만 조회할 수 있어야 한다.$$
);

-- [SELECT] user_a로 인증 후 user_a 소유 행을 id 또는 user_id 조건으로 조회하면 해당 행을 조회할 수 있어야 한다.
SELECT ok(
  (
    (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_a1_id')::uuid) = 1
    AND (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_a_id')::uuid) = 2
  ),
  $$[SELECT] user_a로 인증 후 user_a 소유 행을 id 또는 user_id 조건으로 조회하면 해당 행을 조회할 수 있어야 한다.$$
);

-- [INSERT] user_a로 인증 후 user_a의 user_id로 push_subscriptions를 INSERT할 수 있어야 한다.
SAVEPOINT push_subscriptions_insert_own;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_insert_own_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_insert_own_id'),
  'p256dh_insert',
  'auth_insert'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_insert_own_id')::uuid),
  1::bigint,
  $$[INSERT] user_a로 인증 후 user_a의 user_id로 push_subscriptions를 INSERT할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_insert_own;

-- [UPDATE] user_a로 인증 후 user_a 소유 행의 endpoint, p256dh 또는 auth를 UPDATE할 수 있어야 한다.
SAVEPOINT push_subscriptions_update_own;
WITH updated AS (
  UPDATE public.push_subscriptions
  SET endpoint = endpoint || '/u', p256dh = 'p256dh_updated'
  WHERE id = current_setting('test.ps_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  $$[UPDATE] user_a로 인증 후 user_a 소유 행의 endpoint, p256dh 또는 auth를 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_update_own;

-- [DELETE] user_a로 인증 후 user_a 소유 행을 DELETE할 수 있어야 한다.
SAVEPOINT push_subscriptions_delete_own;
WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE id = current_setting('test.ps_a2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  1::bigint,
  $$[DELETE] user_a로 인증 후 user_a 소유 행을 DELETE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_delete_own;

-- [예외 조건]
-- RLS 차단 검증 방식 안내:
-- INSERT는 WITH CHECK 위반 시 SQLSTATE 42501 오류로 거부되므로 throws_ok로 검증한다.
-- UPDATE/DELETE는 대상 행이 정책에 의해 보이지 않으면 RETURNING 결과가 0건이 되므로 count(*) = 0으로 검증한다.

-- [SELECT] user_a로 인증 후 user_b 소유 행은 조회할 수 없어야 한다.
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_b_id')::uuid),
  0::bigint,
  $$[SELECT] user_a로 인증 후 user_b 소유 행은 조회할 수 없어야 한다.$$
);

-- [INSERT] user_a로 인증 후 user_b의 user_id를 사용한 타인 명의 INSERT는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_block', 'auth_block');
    $sql$,
    gen_random_uuid(),
    current_setting('test.user_b_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '42501',
  NULL,
  $$[INSERT] user_a로 인증 후 user_b의 user_id를 사용한 타인 명의 INSERT는 허용되지 않아야 한다.$$
);

-- [UPDATE] user_a로 인증 후 user_b 소유 행은 UPDATE할 수 없어야 한다.
WITH updated AS (
  UPDATE public.push_subscriptions
  SET p256dh = 'blocked'
  WHERE id = current_setting('test.ps_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$[UPDATE] user_a로 인증 후 user_b 소유 행은 UPDATE할 수 없어야 한다.$$
);

-- [DELETE] user_a로 인증 후 user_b 소유 행은 DELETE할 수 없어야 한다.
WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE id = current_setting('test.ps_b2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$[DELETE] user_a로 인증 후 user_b 소유 행은 DELETE할 수 없어야 한다.$$
);

-- [SELECT] anon 컨텍스트에서는 어떤 push_subscriptions 행도 조회할 수 없어야 한다.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  0::bigint,
  $$[SELECT] anon 컨텍스트에서는 어떤 push_subscriptions 행도 조회할 수 없어야 한다.$$
);

-- [INSERT] anon 컨텍스트에서는 push_subscriptions를 INSERT할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_anon', 'auth_anon');
    $sql$,
    gen_random_uuid(),
    current_setting('test.user_a_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '42501',
  NULL,
  $$[INSERT] anon 컨텍스트에서는 push_subscriptions를 INSERT할 수 없어야 한다.$$
);

-- [UPDATE] anon 컨텍스트에서는 push_subscriptions를 UPDATE할 수 없어야 한다.
WITH updated AS (
  UPDATE public.push_subscriptions
  SET auth = 'anon'
  WHERE id = current_setting('test.ps_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$[UPDATE] anon 컨텍스트에서는 push_subscriptions를 UPDATE할 수 없어야 한다.$$
);

-- [DELETE] anon 컨텍스트에서는 push_subscriptions를 DELETE할 수 없어야 한다.
WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE id = current_setting('test.ps_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$[DELETE] anon 컨텍스트에서는 push_subscriptions를 DELETE할 수 없어야 한다.$$
);

-- [경계 조건]
-- [SELECT 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자가 조건 없는 전체 조회를 하면 빈 집합이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  0::bigint,
  $$[SELECT 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자가 조건 없는 전체 조회를 하면 빈 집합이어야 한다.$$
);

-- [SELECT 분포 단일 경계] user_d처럼 본인 소유 행이 정확히 1개인 사용자가 조건 없는 전체 조회를 하면 정확히 1개만 반환되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_d_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  1::bigint,
  $$[SELECT 분포 단일 경계] user_d처럼 본인 소유 행이 정확히 1개인 사용자가 조건 없는 전체 조회를 하면 정확히 1개만 반환되어야 한다.$$
);

-- [SELECT 분포 최대측 경계] user_a처럼 본인 소유 행이 여러 개일 때 조건 없는 전체 조회를 하면 타인 행 없이 본인 행만 모두 반환되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  2::bigint,
  $$[SELECT 분포 최대측 경계] user_a처럼 본인 소유 행이 여러 개일 때 조건 없는 전체 조회를 하면 타인 행 없이 본인 행만 모두 반환되어야 한다.$$
);

-- [INSERT 허용 경계] user_a는 자신의 user_id라는 허용 경계값으로 INSERT할 수 있어야 한다.
SAVEPOINT push_subscriptions_boundary_insert_own;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_boundary_insert_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_boundary_insert_id'),
  'p256dh_boundary',
  'auth_boundary'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_boundary_insert_id')::uuid),
  1::bigint,
  $$[INSERT 허용 경계] user_a는 자신의 user_id라는 허용 경계값으로 INSERT할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_boundary_insert_own;

-- [INSERT 경계 바깥 값] user_a는 자신의 user_id가 아닌 타인 user_id(user_b)라는 경계 바깥 값으로는 INSERT할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_boundary_block', 'auth_boundary_block');
    $sql$,
    gen_random_uuid(),
    current_setting('test.user_b_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '42501',
  NULL,
  $$[INSERT 경계 바깥 값] user_a는 자신의 user_id가 아닌 타인 user_id(user_b)라는 경계 바깥 값으로는 INSERT할 수 없어야 한다.$$
);

-- [UPDATE 허용 경계] user_a는 자신의 소유 행이라는 허용 경계 안에서는 UPDATE할 수 있어야 한다.
SAVEPOINT push_subscriptions_boundary_update_own;
WITH updated AS (
  UPDATE public.push_subscriptions
  SET auth = 'auth_boundary_update'
  WHERE id = current_setting('test.ps_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  $$[UPDATE 허용 경계] user_a는 자신의 소유 행이라는 허용 경계 안에서는 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_boundary_update_own;

-- [UPDATE 경계 바깥 값] user_a는 타인 소유 행이라는 경계 바깥에서는 UPDATE할 수 없어야 한다.
WITH updated AS (
  UPDATE public.push_subscriptions
  SET auth = 'auth_block'
  WHERE id = current_setting('test.ps_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$[UPDATE 경계 바깥 값] user_a는 타인 소유 행이라는 경계 바깥에서는 UPDATE할 수 없어야 한다.$$
);

-- [UPDATE 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자는 타인 행이 존재하더라도 UPDATE 가능한 행이 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.push_subscriptions
  SET auth = 'auth_c'
  WHERE user_id = current_setting('test.user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$[UPDATE 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자는 타인 행이 존재하더라도 UPDATE 가능한 행이 0건이어야 한다.$$
);

-- [DELETE 허용 경계] user_a는 자신의 소유 행이라는 허용 경계 안에서는 DELETE할 수 있어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SAVEPOINT push_subscriptions_boundary_delete_own;
WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE id = current_setting('test.ps_a2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  1::bigint,
  $$[DELETE 허용 경계] user_a는 자신의 소유 행이라는 허용 경계 안에서는 DELETE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_boundary_delete_own;

-- [DELETE 경계 바깥 값] user_a는 타인 소유 행이라는 경계 바깥에서는 DELETE할 수 없어야 한다.
WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE id = current_setting('test.ps_b2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$[DELETE 경계 바깥 값] user_a는 타인 소유 행이라는 경계 바깥에서는 DELETE할 수 없어야 한다.$$
);

-- [DELETE 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자는 타인 행이 존재하더라도 DELETE 가능한 행이 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH deleted AS (
  DELETE FROM public.push_subscriptions
  WHERE user_id = current_setting('test.user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$[DELETE 분포 최소 경계] user_c처럼 본인 소유 행이 0개인 사용자는 타인 행이 존재하더라도 DELETE 가능한 행이 0건이어야 한다.$$
);

-- [불변 조건]
-- authenticated 사용자의 조건 없는 전체 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다. (Status)
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  2::bigint,
  $$authenticated 사용자의 조건 없는 전체 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다. (Status)$$
);

-- authenticated 사용자의 조건 없는 전체 조회 결과에는 타인 데이터가 0개여야 한다. (Status)
SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id <> current_setting('test.user_a_id')::uuid),
  0::bigint,
  $$authenticated 사용자의 조건 없는 전체 조회 결과에는 타인 데이터가 0개여야 한다. (Status)$$
);

-- anon 컨텍스트의 조회 결과에는 push_subscriptions 행이 0개여야 한다. (Status)
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  0::bigint,
  $$anon 컨텍스트의 조회 결과에는 push_subscriptions 행이 0개여야 한다. (Status)$$
);

-- 자신의 행 UPDATE 성공 후에도 수정 대상 외의 소유권 축인 user_id는 다른 사용자 값으로 바뀌지 않아야 한다. (Status)
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SAVEPOINT push_subscriptions_update_owner_invariant;
SELECT set_config(
  'test.ps_update_owner_before',
  (SELECT user_id::text FROM public.push_subscriptions WHERE id = current_setting('test.ps_a1_id')::uuid),
  true
);

UPDATE public.push_subscriptions
SET auth = 'auth_owner_update'
WHERE id = current_setting('test.ps_a1_id')::uuid;

SELECT ok(
  current_setting('test.ps_update_owner_before')::uuid =
    (SELECT user_id FROM public.push_subscriptions WHERE id = current_setting('test.ps_a1_id')::uuid),
  $$자신의 행 UPDATE 성공 후에도 수정 대상 외의 소유권 축인 user_id는 다른 사용자 값으로 바뀌지 않아야 한다. (Status)$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_update_owner_invariant;

-- 어떤 사용자가 자신의 행을 INSERT, UPDATE, DELETE 하더라도 다른 사용자의 조회 가시성 규칙은 유지되어야 하며, 다른 사용자는 계속 자기 행만 보고 타인 행은 볼 수 없어야 한다. (Status)
SAVEPOINT push_subscriptions_visibility_invariant;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.ps_visibility_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_visibility_id'),
  'p256dh_visibility',
  'auth_visibility'
);

UPDATE public.push_subscriptions
SET auth = 'auth_visibility_updated'
WHERE id = current_setting('test.ps_visibility_id')::uuid;

DELETE FROM public.push_subscriptions
WHERE id = current_setting('test.ps_visibility_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  (
    (SELECT count(*) FROM public.push_subscriptions) = 2
    AND (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_a_id')::uuid) = 0
  ),
  $$어떤 사용자가 자신의 행을 INSERT, UPDATE, DELETE 하더라도 다른 사용자의 조회 가시성 규칙은 유지되어야 하며, 다른 사용자는 계속 자기 행만 보고 타인 행은 볼 수 없어야 한다. (Status)$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_visibility_invariant;

SELECT * FROM finish();
ROLLBACK;