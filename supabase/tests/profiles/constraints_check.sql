-- =========================================
-- profiles / CHECK
-- =========================================

BEGIN;

SELECT plan(23);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_constraints_check_user_01_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_02_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_03_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_04_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_05_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_06_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_07_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_08_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_09_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_10_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_11_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_12_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_13_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_14_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_15_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_16_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_17_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_18_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_check_user_19_id', gen_random_uuid()::text, true);

-- seed: auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.profiles_constraints_check_user_01_id')::uuid, 'profiles_constraints_check_user_01@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_02_id')::uuid, 'profiles_constraints_check_user_02@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_03_id')::uuid, 'profiles_constraints_check_user_03@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_04_id')::uuid, 'profiles_constraints_check_user_04@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_05_id')::uuid, 'profiles_constraints_check_user_05@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_06_id')::uuid, 'profiles_constraints_check_user_06@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_07_id')::uuid, 'profiles_constraints_check_user_07@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_08_id')::uuid, 'profiles_constraints_check_user_08@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_09_id')::uuid, 'profiles_constraints_check_user_09@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_10_id')::uuid, 'profiles_constraints_check_user_10@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_11_id')::uuid, 'profiles_constraints_check_user_11@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_12_id')::uuid, 'profiles_constraints_check_user_12@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_13_id')::uuid, 'profiles_constraints_check_user_13@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_14_id')::uuid, 'profiles_constraints_check_user_14@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_15_id')::uuid, 'profiles_constraints_check_user_15@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_16_id')::uuid, 'profiles_constraints_check_user_16@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_17_id')::uuid, 'profiles_constraints_check_user_17@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_18_id')::uuid, 'profiles_constraints_check_user_18@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_check_user_19_id')::uuid, 'profiles_constraints_check_user_19@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed: profiles
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.profiles_constraints_check_user_01_id')::uuid, 'seed01', 'USER'),
  (current_setting('test.profiles_constraints_check_user_02_id')::uuid, 'seed02', 'USER'),
  (current_setting('test.profiles_constraints_check_user_03_id')::uuid, 'seed03', 'USER'),
  (current_setting('test.profiles_constraints_check_user_04_id')::uuid, 'seed04', 'USER'),
  (current_setting('test.profiles_constraints_check_user_05_id')::uuid, 'seed05', 'USER'),
  (current_setting('test.profiles_constraints_check_user_06_id')::uuid, 'seed06', 'USER'),
  (current_setting('test.profiles_constraints_check_user_07_id')::uuid, 'seed07', 'USER'),
  (current_setting('test.profiles_constraints_check_user_08_id')::uuid, 'seed08', 'USER'),
  (current_setting('test.profiles_constraints_check_user_09_id')::uuid, 'seed09', 'USER'),
  (current_setting('test.profiles_constraints_check_user_10_id')::uuid, 'seed10', 'USER'),
  (current_setting('test.profiles_constraints_check_user_11_id')::uuid, 'seed11', 'USER'),
  (current_setting('test.profiles_constraints_check_user_12_id')::uuid, 'seed12', 'USER'),
  (current_setting('test.profiles_constraints_check_user_13_id')::uuid, 'seed13', 'USER'),
  (current_setting('test.profiles_constraints_check_user_14_id')::uuid, 'seed14', 'USER'),
  (current_setting('test.profiles_constraints_check_user_15_id')::uuid, 'seed15', 'USER'),
  (current_setting('test.profiles_constraints_check_user_16_id')::uuid, 'seed16', 'USER'),
  (current_setting('test.profiles_constraints_check_user_17_id')::uuid, 'seed17', 'USER'),
  (current_setting('test.profiles_constraints_check_user_18_id')::uuid, 'seed18', 'USER'),
  (current_setting('test.profiles_constraints_check_user_19_id')::uuid, 'seed19', 'USER')
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- profiles.role은 USER를 허용해야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'USER'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_01_id')
  ),
  $$profiles.role은 USER를 허용해야 한다.$$ 
);

-- profiles.role은 ADMIN을 허용해야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'ADMIN'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_02_id')
  ),
  $$profiles.role은 ADMIN을 허용해야 한다.$$
);

-- profiles.nickname은 빈 문자열이 아닌 값을 허용해야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = 'validnick'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_03_id')
  ),
  $$profiles.nickname은 빈 문자열이 아닌 값을 허용해야 한다.$$
);

-- profiles.nickname은 길이 10 이하의 값을 허용해야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = 'len9value'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_04_id')
  ),
  $$profiles.nickname은 길이 10 이하의 값을 허용해야 한다.$$
);

