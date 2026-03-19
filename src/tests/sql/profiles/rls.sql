-- =========================================
-- profiles / RLS
-- =========================================

BEGIN;

SELECT plan(12);

-- 테스트용 UUID 준비
SELECT set_config('test.u1_id', gen_random_uuid()::text, true);
SELECT set_config('test.u2_id', gen_random_uuid()::text, true);
SELECT set_config('test.u3_id', gen_random_uuid()::text, true);

-- seed 단계에서는 role 전환 없이 사용자 생성
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
  );

-- u3는 profile 없는 사용자 시나리오를 위해 제거
DELETE FROM public.profiles
WHERE id = current_setting('test.u3_id')::uuid;

-- [정답 조건]
-- 인증된 사용자는 자신의 profile을 조회할 수 있어야 한다.
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
  '본인 profile 조회 가능'
);

-- 인증된 사용자는 자신의 profile을 수정할 수 있어야 한다.
WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'neo2'
  WHERE id = current_setting('test.u1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  '본인 profile 수정 가능'
);

-- [예외 조건]
-- 인증된 사용자는 다른 사용자의 profile을 조회할 수 없어야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2_id')::uuid),
  0::bigint,
  '타인 profile 조회 불가'
);

-- 인증된 사용자는 다른 사용자의 profile을 수정할 수 없어야 한다.
WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'x'
  WHERE id = current_setting('test.u2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  '타인 profile 수정 불가'
);

-- 비인증 사용자는 profile에 접근할 수 없어야 한다.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  0::bigint,
  '비인증 사용자는 profile 접근 불가'
);

-- auth.uid()가 NULL인 경우 profile 접근이 허용되면 안 된다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u1_id')::uuid),
  0::bigint,
  'auth.uid() NULL이면 profile 접근 불가'
);

-- 사용자는 profiles를 직접 INSERT할 수 없어야 한다.
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
  '직접 INSERT 불가'
);

-- [경계 조건]
-- 본인 ID와 정확히 일치하는 경우만 허용되어야 한다.
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
  '본인 ID 정확히 일치하면 허용'
);

-- 본인처럼 보이지만 다른 UUID인 경우 허용되면 안 된다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2_id')::uuid),
  0::bigint,
  '다른 UUID는 허용되지 않음'
);

-- 인증된 사용자라도 자신의 profile이 없는 경우 다른 profile이 조회되면 안 된다.
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
  '본인 profile 없음 -> 타인 profile 조회 불가'
);

-- [불변 조건]
-- 어떤 상황에서도 사용자는 자기 profile만 접근 가능해야 한다.
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.u1_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles),
  1::bigint,
  '항상 자기 profile만 접근 가능'
);

-- profiles 생성은 허용된 시스템 경로로만 이루어져야 한다.
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
  '비인증 사용자 직접 INSERT 불가'
);

SELECT * FROM finish();
ROLLBACK;