-- =========================================
-- profiles / TRIGGER
-- =========================================

BEGIN;

SELECT plan(38);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_trigger_auto_full_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_auto_nickless_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_auto_avatarless_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_auto_empty_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_auto_multi_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_auto_multi_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_nickname_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_avatar_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_role_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_created_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_same_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_multi_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_direct_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_trigger_upd_control_id', gen_random_uuid()::text, true);

-- seed: auth.users (UPDATE 검증용 사용자)
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
  (current_setting('test.profiles_trigger_upd_nickname_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_nickname_' || current_setting('test.profiles_trigger_upd_nickname_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_avatar_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_avatar_' || current_setting('test.profiles_trigger_upd_avatar_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_role_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_role_' || current_setting('test.profiles_trigger_upd_role_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_created_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_created_' || current_setting('test.profiles_trigger_upd_created_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_same_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_same_' || current_setting('test.profiles_trigger_upd_same_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_multi_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_multi_' || current_setting('test.profiles_trigger_upd_multi_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_direct_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_direct_' || current_setting('test.profiles_trigger_upd_direct_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.profiles_trigger_upd_control_id')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profiles_trigger_upd_control_' || current_setting('test.profiles_trigger_upd_control_id') || '@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- seed 정리: auth.users INSERT 트리거로 미리 생성된 profiles 행 제거
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_trigger_upd_nickname_id')::uuid,
  current_setting('test.profiles_trigger_upd_avatar_id')::uuid,
  current_setting('test.profiles_trigger_upd_role_id')::uuid,
  current_setting('test.profiles_trigger_upd_created_id')::uuid,
  current_setting('test.profiles_trigger_upd_same_id')::uuid,
  current_setting('test.profiles_trigger_upd_multi_id')::uuid,
  current_setting('test.profiles_trigger_upd_direct_id')::uuid,
  current_setting('test.profiles_trigger_upd_control_id')::uuid,
  current_setting('test.profiles_trigger_auto_full_id')::uuid,
  current_setting('test.profiles_trigger_auto_nickless_id')::uuid,
  current_setting('test.profiles_trigger_auto_avatarless_id')::uuid,
  current_setting('test.profiles_trigger_auto_empty_id')::uuid,
  current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
  current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
);

-- seed: UPDATE 검증용 profiles
INSERT INTO public.profiles (id, nickname, avatar_url, role, created_at, updated_at)
VALUES
  (current_setting('test.profiles_trigger_upd_nickname_id')::uuid, 'tnick01', NULL, 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_avatar_id')::uuid, 'tavtr01', NULL, 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_role_id')::uuid, 'trole01', 'https://e.com/1.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_created_id')::uuid, 'tcreat1', 'https://e.com/2.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_same_id')::uuid, 'tsame01', 'https://e.com/3.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_multi_id')::uuid, 'tmulti1', 'https://e.com/4.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_direct_id')::uuid, 'tdirct1', 'https://e.com/5.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_trigger_upd_control_id')::uuid, 'tctrl01', 'https://e.com/6.png', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 신규 auth.users INSERT 후 동일한 id를 가진 public.profiles 행이 자동으로 1건 생성되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_full_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"nickname":"fullauto1","avatar_url":"https://e.com/a.png"}'::jsonb,
        now(),
        now()
      )
    $sql$,
    current_setting('test.profiles_trigger_auto_full_id'),
    current_setting('test.profiles_trigger_auto_full_id')
  ),
  $$신규 auth.users INSERT 후 동일한 id를 가진 public.profiles 행이 자동으로 1건 생성되어야 한다.$$
);

-- 자동 생성된 profiles.id는 새로 생성된 auth.users.id와 같아야 한다.
SELECT is(
  (
    SELECT id
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid
  ),
  current_setting('test.profiles_trigger_auto_full_id')::uuid,
  $$자동 생성된 profiles.id는 새로 생성된 auth.users.id와 같아야 한다.$$
);

-- raw_user_meta_data.nickname이 있으면 자동 생성된 profiles.nickname에 반영되어야 한다.
SELECT is(
  (
    SELECT nickname
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid
  ),
  'fullauto1',
  $$raw_user_meta_data.nickname이 있으면 자동 생성된 profiles.nickname에 반영되어야 한다.$$
);