-- profiles.nickname은 길이 10인 값을 허용해야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = 'tenletters'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_05_id')
  ),
  $$profiles.nickname은 길이 10인 값을 허용해야 한다.$$
);

-- [예외 조건]
-- profiles.role은 USER와 ADMIN 외의 값을 허용하면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'GUEST'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_06_id')
  ),
  '23514',
  NULL,
  $$profiles.role은 USER와 ADMIN 외의 값을 허용하면 안 된다.$$
);

-- profiles.nickname은 빈 문자열을 허용하면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = ''
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_07_id')
  ),
  '23514',
  NULL,
  $$profiles.nickname은 빈 문자열을 허용하면 안 된다.$$
);

-- profiles.nickname은 길이 11 이상인 값을 허용하면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = 'elevenchars'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_08_id')
  ),
  '23514',
  NULL,
  $$profiles.nickname은 길이 11 이상인 값을 허용하면 안 된다.$$
);

-- [경계 조건]
-- profiles.role은 USER일 때 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'USER'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_09_id')
  ),
  $$profiles.role은 USER일 때 허용되어야 한다.$$
);

-- profiles.role은 ADMIN일 때 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'ADMIN'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_10_id')
  ),
  $$profiles.role은 ADMIN일 때 허용되어야 한다.$$
);

-- profiles.role은 user일 때 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'user'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_11_id')
  ),
  '23514',
  NULL,
  $$profiles.role은 user일 때 허용되면 안 된다.$$
);

-- profiles.role은 admin일 때 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'admin'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_12_id')
  ),
  '23514',
  NULL,
  $$profiles.role은 admin일 때 허용되면 안 된다.$$
);

-- profiles.role은 빈 문자열일 때 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = ''
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_13_id')
  ),
  '23514',
  NULL,
  $$profiles.role은 빈 문자열일 때 허용되면 안 된다.$$
);

-- profiles.role은 USER 또는 ADMIN을 제외한 임의 문자열일 때 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = 'RANDOM'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_14_id')
  ),
  '23514',
  NULL,
  $$profiles.role은 USER 또는 ADMIN을 제외한 임의 문자열일 때 허용되면 안 된다.$$
);

-- profiles.nickname은 길이 1일 때 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = 'a'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_15_id')
  ),
  $$profiles.nickname은 길이 1일 때 허용되어야 한다.$$
);

-- profiles.nickname은 길이 9일 때 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = '123456789'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_16_id')
  ),
  $$profiles.nickname은 길이 9일 때 허용되어야 한다.$$
);

-- profiles.nickname은 길이 10일 때 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = '1234567890'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_17_id')
  ),
  $$profiles.nickname은 길이 10일 때 허용되어야 한다.$$
);

-- profiles.nickname은 길이 11일 때 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = '12345678901'
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_18_id')
  ),
  '23514',
  NULL,
  $$profiles.nickname은 길이 11일 때 허용되면 안 된다.$$
);

-- profiles.nickname은 공백 한 글자일 때 현재 정책 기준에서는 허용되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = ' '
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_check_user_19_id')
  ),
  $$profiles.nickname은 공백 한 글자일 때 현재 정책 기준에서는 허용되어야 한다.$$
);

-- [불변 조건]
-- public.profiles의 모든 role 값은 항상 USER 또는 ADMIN 중 하나여야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE role NOT IN ('USER', 'ADMIN')
  ),
  0::bigint,
  $$public.profiles의 모든 role 값은 항상 USER 또는 ADMIN 중 하나여야 한다.$$
);

-- public.profiles의 모든 nickname 값은 항상 빈 문자열이 아니어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE nickname = ''
  ),
  0::bigint,
  $$public.profiles의 모든 nickname 값은 항상 빈 문자열이 아니어야 한다.$$
);

-- public.profiles의 모든 nickname 값은 항상 길이 10 이하여야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE char_length(nickname) > 10
  ),
  0::bigint,
  $$public.profiles의 모든 nickname 값은 항상 길이 10 이하여야 한다.$$
);

-- 현재 CHECK 정책에는 공백-only nickname 금지 규칙이 없으므로 공백-only 값 차단을 이 파일의 불변 조건으로 가정하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE nickname = ' '
  ),
  1::bigint,
  $$현재 CHECK 정책에는 공백-only nickname 금지 규칙이 없으므로 공백-only 값 차단을 이 파일의 불변 조건으로 가정하면 안 된다.$$
);

SELECT * FROM finish();
ROLLBACK;
