-- =========================================
-- push_subscriptions / FK
-- =========================================
-- 검증 대상 FK 제약:
--   push_subscriptions_user_id_fkey
--   public.push_subscriptions(user_id) -> auth.users(id)

BEGIN;

SELECT plan(13);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_insert_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_insert_ab_id', gen_random_uuid()::text, true);
SELECT set_config('test.ps_insert_ab2_id', gen_random_uuid()::text, true);
SELECT set_config('test.invalid_user_id', gen_random_uuid()::text, true);

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
  )
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- [정답 조건]
-- 존재하는 user_a의 id를 참조하는 push_subscriptions INSERT는 성공해야 한다
SAVEPOINT push_subscriptions_fk_insert_a;
INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
VALUES (
  current_setting('test.ps_insert_a_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://example.com/endpoint/' || current_setting('test.ps_insert_a_id'),
  'p256dh_insert_a',
  'auth_insert_a'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_insert_a_id')::uuid),
  1::bigint,
  $$존재하는 user_a의 id를 참조하는 push_subscriptions INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_insert_a;

-- 서로 다른 유효한 user_id(user_a, user_b)를 참조하는 INSERT는 각각 성공해야 한다
SAVEPOINT push_subscriptions_fk_insert_ab;
INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
VALUES
  (
    current_setting('test.ps_insert_ab_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_insert_ab_id'),
    'p256dh_insert_ab1',
    'auth_insert_ab1'
  ),
  (
    current_setting('test.ps_insert_ab2_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'https://example.com/endpoint/' || current_setting('test.ps_insert_ab2_id'),
    'p256dh_insert_ab2',
    'auth_insert_ab2'
  );

SELECT ok(
  (
    (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_insert_ab_id')::uuid) = 1
    AND (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.ps_insert_ab2_id')::uuid) = 1
  ),
  $$서로 다른 유효한 user_id(user_a, user_b)를 참조하는 INSERT는 각각 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_insert_ab;

-- 기존 push_subscriptions의 user_id를 다른 유효한 user_id로 UPDATE하면 성공해야 한다
SAVEPOINT push_subscriptions_fk_update_valid_user;
UPDATE public.push_subscriptions
SET user_id = current_setting('test.user_b_id')::uuid
WHERE id = current_setting('test.ps_a1_id')::uuid;

SELECT ok(
  (
    SELECT user_id = current_setting('test.user_b_id')::uuid
    FROM public.push_subscriptions
    WHERE id = current_setting('test.ps_a1_id')::uuid
  ),
  $$기존 push_subscriptions의 user_id를 다른 유효한 user_id로 UPDATE하면 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_update_valid_user;

-- user_a 삭제 시 user_a의 push_subscriptions는 모두 삭제되어야 한다
SAVEPOINT push_subscriptions_fk_delete_a;
DELETE FROM auth.users
WHERE id = current_setting('test.user_a_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_a_id')::uuid),
  0::bigint,
  $$user_a 삭제 시 user_a의 push_subscriptions는 모두 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_delete_a;

-- [예외 조건]
-- 존재하지 않는 user_id를 참조하는 push_subscriptions는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_invalid', 'auth_invalid');
    $sql$,
    gen_random_uuid(),
    current_setting('test.invalid_user_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '23503',
  NULL,
  $$존재하지 않는 user_id를 참조하는 push_subscriptions는 생성될 수 없어야 한다$$
);

-- 삭제되어 더 이상 존재하지 않는 user_id를 참조하는 push_subscriptions는 생성될 수 없어야 한다
SAVEPOINT push_subscriptions_fk_insert_deleted_user;
DELETE FROM auth.users
WHERE id = current_setting('test.user_a_id')::uuid;

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_deleted', 'auth_deleted');
    $sql$,
    gen_random_uuid(),
    current_setting('test.user_a_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '23503',
  NULL,
  $$삭제되어 더 이상 존재하지 않는 user_id를 참조하는 push_subscriptions는 생성될 수 없어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_insert_deleted_user;

-- 기존 push_subscriptions의 user_id를 존재하지 않는 user_id로 UPDATE할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.invalid_user_id'),
    current_setting('test.ps_a1_id')
  ),
  '23503',
  NULL,
  $$기존 push_subscriptions의 user_id를 존재하지 않는 user_id로 UPDATE할 수 없어야 한다$$
);

-- [경계 조건]
-- push_subscriptions가 0개인 user_c 삭제는 성공해야 한다
SAVEPOINT push_subscriptions_fk_delete_user_c;
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM auth.users WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_c_id')
  ),
  $$push_subscriptions가 0개인 user_c 삭제는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_delete_user_c;

-- push_subscriptions가 1개인 user_b 삭제 시 해당 1개만 삭제되어야 한다
SAVEPOINT push_subscriptions_fk_delete_user_b;
SELECT set_config(
  'test.user_b_before',
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_b_id')::uuid)::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.user_b_id')::uuid;

SELECT ok(
  (
    current_setting('test.user_b_before')::bigint = 1
    AND (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_b_id')::uuid) = 0
  ),
  $$push_subscriptions가 1개인 user_b 삭제 시 해당 1개만 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_delete_user_b;

-- push_subscriptions가 여러 개인 user_a 삭제 시 모든 행이 삭제되어야 한다
SAVEPOINT push_subscriptions_fk_delete_user_a_many;
SELECT set_config(
  'test.user_a_before',
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_a_id')::uuid)::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.user_a_id')::uuid;

SELECT ok(
  (
    current_setting('test.user_a_before')::bigint >= 2
    AND (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_a_id')::uuid) = 0
  ),
  $$push_subscriptions가 여러 개인 user_a 삭제 시 모든 행이 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_delete_user_a_many;

-- 부모 삭제 직후 동일 user_id를 참조하는 생성은 허용되지 않아야 한다
SAVEPOINT push_subscriptions_fk_insert_after_delete;
DELETE FROM auth.users
WHERE id = current_setting('test.user_a_id')::uuid;

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
      VALUES ('%s'::uuid, '%s'::uuid, '%s', 'p256dh_after', 'auth_after');
    $sql$,
    gen_random_uuid(),
    current_setting('test.user_a_id'),
    'https://example.com/endpoint/' || gen_random_uuid()
  ),
  '23503',
  NULL,
  $$부모 삭제 직후 동일 user_id를 참조하는 생성은 허용되지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_insert_after_delete;

-- [불변 조건]
-- push_subscriptions에는 부모가 없는 user_id를 가진 orphan row가 존재해서는 안 된다
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.push_subscriptions ps
    LEFT JOIN auth.users u ON u.id = ps.user_id
    WHERE u.id IS NULL
  ),
  $$push_subscriptions에는 부모가 없는 user_id를 가진 orphan row가 존재해서는 안 된다$$
);

-- 특정 user 삭제 전후를 비교했을 때, 삭제 대상이 아닌 다른 user의 push_subscriptions 개수는 변하지 않아야 한다
SAVEPOINT push_subscriptions_fk_transition_other_user;
SELECT set_config(
  'test.user_b_count_before',
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_b_id')::uuid)::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.user_a_id')::uuid;

SELECT ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = current_setting('test.user_b_id')::uuid)
    = current_setting('test.user_b_count_before')::bigint,
  $$특정 user 삭제 전후를 비교했을 때, 삭제 대상이 아닌 다른 user의 push_subscriptions 개수는 변하지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_fk_transition_other_user;

SELECT * FROM finish();
ROLLBACK;