-- raw_user_meta_data.avatar_url이 있으면 자동 생성된 profiles.avatar_url에 반영되어야 한다.
SELECT is(
  (
    SELECT avatar_url
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid
  ),
  'https://e.com/a.png',
  $$raw_user_meta_data.avatar_url이 있으면 자동 생성된 profiles.avatar_url에 반영되어야 한다.$$
);

-- raw_user_meta_data.nickname이 없으면 fallback nickname이 자동으로 채워져야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_nickless_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"avatar_url":"https://e.com/b.png"}'::jsonb,
        now(),
        now()
      )
    $sql$,
    current_setting('test.profiles_trigger_auto_nickless_id'),
    current_setting('test.profiles_trigger_auto_nickless_id')
  ),
  $$raw_user_meta_data.nickname이 없으면 fallback nickname이 자동으로 채워져야 한다.$$
);

-- [예외 조건]
-- auth.users는 생성되었는데 대응하는 profiles 행이 생성되지 않으면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = current_setting('test.profiles_trigger_auto_full_id')::uuid
      AND p.id IS NULL
  ),
  0::bigint,
  $$auth.users는 생성되었는데 대응하는 profiles 행이 생성되지 않으면 안 된다.$$
);

-- 동일한 auth.users.id에 대해 profiles가 2건 이상 생성되면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid
  ),
  1::bigint,
  $$동일한 auth.users.id에 대해 profiles가 2건 이상 생성되면 안 된다.$$
);

-- 자동 생성된 profiles.id가 다른 사용자의 id를 참조하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_trigger_auto_full_id')::uuid,
      current_setting('test.profiles_trigger_auto_nickless_id')::uuid
    )
  ),
  2::bigint,
  $$자동 생성된 profiles.id가 다른 사용자의 id를 참조하면 안 된다.$$
);

-- [경계 조건]
-- 메타데이터 완전 제공 경계: nickname, avatar_url를 모두 제공하고 회원가입하면 두 값이 그대로 반영되어야 한다.
SELECT ok(
  (
    (SELECT nickname FROM public.profiles WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid) = 'fullauto1'
    AND (SELECT avatar_url FROM public.profiles WHERE id = current_setting('test.profiles_trigger_auto_full_id')::uuid) = 'https://e.com/a.png'
  ),
  $$메타데이터 완전 제공 경계: nickname, avatar_url를 모두 제공하고 회원가입하면 두 값이 그대로 반영되어야 한다.$$
);

-- nickname 누락 경계: nickname 없이 회원가입하면 fallback nickname이 채워져야 한다.
SELECT is(
  (
    SELECT nickname
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_nickless_id')::uuid
  ),
  'user_' || substring(current_setting('test.profiles_trigger_auto_nickless_id') from 1 for 5),
  $$nickname 누락 경계: nickname 없이 회원가입하면 fallback nickname이 채워져야 한다.$$
);

-- avatar_url 누락 경계: avatar_url 없이 회원가입하면 profiles.avatar_url은 NULL이어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_avatarless_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"nickname":"avatr001"}'::jsonb,
        now(),
        now()
      )
    $sql$,
    current_setting('test.profiles_trigger_auto_avatarless_id'),
    current_setting('test.profiles_trigger_auto_avatarless_id')
  ),
  $$avatar_url 누락 경계: avatar_url 없이 회원가입하면 profiles.avatar_url은 NULL이어야 한다.$$
);

SELECT ok(
  (
    SELECT avatar_url IS NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_auto_avatarless_id')::uuid
  ),
  $$avatar_url 누락 경계: avatar_url 없이 회원가입하면 profiles.avatar_url은 NULL이어야 한다.$$
);

-- 메타데이터 전체 누락 경계: 메타데이터가 비어 있어도 profiles 행은 생성되어야 하며, 최소한 id와 fallback nickname이 채워져야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_empty_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      )
    $sql$,
    current_setting('test.profiles_trigger_auto_empty_id'),
    current_setting('test.profiles_trigger_auto_empty_id')
  ),
  $$메타데이터 전체 누락 경계: 메타데이터가 비어 있어도 profiles 행은 생성되어야 하며, 최소한 id와 fallback nickname이 채워져야 한다.$$
);

