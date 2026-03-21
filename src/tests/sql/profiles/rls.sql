-- =========================================
-- profiles / RLS
-- =========================================

BEGIN;

SELECT plan(13);

-- 테스트용 UUID 준비
SELECT set_config('test.u1_id', gen_random_uuid()::text, true);
SELECT set_config('test.u2_id', gen_random_uuid()::text, true);
SELECT set_config('test.u3_id', gen_random_uuid()::text, true);

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
    current_setting('test.u1_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'u1_' || current_setting('test.u1_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.u2_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'u2_' || current_setting('test.u2_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.u3_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'u3_' || current_setting('test.u3_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: profiles (handle_new_user 트리거 미동작 환경 대비 직접 INSERT)
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.u1_id')::uuid, 'nick1', 'USER'),
  (current_setting('test.u2_id')::uuid, 'nick2', 'USER')
ON CONFLICT (id) DO NOTHING;

-- u3는 profile 없는 사용자 시나리오를 위해 제거
DELETE FROM public.profiles
WHERE id = current_setting('test.u3_id')::uuid;

-- [정답 조건]
-- 인증된 사용자는 자신의 profile을 조회할 수 있어야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u1_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  1::bigint,
  '인증된 사용자는 자신의 profile을 조회할 수 있어야 한다'
);

-- 인증된 사용자는 자신의 profile을 수정할 수 있어야 한다
WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'neo2'
  WHERE id = current_setting('test.u1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  '인증된 사용자는 자신의 profile을 수정할 수 있어야 한다'
);

-- [예외 조건]
-- 인증된 사용자는 다른 사용자의 profile을 조회할 수 없어야 한다
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2_id')::uuid),
  0::bigint,
  '인증된 사용자는 다른 사용자의 profile을 조회할 수 없어야 한다'
);

-- 인증된 사용자는 다른 사용자의 profile을 수정할 수 없어야 한다
WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'x'
  WHERE id = current_setting('test.u2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  '인증된 사용자는 다른 사용자의 profile을 수정할 수 없어야 한다'
);

-- 비인증 사용자는 profile에 접근할 수 없어야 한다
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  0::bigint,
  '비인증 사용자는 profile에 접근할 수 없어야 한다'
);

-- auth.uid()가 NULL인 경우 profile 접근이 허용되면 안 된다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  0::bigint,
  'auth.uid()가 NULL인 경우 profile 접근이 허용되면 안 된다'
);

-- 인증된 사용자도 profiles를 직접 INSERT할 수 없어야 한다
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u3_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname)
      VALUES ('%s'::uuid, 'direct');
    $sql$,
    current_setting('test.u3_id')
  ),
  '42501',
  'new row violates row-level security policy for table "profiles"',
  '인증된 사용자도 profiles를 직접 INSERT할 수 없어야 한다'
);

-- [경계 조건]
-- 본인 ID와 정확히 일치하는 경우만 조회가 허용되어야 한다
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u1_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  1::bigint,
  '본인 ID와 정확히 일치하는 경우만 조회가 허용되어야 한다'
);

-- 다른 UUID는 조회가 허용되면 안 된다
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2_id')::uuid),
  0::bigint,
  '다른 UUID는 조회가 허용되면 안 된다'
);

-- 자신의 profile이 없는 사용자는 어떤 타인 profile도 조회할 수 없어야 한다
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u3_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  0::bigint,
  '자신의 profile이 없는 사용자는 어떤 타인 profile도 조회할 수 없어야 한다'
);

-- [불변 조건]
-- 인증된 사용자의 전체 조회 결과에는 본인 profile이 정확히 1개 존재해야 한다
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u1_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  1::bigint,
  '인증된 사용자의 전체 조회 결과에는 본인 profile이 정확히 1개 존재해야 한다'
);

-- 조건 없는 전체 조회에서도 타인 profile은 반환되면 안 된다
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id <> current_setting('test.u1_id')::uuid),
  0::bigint,
  '조건 없는 전체 조회에서도 타인 profile은 반환되면 안 된다'
);

-- 비인증 사용자는 직접 INSERT를 통해 profiles에 접근할 수 없어야 한다
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname)
      VALUES ('%s'::uuid, 'direct');
    $sql$,
    current_setting('test.u3_id')
  ),
  '42501',
  'new row violates row-level security policy for table "profiles"',
  '비인증 사용자는 직접 INSERT를 통해 profiles에 접근할 수 없어야 한다'
);

SELECT * FROM finish();
ROLLBACK;
