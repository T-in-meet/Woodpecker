-- =========================================
-- profiles / RLS
-- =========================================

BEGIN;

SELECT plan(29);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_rls_user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_rls_user_d_id', gen_random_uuid()::text, true);

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
    current_setting('test.profiles_rls_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_rls_user_a_' || current_setting('test.profiles_rls_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_rls_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_rls_user_b_' || current_setting('test.profiles_rls_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_rls_user_c_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_rls_user_c_' || current_setting('test.profiles_rls_user_c_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.profiles_rls_user_d_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'profiles_rls_user_d_' || current_setting('test.profiles_rls_user_d_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed 정리: auth.users INSERT 트리거로 미리 생성된 profiles 행 정리
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_rls_user_a_id')::uuid,
  current_setting('test.profiles_rls_user_b_id')::uuid,
  current_setting('test.profiles_rls_user_c_id')::uuid,
  current_setting('test.profiles_rls_user_d_id')::uuid
);

-- seed: profiles 분포 준비
INSERT INTO public.profiles (id, nickname, avatar_url, role)
VALUES
  (current_setting('test.profiles_rls_user_a_id')::uuid, 'user_a_1', 'https://example.com/a.png', 'USER'),
  (current_setting('test.profiles_rls_user_b_id')::uuid, 'user_b_1', 'https://example.com/b.png', 'USER'),
  (current_setting('test.profiles_rls_user_c_id')::uuid, 'user_c_1', 'https://example.com/c.png', 'USER')
ON CONFLICT (id) DO NOTHING;

-- user_d는 profile 없는 사용자 시나리오 유지
DELETE FROM public.profiles
WHERE id = current_setting('test.profiles_rls_user_d_id')::uuid;

RESET ROLE;

-- [정답 조건]
-- user_a로 인증 후 SELECT하면 id = user_a.id인 프로필만 조회되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid),
  1::bigint,
  $$user_a로 인증 후 SELECT하면 id = user_a.id인 프로필만 조회되어야 한다.$$
);

-- user_b로 인증 후 SELECT하면 id = user_b.id인 프로필만 조회되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid),
  1::bigint,
  $$user_b로 인증 후 SELECT하면 id = user_b.id인 프로필만 조회되어야 한다.$$
);

-- 본인 프로필이 존재하는 사용자는 자신의 프로필 1건을 조회할 수 있어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  1::bigint,
  $$본인 프로필이 존재하는 사용자는 자신의 프로필 1건을 조회할 수 있어야 한다.$$
);

-- [예외 조건]
-- 인증 사용자가 타인 프로필을 조회할 수 있으면 안 된다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles WHERE id <> current_setting('test.profiles_rls_user_a_id')::uuid),
  0::bigint,
  $$인증 사용자가 타인 프로필을 조회할 수 있으면 안 된다.$$
);

-- user_a로 인증했을 때 user_b.id, user_c.id의 프로필이 결과에 포함되면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_rls_user_b_id')::uuid,
      current_setting('test.profiles_rls_user_c_id')::uuid
    )
  ),
  0::bigint,
  $$user_a로 인증했을 때 user_b.id, user_c.id의 프로필이 결과에 포함되면 안 된다.$$
);

-- 본인 프로필이 없는 사용자가 타인 프로필을 대신 조회할 수 있으면 안 된다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_d_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  0::bigint,
  $$본인 프로필이 없는 사용자가 타인 프로필을 대신 조회할 수 있으면 안 된다.$$
);

-- [경계 조건]
-- 0건 경계: user_d로 인증하고 타인 프로필만 존재하는 상태에서 SELECT하면 조회 가능 행 수는 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_d_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  0::bigint,
  $$0건 경계: user_d로 인증하고 타인 프로필만 존재하는 상태에서 SELECT하면 조회 가능 행 수는 0건이어야 한다.$$
);

-- 1건 경계: user_a로 인증하고 본인 프로필 1건 + 타인 프로필 여러 건이 존재하는 상태에서 SELECT하면 조회 가능 행 수는 정확히 1건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  1::bigint,
  $$1건 경계: user_a로 인증하고 본인 프로필 1건 + 타인 프로필 여러 건이 존재하는 상태에서 SELECT하면 조회 가능 행 수는 정확히 1건이어야 한다.$$
);

-- 여러 건 분포 경계: 전체 테이블에 여러 사용자의 프로필이 섞여 있어도 user_b는 자신의 프로필 1건만 조회할 수 있어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  1::bigint,
  $$여러 건 분포 경계: 전체 테이블에 여러 사용자의 프로필이 섞여 있어도 user_b는 자신의 프로필 1건만 조회할 수 있어야 한다.$$
);

