-- =========================================
-- profiles / FK
-- =========================================

BEGIN;

SELECT plan(24);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_fk_ref_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_fk_ref_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_fk_cascade_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_fk_cascade_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_fk_cascade_user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_fk_ghost_user_id', gen_random_uuid()::text, true);

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
    current_setting('test.profiles_fk_ref_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_fk_ref_user_a_' || current_setting('test.profiles_fk_ref_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_fk_ref_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_fk_ref_user_b_' || current_setting('test.profiles_fk_ref_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_fk_cascade_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_fk_cascade_user_a_' || current_setting('test.profiles_fk_cascade_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_fk_cascade_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_fk_cascade_user_b_' || current_setting('test.profiles_fk_cascade_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_fk_cascade_user_c_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_fk_cascade_user_c_' || current_setting('test.profiles_fk_cascade_user_c_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed 정리: auth.users INSERT 트리거로 미리 생성된 profiles 행 제거
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_fk_ref_user_a_id')::uuid,
  current_setting('test.profiles_fk_ref_user_b_id')::uuid,
  current_setting('test.profiles_fk_cascade_user_a_id')::uuid,
  current_setting('test.profiles_fk_cascade_user_b_id')::uuid,
  current_setting('test.profiles_fk_cascade_user_c_id')::uuid,
  current_setting('test.profiles_fk_ghost_user_id')::uuid
);

-- seed: cascade 검증용 profiles 분포
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.profiles_fk_cascade_user_a_id')::uuid, 'fkca001', 'USER'),
  (current_setting('test.profiles_fk_cascade_user_b_id')::uuid, 'fkcb001', 'USER')
ON CONFLICT (id) DO NOTHING;

-- cascade 0건 경계를 위해 user_c는 profiles 없음 유지
DELETE FROM public.profiles
WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid;

-- [정답 조건]
-- id = user_a.id로 profiles INSERT가 가능해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'fkra001', 'USER')
    $sql$,
    current_setting('test.profiles_fk_ref_user_a_id')
  ),
  $$id = user_a.id로 profiles INSERT가 가능해야 한다.$$
);

-- id = user_b.id로 profiles INSERT가 가능해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'fkrb001', 'USER')
    $sql$,
    current_setting('test.profiles_fk_ref_user_b_id')
  ),
  $$id = user_b.id로 profiles INSERT가 가능해야 한다.$$
);

-- 이미 존재하는 profiles 행의 id는 항상 실제 auth.users.id와 연결되어 있어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id IN (
      current_setting('test.profiles_fk_ref_user_a_id')::uuid,
      current_setting('test.profiles_fk_ref_user_b_id')::uuid,
      current_setting('test.profiles_fk_cascade_user_a_id')::uuid,
      current_setting('test.profiles_fk_cascade_user_b_id')::uuid
    )
  ),
  4::bigint,
  $$이미 존재하는 profiles 행의 id는 항상 실제 auth.users.id와 연결되어 있어야 한다.$$
);

-- [예외 조건]
-- auth.users에 존재하지 않는 id로는 profiles 행이 생성되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'fkgh001', 'USER')
    $sql$,
    current_setting('test.profiles_fk_ghost_user_id')
  ),
  '23503',
  NULL,
  $$auth.users에 존재하지 않는 id로는 profiles 행이 생성되면 안 된다.$$
);

-- 부모 행이 없는 상태의 고아 프로필(orphan profile)이 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL
  ),
  0::bigint,
  $$부모 행이 없는 상태의 고아 프로필(orphan profile)이 존재하면 안 된다.$$
);

-- [경계 조건]
-- 존재하는 부모 키 경계: id = user_a.id는 참조 성공이어야 한다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_ref_user_a_id')::uuid
  ),
  $$존재하는 부모 키 경계: id = user_a.id는 참조 성공이어야 한다.$$
);

-- 존재하지 않는 부모 키 경계: id = ghost_user_id는 참조 실패여야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET id = '%s'::uuid
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_fk_ghost_user_id'),
    current_setting('test.profiles_fk_ref_user_a_id')
  ),
  '23503',
  NULL,
  $$존재하지 않는 부모 키 경계: id = ghost_user_id는 참조 실패여야 한다.$$
);

-- 다건 분포 경계: 여러 auth.users와 여러 profiles가 섞여 있어도 각 profiles.id는 항상 대응하는 auth.users.id를 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$다건 분포 경계: 여러 auth.users와 여러 profiles가 섞여 있어도 각 profiles.id는 항상 대응하는 auth.users.id를 가져야 한다.$$
);

-- 0건 분포 경계: profiles에 행이 0건이어도 FK 정책 자체는 깨지지 않아야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid
  ),
  0::bigint,
  $$0건 분포 경계: profiles에 행이 0건이어도 FK 정책 자체는 깨지지 않아야 한다.$$
);