SELECT ok(
  (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = current_setting('test.profiles_trigger_auto_empty_id')::uuid)
    AND (SELECT nickname FROM public.profiles WHERE id = current_setting('test.profiles_trigger_auto_empty_id')::uuid) = 'user_' || substring(current_setting('test.profiles_trigger_auto_empty_id') from 1 for 5)
  ),
  $$메타데이터 전체 누락 경계: 메타데이터가 비어 있어도 profiles 행은 생성되어야 하며, 최소한 id와 fallback nickname이 채워져야 한다.$$
);

-- 다건 분포 경계: 여러 사용자가 순차적으로 생성되어도 각 사용자마다 자신의 profiles가 정확히 1건씩 생성되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES
      (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_multi_a_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"nickname":"multi001"}'::jsonb,
        now(),
        now()
      ),
      (
        '%s'::uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'profiles_trigger_auto_multi_b_' || '%s' || '@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"nickname":"multi002"}'::jsonb,
        now(),
        now()
      )
    $sql$,
    current_setting('test.profiles_trigger_auto_multi_a_id'),
    current_setting('test.profiles_trigger_auto_multi_a_id'),
    current_setting('test.profiles_trigger_auto_multi_b_id'),
    current_setting('test.profiles_trigger_auto_multi_b_id')
  ),
  $$다건 분포 경계: 여러 사용자가 순차적으로 생성되어도 각 사용자마다 자신의 profiles가 정확히 1건씩 생성되어야 한다.$$
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
    )
  ),
  2::bigint,
  $$다건 분포 경계: 여러 사용자가 순차적으로 생성되어도 각 사용자마다 자신의 profiles가 정확히 1건씩 생성되어야 한다.$$
);

-- [불변 조건]
-- auth.users에 존재하는 사용자 중 profiles 생성 대상인 사용자는 대응하는 profiles 1건을 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id IN (
      current_setting('test.profiles_trigger_auto_full_id')::uuid,
      current_setting('test.profiles_trigger_auto_nickless_id')::uuid,
      current_setting('test.profiles_trigger_auto_avatarless_id')::uuid,
      current_setting('test.profiles_trigger_auto_empty_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
    )
  ),
  6::bigint,
  $$auth.users에 존재하는 사용자 중 profiles 생성 대상인 사용자는 대응하는 profiles 1건을 가져야 한다.$$
);

-- 자동 생성된 profiles.id는 항상 같은 사용자의 auth.users.id와 일치해야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.id IN (
      current_setting('test.profiles_trigger_auto_full_id')::uuid,
      current_setting('test.profiles_trigger_auto_nickless_id')::uuid,
      current_setting('test.profiles_trigger_auto_avatarless_id')::uuid,
      current_setting('test.profiles_trigger_auto_empty_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
    )
  ),
  6::bigint,
  $$자동 생성된 profiles.id는 항상 같은 사용자의 auth.users.id와 일치해야 한다.$$
);

-- 자동 생성 정책 이후에도 profiles에는 동일 사용자에 대한 중복 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM (
      SELECT id
      FROM public.profiles
      WHERE id IN (
        current_setting('test.profiles_trigger_auto_full_id')::uuid,
        current_setting('test.profiles_trigger_auto_nickless_id')::uuid,
        current_setting('test.profiles_trigger_auto_avatarless_id')::uuid,
        current_setting('test.profiles_trigger_auto_empty_id')::uuid,
        current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
        current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
      )
      GROUP BY id
      HAVING count(*) > 1
    ) dup
  ),
  0::bigint,
  $$자동 생성 정책 이후에도 profiles에는 동일 사용자에 대한 중복 행이 존재해서는 안 된다.$$
);

-- 사용자 생성 직후의 profiles 초기 상태는 “사용자 1명당 프로필 1건” 구조를 유지해야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_trigger_auto_full_id')::uuid,
      current_setting('test.profiles_trigger_auto_nickless_id')::uuid,
      current_setting('test.profiles_trigger_auto_avatarless_id')::uuid,
      current_setting('test.profiles_trigger_auto_empty_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_a_id')::uuid,
      current_setting('test.profiles_trigger_auto_multi_b_id')::uuid
    )
  ),
  6::bigint,
  $$사용자 생성 직후의 profiles 초기 상태는 “사용자 1명당 프로필 1건” 구조를 유지해야 한다.$$
);

