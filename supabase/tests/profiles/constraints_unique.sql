-- =========================================
-- profiles / UNIQUE
-- =========================================

BEGIN;

SELECT plan(8);

SELECT set_config('test.profiles_constraints_unique_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_unique_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_unique_user_c_id', gen_random_uuid()::text, true);

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
  (current_setting('test.profiles_constraints_unique_user_a_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_constraints_unique_a_' || current_setting('test.profiles_constraints_unique_user_a_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_constraints_unique_user_b_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_constraints_unique_b_' || current_setting('test.profiles_constraints_unique_user_b_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_constraints_unique_user_c_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_constraints_unique_c_' || current_setting('test.profiles_constraints_unique_user_c_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- seed 정리
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_constraints_unique_user_a_id')::uuid,
  current_setting('test.profiles_constraints_unique_user_b_id')::uuid,
  current_setting('test.profiles_constraints_unique_user_c_id')::uuid
);

-- seed: profiles
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.profiles_constraints_unique_user_a_id')::uuid, 'pku001', 'USER'),
  (current_setting('test.profiles_constraints_unique_user_b_id')::uuid, 'pku002', 'USER')
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 서로 다른 id를 가진 profiles 행은 함께 생성될 수 있어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_constraints_unique_user_a_id')::uuid,
      current_setting('test.profiles_constraints_unique_user_b_id')::uuid
    )
  ),
  2::bigint,
  $$서로 다른 id를 가진 profiles 행은 함께 생성될 수 있어야 한다.$$
);

-- 기존 profiles 행의 id는 중복되지 않아야 한다.
SELECT is(
  (
    SELECT count(DISTINCT id)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_constraints_unique_user_a_id')::uuid,
      current_setting('test.profiles_constraints_unique_user_b_id')::uuid
    )
  ),
  2::bigint,
  $$기존 profiles 행의 id는 중복되지 않아야 한다.$$
);

-- [예외 조건]
-- 동일한 id로 profiles를 다시 INSERT하면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'dup0001', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_unique_user_a_id')
  ),
  '23505',
  NULL,
  $$동일한 id로 profiles를 다시 INSERT하면 안 된다.$$
);

-- 기존 행의 id를 다른 기존 id와 같게 UPDATE하면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET id = '%s'::uuid
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_unique_user_a_id'),
    current_setting('test.profiles_constraints_unique_user_b_id')
  ),
  '23505',
  NULL,
  $$기존 행의 id를 다른 기존 id와 같게 UPDATE하면 안 된다.$$
);

-- [경계 조건]
-- 아직 사용되지 않은 id로 첫 profiles INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'pku003', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_unique_user_c_id')
  ),
  $$아직 사용되지 않은 id로 첫 profiles INSERT는 성공해야 한다.$$
);

-- 동일한 id로 두 번째 profiles INSERT는 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'pku004', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_unique_user_c_id')
  ),
  '23505',
  NULL,
  $$동일한 id로 두 번째 profiles INSERT는 실패해야 한다.$$
);

-- [불변 조건]
-- public.profiles에는 중복 id가 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM (
      SELECT id
      FROM public.profiles
      GROUP BY id
      HAVING count(*) > 1
    ) dup
  ),
  0::bigint,
  $$public.profiles에는 중복 id가 존재해서는 안 된다.$$
);

-- 모든 public.profiles 행은 고유한 id를 가져야 한다.
SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  (SELECT count(DISTINCT id)::bigint FROM public.profiles),
  $$모든 public.profiles 행은 고유한 id를 가져야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
