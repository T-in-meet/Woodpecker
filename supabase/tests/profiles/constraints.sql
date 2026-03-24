-- =========================================
-- profiles / CONSTRAINTS
-- =========================================

BEGIN;

SELECT plan(11);

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

-- seed: auth.users
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
  (current_setting('test.u9_id')::uuid, 'u9@test.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed: profiles (handle_new_user 트리거가 동작하지 않는 환경을 대비해 직접 INSERT)
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.u1_id')::uuid, 'user1', 'USER'),
  (current_setting('test.u2_id')::uuid, 'user2', 'USER'),
  (current_setting('test.u3_id')::uuid, 'user3', 'USER'),
  (current_setting('test.u4_id')::uuid, 'user4', 'USER'),
  (current_setting('test.u5_id')::uuid, 'user5', 'USER'),
  (current_setting('test.u6_id')::uuid, 'user6', 'USER'),
  (current_setting('test.u7_id')::uuid, 'user7', 'USER'),
  (current_setting('test.u8_id')::uuid, 'user8', 'USER'),
  (current_setting('test.u9_id')::uuid, 'user9', 'USER')
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- role이 USER이면 UPDATE가 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'USER'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u1_id')
  ),
  'role이 USER이면 UPDATE가 성공해야 한다'
);

-- role이 ADMIN이면 UPDATE가 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'ADMIN'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u2_id')
  ),
  'role이 ADMIN이면 UPDATE가 성공해야 한다'
);

-- [예외 조건]
-- role이 허용되지 않은 값(GUEST)이면 CHECK 위반으로 실패해야 한다
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
  'role이 허용되지 않은 값(GUEST)이면 CHECK 위반으로 실패해야 한다'
);

-- role이 임의 문자열이면 CHECK 위반으로 실패해야 한다
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
  'role이 임의 문자열이면 CHECK 위반으로 실패해야 한다'
);

-- [경계 조건]
-- role 소문자 user는 허용되지 않아야 한다
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
  'role 소문자 user는 허용되지 않아야 한다'
);

-- role 소문자 admin은 허용되지 않아야 한다
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
  'role 소문자 admin은 허용되지 않아야 한다'
);

-- role 빈 문자열은 허용되지 않아야 한다
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
  'role 빈 문자열은 허용되지 않아야 한다'
);

-- role 공백 포함 값은 허용되지 않아야 한다
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
  'role 공백 포함 값은 허용되지 않아야 한다'
);

-- role 혼합 대소문자(User)는 허용되지 않아야 한다
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
  'role 혼합 대소문자(User)는 허용되지 않아야 한다'
);

-- nickname이 빈 문자열이면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = ''
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u1_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_nickname_not_empty"',
  'nickname이 빈 문자열이면 CHECK 위반으로 실패해야 한다'
);

-- nickname이 10자를 초과하면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = '12345678901'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.u2_id')
  ),
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_nickname_max_length"',
  'nickname이 10자를 초과하면 CHECK 위반으로 실패해야 한다'
);

SELECT * FROM finish();
ROLLBACK;