-- [정답 조건]
-- nickname을 다른 값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.
SELECT set_config('test.profiles_trigger_upd_nickname_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid), true);
UPDATE public.profiles SET nickname = 'tnick02' WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid;
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_nickname_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid
  ),
  $$nickname을 다른 값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.$$
);

-- avatar_url을 다른 값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.
SELECT set_config('test.profiles_trigger_upd_avatar_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid), true);
UPDATE public.profiles SET avatar_url = 'https://e.com/new.png' WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid;
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_avatar_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid
  ),
  $$avatar_url을 다른 값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.$$
);

-- role을 다른 허용값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.
SELECT set_config('test.profiles_trigger_upd_role_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_role_id')::uuid), true);
UPDATE public.profiles SET role = 'ADMIN' WHERE id = current_setting('test.profiles_trigger_upd_role_id')::uuid;
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_role_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_role_id')::uuid
  ),
  $$role을 다른 허용값으로 UPDATE한 후 updated_at은 변경 전보다 커야 한다.$$
);

-- 실제 변경이 발생한 UPDATE 후에도 created_at은 변경되면 안 된다.
SELECT set_config('test.profiles_trigger_upd_created_before', (SELECT created_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_created_id')::uuid), true);
UPDATE public.profiles SET nickname = 'tcreat2' WHERE id = current_setting('test.profiles_trigger_upd_created_id')::uuid;
SELECT is(
  (
    SELECT created_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_created_id')::uuid
  ),
  current_setting('test.profiles_trigger_upd_created_before')::timestamptz,
  $$실제 변경이 발생한 UPDATE 후에도 created_at은 변경되면 안 된다.$$
);

-- [예외 조건]
-- 실제 변경이 있었는데 updated_at이 그대로면 안 된다.
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_nickname_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid
  ),
  $$실제 변경이 있었는데 updated_at이 그대로면 안 된다.$$
);

-- 실제 변경이 있었는데 updated_at이 과거 값으로 남아 있으면 안 된다.
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_avatar_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid
  ),
  $$실제 변경이 있었는데 updated_at이 과거 값으로 남아 있으면 안 된다.$$
);

-- 특정 컬럼 변경 시 수정 대상이 아닌 다른 핵심 컬럼이 함께 변하면 안 된다.
SELECT ok(
  (
    SELECT id = current_setting('test.profiles_trigger_upd_role_id')::uuid
       AND nickname = 'trole01'
       AND created_at = '2024-01-01 00:00:00+00'::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_role_id')::uuid
  ),
  $$특정 컬럼 변경 시 수정 대상이 아닌 다른 핵심 컬럼이 함께 변하면 안 된다.$$
);

-- [경계 조건]
-- 단일 컬럼 변경 경계: nickname만 변경하면 updated_at만 함께 갱신되고 나머지 비대상 컬럼은 유지되어야 한다.
SELECT ok(
  (
    SELECT avatar_url IS NULL
       AND role = 'USER'
       AND updated_at > current_setting('test.profiles_trigger_upd_nickname_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid
  ),
  $$단일 컬럼 변경 경계: nickname만 변경하면 updated_at만 함께 갱신되고 나머지 비대상 컬럼은 유지되어야 한다.$$
);

-- nullable 컬럼 변경 경계: avatar_url을 NULL → 값, 값 → NULL로 바꿀 때 모두 실제 변경으로 간주되어 updated_at이 갱신되어야 한다.
SELECT set_config('test.profiles_trigger_upd_avatar_null_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid), true);
UPDATE public.profiles SET avatar_url = NULL WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid;
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_avatar_null_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_avatar_id')::uuid
  ),
  $$nullable 컬럼 변경 경계: avatar_url을 NULL → 값, 값 → NULL로 바꿀 때 모두 실제 변경으로 간주되어 updated_at이 갱신되어야 한다.$$
);