-- [불변 조건]
-- public.profiles에는 부모가 없는 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL
  ),
  0::bigint,
  $$public.profiles에는 부모가 없는 행이 존재해서는 안 된다.$$
);

-- 모든 public.profiles.id는 항상 실제 auth.users.id에 매핑되어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    WHERE EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = p.id
    )
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 public.profiles.id는 항상 실제 auth.users.id에 매핑되어야 한다.$$
);

-- 참조 무결성 기준은 데이터 분포와 무관하게 항상 유지되어야 한다.
SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL) = 0::bigint
    AND (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid) = 0::bigint
  ),
  $$참조 무결성 기준은 데이터 분포와 무관하게 항상 유지되어야 한다.$$
);

-- [정답 조건]
-- user_a의 auth.users 행 삭제 시 id = user_a.id인 profiles 행도 함께 삭제되어야 한다.
RESET ROLE;
SELECT set_config(
  'test.profiles_fk_cascade_user_a_before_exists',
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid
  )::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid;

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid
  ),
  0::bigint,
  $$user_a의 auth.users 행 삭제 시 id = user_a.id인 profiles 행도 함께 삭제되어야 한다.$$
);

-- user_b의 auth.users 행이 유지되는 동안 id = user_b.id인 profiles 행은 유지되어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_b_id')::uuid
  ),
  1::bigint,
  $$user_b의 auth.users 행이 유지되는 동안 id = user_b.id인 profiles 행은 유지되어야 한다.$$
);

-- 부모 삭제 후 종속 행이 자동 정리되어야 하며 고아 프로필이 남으면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL
  ),
  0::bigint,
  $$부모 삭제 후 종속 행이 자동 정리되어야 하며 고아 프로필이 남으면 안 된다.$$
);

-- [예외 조건]
-- 부모 삭제 후에도 연결된 profiles 행이 남아 있으면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid
  ),
  0::bigint,
  $$부모 삭제 후에도 연결된 profiles 행이 남아 있으면 안 된다.$$
);

-- 한 사용자의 부모 삭제가 다른 사용자의 profiles 행까지 삭제하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_b_id')::uuid
  ),
  1::bigint,
  $$한 사용자의 부모 삭제가 다른 사용자의 profiles 행까지 삭제하면 안 된다.$$
);

-- [경계 조건]
-- 단건 경계: user_a 1명과 연결된 profiles 1건이 있을 때 부모 삭제 후 종속 행 수는 0건이어야 한다.
SELECT is(
  current_setting('test.profiles_fk_cascade_user_a_before_exists')::bigint,
  1::bigint,
  $$단건 경계: user_a 1명과 연결된 profiles 1건이 있을 때 부모 삭제 후 종속 행 수는 0건이어야 한다.$$
);

-- 대조군 경계: user_a 삭제 후 user_b의 profiles는 그대로 1건 유지되어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_b_id')::uuid
  ),
  1::bigint,
  $$대조군 경계: user_a 삭제 후 user_b의 profiles는 그대로 1건 유지되어야 한다.$$
);

-- 0건 경계: 특정 auth.users에 연결된 profiles가 이미 0건인 상태에서 부모 삭제가 일어나도 시스템 정합성은 유지되어야 한다.
DELETE FROM auth.users
WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid;

SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid) = 0::bigint
    AND (SELECT count(*)::bigint FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL) = 0::bigint
  ),
  $$0건 경계: 특정 auth.users에 연결된 profiles가 이미 0건인 상태에서 부모 삭제가 일어나도 시스템 정합성은 유지되어야 한다.$$
);

-- 다건 분포 경계: 여러 사용자/프로필이 섞여 있어도 삭제 전파는 삭제된 부모에 연결된 종속 행에만 한정되어야 한다.
SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid) = 0::bigint
    AND (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_b_id')::uuid) = 1::bigint
  ),
  $$다건 분포 경계: 여러 사용자/프로필이 섞여 있어도 삭제 전파는 삭제된 부모에 연결된 종속 행에만 한정되어야 한다.$$
);

-- [불변 조건]
-- 삭제된 auth.users.id를 참조하는 profiles 행은 남아 있어서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id = current_setting('test.profiles_fk_cascade_user_a_id')::uuid
  ),
  0::bigint,
  $$삭제된 auth.users.id를 참조하는 profiles 행은 남아 있어서는 안 된다.$$
);

-- 삭제 전파 범위는 항상 동일 부모에 연결된 종속 행으로만 제한되어야 한다.
SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_b_id')::uuid) = 1::bigint
    AND (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_fk_cascade_user_c_id')::uuid) = 0::bigint
  ),
  $$삭제 전파 범위는 항상 동일 부모에 연결된 종속 행으로만 제한되어야 한다.$$
);

-- 부모 삭제 이후에도 남은 profiles 행들은 모두 여전히 유효한 auth.users.id를 참조해야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL
  ),
  0::bigint,
  $$부모 삭제 이후에도 남은 profiles 행들은 모두 여전히 유효한 auth.users.id를 참조해야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