-- 대조군 경계: 본인 데이터가 1건 존재하는 상태에서 타인 데이터가 0건이 아니라 여러 건 있어도 결과에는 본인 데이터만 남아야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles) = 1::bigint
    AND (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid) = 1::bigint
  ),
  $$대조군 경계: 본인 데이터가 1건 존재하는 상태에서 타인 데이터가 0건이 아니라 여러 건 있어도 결과에는 본인 데이터만 남아야 한다.$$
);

-- [불변 조건]
-- 본인 프로필이 존재하는 사용자의 SELECT 결과에는 항상 자신의 프로필이 포함되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid
  ),
  $$본인 프로필이 존재하는 사용자의 SELECT 결과에는 항상 자신의 프로필이 포함되어야 한다.$$
);

-- 본인 프로필이 존재하는 사용자의 SELECT 결과에는 타인 프로필이 0건이어야 한다.
SELECT is(
  (SELECT count(*)::bigint FROM public.profiles WHERE id <> current_setting('test.profiles_rls_user_a_id')::uuid),
  0::bigint,
  $$본인 프로필이 존재하는 사용자의 SELECT 결과에는 타인 프로필이 0건이어야 한다.$$
);

-- 본인 프로필이 없는 사용자의 SELECT 결과는 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_d_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles),
  0::bigint,
  $$본인 프로필이 없는 사용자의 SELECT 결과는 0건이어야 한다.$$
);

-- 데이터 분포가 변해도 SELECT 결과의 소유권 기준은 항상 auth.uid() = profiles.id여야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  (
    (SELECT count(*)::bigint FROM public.profiles WHERE id = current_setting('test.profiles_rls_user_c_id')::uuid) = 1::bigint
    AND (SELECT count(*)::bigint FROM public.profiles WHERE id <> current_setting('test.profiles_rls_user_c_id')::uuid) = 0::bigint
  ),
  $$데이터 분포가 변해도 SELECT 결과의 소유권 기준은 항상 auth.uid() = profiles.id여야 한다.$$
);

-- [정답 조건]
-- user_a로 인증 후 id = user_a.id인 프로필의 nickname 또는 avatar_url 수정은 가능해야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'user_a_ok'
  WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  1::bigint,
  $$user_a로 인증 후 id = user_a.id인 프로필의 nickname 또는 avatar_url 수정은 가능해야 한다.$$
);

-- user_b로 인증 후 id = user_b.id인 프로필의 수정은 가능해야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET avatar_url = 'https://example.com/b-updated.png'
  WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  1::bigint,
  $$user_b로 인증 후 id = user_b.id인 프로필의 수정은 가능해야 한다.$$
);

-- 본인 프로필 수정 후 수정 대상 컬럼 값은 변경되어야 한다.
RESET ROLE;
SELECT set_config(
  'test.profiles_rls_user_c_before_nickname',
  (
    SELECT nickname
    FROM public.profiles
    WHERE id = current_setting('test.profiles_rls_user_c_id')::uuid
  ),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

UPDATE public.profiles
SET nickname = 'user_c_ok'
WHERE id = current_setting('test.profiles_rls_user_c_id')::uuid;

SELECT ok(
  (
    SELECT nickname <> current_setting('test.profiles_rls_user_c_before_nickname')
    FROM public.profiles
    WHERE id = current_setting('test.profiles_rls_user_c_id')::uuid
  ),
  $$본인 프로필 수정 후 수정 대상 컬럼 값은 변경되어야 한다.$$
);

-- [예외 조건]
-- 인증 사용자가 타인 프로필을 수정할 수 있으면 안 된다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'blocked_other_1'
  WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  0::bigint,
  $$인증 사용자가 타인 프로필을 수정할 수 있으면 안 된다.$$
);

-- user_a로 인증했을 때 id = user_b.id인 프로필을 수정할 수 있으면 안 된다.
WITH updated AS (
  UPDATE public.profiles
  SET avatar_url = 'https://example.com/blocked.png'
  WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  0::bigint,
  $$user_a로 인증했을 때 id = user_b.id인 프로필을 수정할 수 있으면 안 된다.$$
);

-- UPDATE를 통해 행의 소유권을 타인으로 바꾸는 상태가 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET id = '%s'::uuid
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_rls_user_b_id'),
    current_setting('test.profiles_rls_user_a_id')
  ),
  '42501',
  NULL,
  $$UPDATE를 통해 행의 소유권을 타인으로 바꾸는 상태가 허용되면 안 된다.$$
);