-- 여러 컬럼 동시 변경 경계: nickname과 avatar_url을 함께 바꿔도 updated_at은 1회 UPDATE 결과로 정상 갱신되어야 한다.
SELECT set_config('test.profiles_trigger_upd_multi_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_multi_id')::uuid), true);
UPDATE public.profiles SET nickname = 'tmulti2', avatar_url = 'https://e.com/m2.png' WHERE id = current_setting('test.profiles_trigger_upd_multi_id')::uuid;
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_multi_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_multi_id')::uuid
  ),
  $$여러 컬럼 동시 변경 경계: nickname과 avatar_url을 함께 바꿔도 updated_at은 1회 UPDATE 결과로 정상 갱신되어야 한다.$$
);

-- INSERT vs UPDATE 경계: INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at은 달라야 한다.
SELECT ok(
  (
    SELECT updated_at <> '2024-01-01 00:00:00+00'::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_multi_id')::uuid
  ),
  $$INSERT vs UPDATE 경계: INSERT 시점의 updated_at과 이후 실제 변경 UPDATE 시점의 updated_at은 달라야 한다.$$
);

-- 동일값 UPDATE 경계: 동일한 nickname 값으로 UPDATE하면 updated_at은 변경되지 않아야 한다.
SELECT set_config('test.profiles_trigger_upd_same_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_same_id')::uuid), true);
UPDATE public.profiles SET nickname = 'tsame01' WHERE id = current_setting('test.profiles_trigger_upd_same_id')::uuid;
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_same_id')::uuid
  ),
  current_setting('test.profiles_trigger_upd_same_before')::timestamptz,
  $$동일값 UPDATE 경계: 동일한 nickname 값으로 UPDATE하면 updated_at은 변경되지 않아야 한다.$$
);

-- updated_at만 직접 변경 경계: updated_at만 과거/미래 값으로 바꾸려는 UPDATE는 최종적으로 기존 updated_at이 유지되어야 한다.
SELECT set_config('test.profiles_trigger_upd_direct_before', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.profiles_trigger_upd_direct_id')::uuid), true);
UPDATE public.profiles SET updated_at = '2000-01-01 00:00:00+00'::timestamptz WHERE id = current_setting('test.profiles_trigger_upd_direct_id')::uuid;
UPDATE public.profiles SET updated_at = '2099-01-01 00:00:00+00'::timestamptz WHERE id = current_setting('test.profiles_trigger_upd_direct_id')::uuid;
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_direct_id')::uuid
  ),
  current_setting('test.profiles_trigger_upd_direct_before')::timestamptz,
  $$updated_at만 직접 변경 경계: updated_at만 과거/미래 값으로 바꾸려는 UPDATE는 최종적으로 기존 updated_at이 유지되어야 한다.$$
);

-- [불변 조건]
-- 실제 변경이 발생한 UPDATE 후에는 항상 new.updated_at > old.updated_at이어야 한다.
SELECT ok(
  (
    SELECT updated_at > current_setting('test.profiles_trigger_upd_role_before')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_role_id')::uuid
  ),
  $$실제 변경이 발생한 UPDATE 후에는 항상 new.updated_at > old.updated_at이어야 한다.$$
);

-- 동일값 UPDATE 후에는 항상 new.updated_at = old.updated_at이어야 한다.
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_same_id')::uuid
  ),
  current_setting('test.profiles_trigger_upd_same_before')::timestamptz,
  $$동일값 UPDATE 후에는 항상 new.updated_at = old.updated_at이어야 한다.$$
);

-- updated_at은 항상 NULL이 아니어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE updated_at IS NULL
  ),
  0::bigint,
  $$updated_at은 항상 NULL이 아니어야 한다.$$
);

-- updated_at은 항상 created_at보다 작아지면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE updated_at < created_at
  ),
  0::bigint,
  $$updated_at은 항상 created_at보다 작아지면 안 된다.$$
);

-- 특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼은 이전 값과 같아야 한다.
SELECT ok(
  (
    SELECT id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid
       AND avatar_url IS NULL
       AND role = 'USER'
       AND created_at = '2024-01-01 00:00:00+00'::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_trigger_upd_nickname_id')::uuid
  ),
  $$특정 컬럼만 변경한 UPDATE 후 수정 대상 외의 컬럼은 이전 값과 같아야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
