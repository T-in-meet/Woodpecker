-- =========================================
-- profiles / CHECK (role)
-- =========================================

BEGIN;

SELECT plan(9);

-- 테스트용 UUID 준비
SELECT set_config('test.u1_id', gen_random_uuid()::text, true);
SELECT set_config('test.u2_id', gen_random_uuid()::text, true);
SELECT set_config('test.u3_id', gen_random_uuid()::text, true);
SELECT set_config('test.u4_id', gen_random_uuid()::text, true);
SELECT set_config('test.u5_id', gen_random_uuid()::text, true);
SELECT set_config('test.u6_id', gen_random_uuid()::text, true);
SELECT set_config('test.u7_id', gen_random_uuid()::text, true);
SELECT set_config('test.u8_id', gen_random_uuid()::text, true);
SELECT set_config('test.u9_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.u1_id')::uuid, 'u1@test.com', '{}'::jsonb),
  (current_setting('test.u2_id')::uuid, 'u2@test.com', '{}'::jsonb),
  (current_setting('test.u3_id')::uuid, 'u3@test.com', '{}'::jsonb),
  (current_setting('test.u4_id')::uuid, 'u4@test.com', '{}'::jsonb),
  (current_setting('test.u5_id')::uuid, 'u5@test.com', '{}'::jsonb),
  (current_setting('test.u6_id')::uuid, 'u6@test.com', '{}'::jsonb),
  (current_setting('test.u7_id')::uuid, 'u7@test.com', '{}'::jsonb),
  (current_setting('test.u8_id')::uuid, 'u8@test.com', '{}'::jsonb),
  (current_setting('test.u9_id')::uuid, 'u9@test.com', '{}'::jsonb);

-- [정답 조건]

SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'USER'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u1_id')
  ),
  'role USER 저장 가능'
);

SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'ADMIN'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u2_id')
  ),
  'role ADMIN 저장 가능'
);

-- [예외 조건]

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'GUEST'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u3_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  'role GUEST 거부'
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'RANDOM'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u4_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '임의 문자열 거부'
);

-- [경계 조건]

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'user'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u5_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '소문자 user 거부'
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'admin'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u6_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '소문자 admin 거부'
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = ''
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u7_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '빈 문자열 거부'
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = ' USER '
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u8_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '공백 포함 USER 거부'
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'User'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u9_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_role_check"',
  '혼합 대소문자 User 거부'
);

SELECT * FROM finish();
ROLLBACK;