-- [경계 조건]
-- 0건 경계: user_d로 인증하고 본인 프로필이 없는 상태에서 UPDATE를 시도하면 수정 가능한 행 수는 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_d_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'user_d_none'
  WHERE id = current_setting('test.profiles_rls_user_d_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  0::bigint,
  $$0건 경계: user_d로 인증하고 본인 프로필이 없는 상태에서 UPDATE를 시도하면 수정 가능한 행 수는 0건이어야 한다.$$
);

-- 1건 경계: user_a로 인증하고 본인 프로필 1건 + 타인 프로필 여러 건이 존재하는 상태에서 본인 조건으로 UPDATE하면 수정 가능한 행 수는 정확히 1건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET avatar_url = 'https://example.com/a-boundary.png'
  WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  1::bigint,
  $$1건 경계: user_a로 인증하고 본인 프로필 1건 + 타인 프로필 여러 건이 존재하는 상태에서 본인 조건으로 UPDATE하면 수정 가능한 행 수는 정확히 1건이어야 한다.$$
);

-- 여러 건 분포 경계: 전체 테이블에 여러 사용자의 프로필이 존재해도 user_b는 자신의 프로필 1건만 수정할 수 있어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'ub_only1'
  WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  1::bigint,
  $$여러 건 분포 경계: 전체 테이블에 여러 사용자의 프로필이 존재해도 user_b는 자신의 프로필 1건만 수정할 수 있어야 한다.$$
);

-- 소유권 차단 경계: user_a가 user_b 프로필의 nickname 변경을 시도하면 수정 대상이 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.profiles
  SET nickname = 'blk_oth2'
  WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*)::bigint FROM updated),
  0::bigint,
  $$소유권 차단 경계: user_a가 user_b 프로필의 nickname 변경을 시도하면 수정 대상이 0건이어야 한다.$$
);

-- WITH CHECK 경계: user_a가 자신의 프로필을 UPDATE하면서 결과 행의 id를 user_b.id로 바꾸려는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET id = '%s'::uuid
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_rls_user_b_id'),
    current_setting('test.profiles_rls_user_a_id')
  ),
  '42501',
  NULL,
  $$WITH CHECK 경계: user_a가 자신의 프로필을 UPDATE하면서 결과 행의 id를 user_b.id로 바꾸려는 시도는 허용되면 안 된다.$$
);

-- [불변 조건]
-- 본인 프로필 수정 성공 후에도 해당 행의 소유자는 여전히 본인이어야 한다.
RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid
      AND avatar_url = 'https://example.com/a-boundary.png'
  ),
  $$본인 프로필 수정 성공 후에도 해당 행의 소유자는 여전히 본인이어야 한다.$$
);

-- 본인 프로필 수정 성공 후에도 수정 대상 외의 행은 변경되면 안 된다.
RESET ROLE;
SELECT set_config(
  'test.profiles_rls_user_b_before_snapshot',
  (
    SELECT row_to_json(t)::text
    FROM (
      SELECT nickname, avatar_url, role
      FROM public.profiles
      WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
    ) t
  ),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

UPDATE public.profiles
SET nickname = 'ua_final1'
WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid;

RESET ROLE;
SELECT set_config(
  'test.profiles_rls_user_b_after_snapshot',
  (
    SELECT row_to_json(t)::text
    FROM (
      SELECT nickname, avatar_url, role
      FROM public.profiles
      WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
    ) t
  ),
  true
);

SELECT ok(
  current_setting('test.profiles_rls_user_b_before_snapshot') = current_setting('test.profiles_rls_user_b_after_snapshot'),
  $$본인 프로필 수정 성공 후에도 수정 대상 외의 행은 변경되면 안 된다.$$
);

-- 본인 프로필 수정 성공 후에도 타인 프로필은 0건 수정되어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.profiles_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*)::bigint FROM public.profiles WHERE id <> current_setting('test.profiles_rls_user_a_id')::uuid AND nickname = 'ua_final1'),
  0::bigint,
  $$본인 프로필 수정 성공 후에도 타인 프로필은 0건 수정되어야 한다.$$
);

-- UPDATE 결과의 허용 기준은 항상 수정 전 접근(USING)과 수정 후 상태(WITH CHECK) 모두에서 auth.uid() = profiles.id여야 한다.
RESET ROLE;
SELECT ok(
  (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = current_setting('test.profiles_rls_user_a_id')::uuid
        AND nickname = 'ua_final1'
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
        AND nickname = 'ub_only1'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = current_setting('test.profiles_rls_user_b_id')::uuid
        AND nickname = 'blk_oth2'
    )
  ),
  $$UPDATE 결과의 허용 기준은 항상 수정 전 접근(USING)과 수정 후 상태(WITH CHECK) 모두에서 auth.uid() = profiles.id여야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
