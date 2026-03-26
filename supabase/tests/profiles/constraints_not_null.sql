-- =========================================
-- profiles / NOT NULL
-- =========================================

BEGIN;

SELECT plan(44);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_constraints_not_null_id_insert_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_id_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_nickname_insert_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_nickname_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_role_insert_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_role_insert_admin_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_role_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_created_insert_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_created_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_updated_insert_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_updated_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_nickname_insert_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_role_insert_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_created_insert_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_not_null_updated_insert_null_id', gen_random_uuid()::text, true);

SELECT set_config('test.profiles_constraints_not_null_created_valid_value', '2024-01-01 00:00:00+00'::timestamptz::text, true);
SELECT set_config('test.profiles_constraints_not_null_updated_valid_value', '2024-02-01 00:00:00+00'::timestamptz::text, true);

-- seed: auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.profiles_constraints_not_null_id_insert_valid_id')::uuid, 'profiles_constraints_not_null_id_insert_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_id_update_valid_id')::uuid, 'profiles_constraints_not_null_id_update_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_nickname_insert_valid_id')::uuid, 'profiles_constraints_not_null_nickname_insert_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_nickname_update_valid_id')::uuid, 'profiles_constraints_not_null_nickname_update_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_role_insert_user_id')::uuid, 'profiles_constraints_not_null_role_insert_user@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_role_insert_admin_id')::uuid, 'profiles_constraints_not_null_role_insert_admin@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_role_update_valid_id')::uuid, 'profiles_constraints_not_null_role_update_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_created_insert_valid_id')::uuid, 'profiles_constraints_not_null_created_insert_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_created_update_valid_id')::uuid, 'profiles_constraints_not_null_created_update_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_updated_insert_valid_id')::uuid, 'profiles_constraints_not_null_updated_insert_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_updated_update_valid_id')::uuid, 'profiles_constraints_not_null_updated_update_valid@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_nickname_insert_null_id')::uuid, 'profiles_constraints_not_null_nickname_insert_null@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_role_insert_null_id')::uuid, 'profiles_constraints_not_null_role_insert_null@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_created_insert_null_id')::uuid, 'profiles_constraints_not_null_created_insert_null@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_not_null_updated_insert_null_id')::uuid, 'profiles_constraints_not_null_updated_insert_null@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed 정리: auth.users INSERT 트리거로 미리 생성된 profiles 행 제거
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_constraints_not_null_id_insert_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_id_update_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_nickname_insert_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_nickname_update_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_role_insert_user_id')::uuid,
  current_setting('test.profiles_constraints_not_null_role_insert_admin_id')::uuid,
  current_setting('test.profiles_constraints_not_null_role_update_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_created_insert_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_created_update_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_updated_insert_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_updated_update_valid_id')::uuid,
  current_setting('test.profiles_constraints_not_null_nickname_insert_null_id')::uuid,
  current_setting('test.profiles_constraints_not_null_role_insert_null_id')::uuid,
  current_setting('test.profiles_constraints_not_null_created_insert_null_id')::uuid,
  current_setting('test.profiles_constraints_not_null_updated_insert_null_id')::uuid
);

-- seed: UPDATE 검증용 profiles
INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
VALUES
  (current_setting('test.profiles_constraints_not_null_id_update_valid_id')::uuid, 'idupd1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_constraints_not_null_nickname_update_valid_id')::uuid, 'nnupd1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_constraints_not_null_role_update_valid_id')::uuid, 'rlupd1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_constraints_not_null_created_update_valid_id')::uuid, 'ctupd1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz),
  (current_setting('test.profiles_constraints_not_null_updated_update_valid_id')::uuid, 'utupd1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 유효한 auth.users.id를 가진 profiles INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'idins1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_id_insert_valid_id')
  ),
  $$유효한 auth.users.id를 가진 profiles INSERT는 성공해야 한다.$$
);

-- 기존 행에서 id가 NULL이 아닌 상태는 유지되어야 한다.
SELECT ok(
  (
    SELECT id IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_id_update_valid_id')::uuid
  ),
  $$기존 행에서 id가 NULL이 아닌 상태는 유지되어야 한다.$$
);

-- [예외 조건]
-- id가 없는 profiles 행은 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IS NULL
  ),
  0::bigint,
  $$id가 없는 profiles 행은 존재하면 안 된다.$$
);

-- [경계 조건]
-- id = user_a.id로 INSERT하면 성공해야 한다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_id_insert_valid_id')::uuid
  ),
  $$id = user_a.id로 INSERT하면 성공해야 한다.$$
);

-- id = NULL로 INSERT하면 실패해야 한다.
SELECT throws_ok(
  $$
    INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
    VALUES (NULL, 'idnull', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
  $$,
  '23502',
  NULL,
  $$id = NULL로 INSERT하면 실패해야 한다.$$
);

-- 기존 유효한 행의 id를 NULL로 UPDATE하려고 하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET id = NULL
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_not_null_id_update_valid_id')
  ),
  '23502',
  NULL,
  $$기존 유효한 행의 id를 NULL로 UPDATE하려고 하면 실패해야 한다.$$
);

-- [불변 조건]
-- profiles 테이블에는 id IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IS NULL
  ),
  0::bigint,
  $$profiles 테이블에는 id IS NULL인 행이 존재해서는 안 된다.$$
);

-- 모든 profiles 행은 식별 가능한 단일 id를 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IS NOT NULL
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 profiles 행은 식별 가능한 단일 id를 가져야 한다.$$
);

-- [정답 조건]
-- NULL이 아닌 nickname으로 INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'a', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_nickname_insert_valid_id')
  ),
  $$NULL이 아닌 nickname으로 INSERT는 성공해야 한다.$$
);

-- 기존 행에서 nickname이 NULL이 아닌 상태는 유지되어야 한다.
SELECT ok(
  (
    SELECT nickname IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_nickname_update_valid_id')::uuid
  ),
  $$기존 행에서 nickname이 NULL이 아닌 상태는 유지되어야 한다.$$
);

-- [예외 조건]
-- nickname이 없는 profiles 행은 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE nickname IS NULL
  ),
  0::bigint,
  $$nickname이 없는 profiles 행은 존재하면 안 된다.$$
);

-- [경계 조건]
-- nickname = 'a'로 INSERT하면 성공해야 한다.
SELECT is(
  (
    SELECT nickname
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_nickname_insert_valid_id')::uuid
  ),
  'a',
  $$nickname = 'a'로 INSERT하면 성공해야 한다.$$
);

-- nickname = ''는 이 파일의 검증 대상이 아니며, 빈 문자열 허용 여부는 constraints_check에서 검증한다.
SELECT ok(
  true,
  $$nickname = ''는 이 파일의 검증 대상이 아니며, 빈 문자열 허용 여부는 constraints_check에서 검증한다.$$
);

-- nickname = NULL로 INSERT하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, NULL, 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_nickname_insert_null_id')
  ),
  '23502',
  NULL,
  $$nickname = NULL로 INSERT하면 실패해야 한다.$$
);

-- 기존 유효한 행의 nickname을 NULL로 UPDATE하려고 하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET nickname = NULL
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_not_null_nickname_update_valid_id')
  ),
  '23502',
  NULL,
  $$기존 유효한 행의 nickname을 NULL로 UPDATE하려고 하면 실패해야 한다.$$
);

-- [불변 조건]
-- profiles 테이블에는 nickname IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE nickname IS NULL
  ),
  0::bigint,
  $$profiles 테이블에는 nickname IS NULL인 행이 존재해서는 안 된다.$$
);

-- 모든 profiles 행은 NULL이 아닌 nickname을 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE nickname IS NOT NULL
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 profiles 행은 NULL이 아닌 nickname을 가져야 한다.$$
);

-- [정답 조건]
-- NULL이 아닌 허용된 role 값으로 INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'roleu1', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_role_insert_user_id')
  ),
  $$NULL이 아닌 허용된 role 값으로 INSERT는 성공해야 한다.$$
);

-- 기존 행에서 role이 NULL이 아닌 상태는 유지되어야 한다.
SELECT ok(
  (
    SELECT role IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_role_update_valid_id')::uuid
  ),
  $$기존 행에서 role이 NULL이 아닌 상태는 유지되어야 한다.$$
);

-- [예외 조건]
-- role이 없는 profiles 행은 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE role IS NULL
  ),
  0::bigint,
  $$role이 없는 profiles 행은 존재하면 안 된다.$$
);

-- [경계 조건]
-- role = 'USER'로 INSERT하면 성공해야 한다.
SELECT is(
  (
    SELECT role
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_role_insert_user_id')::uuid
  ),
  'USER',
  $$role = 'USER'로 INSERT하면 성공해야 한다.$$
);

-- role = 'ADMIN'로 INSERT하면 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'rolea1', 'ADMIN', '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_role_insert_admin_id')
  ),
  $$role = 'ADMIN'로 INSERT하면 성공해야 한다.$$
);

-- role = NULL로 INSERT하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'rolen1', NULL, '2024-01-01 00:00:00+00'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_role_insert_null_id')
  ),
  '23502',
  NULL,
  $$role = NULL로 INSERT하면 실패해야 한다.$$
);

-- 기존 유효한 행의 role을 NULL로 UPDATE하려고 하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET role = NULL
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_not_null_role_update_valid_id')
  ),
  '23502',
  NULL,
  $$기존 유효한 행의 role을 NULL로 UPDATE하려고 하면 실패해야 한다.$$
);

-- [불변 조건]
-- profiles 테이블에는 role IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE role IS NULL
  ),
  0::bigint,
  $$profiles 테이블에는 role IS NULL인 행이 존재해서는 안 된다.$$
);

-- 모든 profiles 행은 NULL이 아닌 role을 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE role IS NOT NULL
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 profiles 행은 NULL이 아닌 role을 가져야 한다.$$
);

-- [정답 조건]
-- created_at이 채워진 profiles INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'crtins', 'USER', '%s'::timestamptz, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_created_insert_valid_id'),
    current_setting('test.profiles_constraints_not_null_created_valid_value')
  ),
  $$created_at이 채워진 profiles INSERT는 성공해야 한다.$$
);

-- 기존 행에서 created_at이 NULL이 아닌 상태는 유지되어야 한다.
SELECT ok(
  (
    SELECT created_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_created_update_valid_id')::uuid
  ),
  $$기존 행에서 created_at이 NULL이 아닌 상태는 유지되어야 한다.$$
);

-- [예외 조건]
-- created_at이 없는 profiles 행은 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE created_at IS NULL
  ),
  0::bigint,
  $$created_at이 없는 profiles 행은 존재하면 안 된다.$$
);

-- [경계 조건]
-- 명시적으로 유효한 created_at 값을 넣어 INSERT하면 성공해야 한다.
SELECT is(
  (
    SELECT created_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_created_insert_valid_id')::uuid
  ),
  current_setting('test.profiles_constraints_not_null_created_valid_value')::timestamptz,
  $$명시적으로 유효한 created_at 값을 넣어 INSERT하면 성공해야 한다.$$
);

-- created_at = NULL로 INSERT하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'crtnul', 'USER', NULL, '2024-01-01 00:00:00+00'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_created_insert_null_id')
  ),
  '23502',
  NULL,
  $$created_at = NULL로 INSERT하면 실패해야 한다.$$
);

-- 기존 유효한 행의 created_at을 NULL로 UPDATE하려고 하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET created_at = NULL
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_not_null_created_update_valid_id')
  ),
  '23502',
  NULL,
  $$기존 유효한 행의 created_at을 NULL로 UPDATE하려고 하면 실패해야 한다.$$
);

-- created_at 생략 시의 성공 여부는 이 파일의 검증 대상이 아니며, 기본값 적용 여부는 constraints_default에서 검증한다.
SELECT ok(
  true,
  $$created_at 생략 시의 성공 여부는 이 파일의 검증 대상이 아니며, 기본값 적용 여부는 constraints_default에서 검증한다.$$
);

-- [불변 조건]
-- profiles 테이블에는 created_at IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE created_at IS NULL
  ),
  0::bigint,
  $$profiles 테이블에는 created_at IS NULL인 행이 존재해서는 안 된다.$$
);

-- 모든 profiles 행은 NULL이 아닌 created_at을 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE created_at IS NOT NULL
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 profiles 행은 NULL이 아닌 created_at을 가져야 한다.$$
);

-- [정답 조건]
-- updated_at이 채워진 profiles INSERT는 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'updins', 'USER', '2024-01-01 00:00:00+00'::timestamptz, '%s'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_not_null_updated_insert_valid_id'),
    current_setting('test.profiles_constraints_not_null_updated_valid_value')
  ),
  $$updated_at이 채워진 profiles INSERT는 성공해야 한다.$$
);

-- 기존 행에서 updated_at이 NULL이 아닌 상태는 유지되어야 한다.
SELECT ok(
  (
    SELECT updated_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_updated_update_valid_id')::uuid
  ),
  $$기존 행에서 updated_at이 NULL이 아닌 상태는 유지되어야 한다.$$
);

-- [예외 조건]
-- updated_at이 없는 profiles 행은 존재하면 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE updated_at IS NULL
  ),
  0::bigint,
  $$updated_at이 없는 profiles 행은 존재하면 안 된다.$$
);

-- [경계 조건]
-- 명시적으로 유효한 updated_at 값을 넣어 INSERT하면 성공해야 한다.
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_not_null_updated_insert_valid_id')::uuid
  ),
  current_setting('test.profiles_constraints_not_null_updated_valid_value')::timestamptz,
  $$명시적으로 유효한 updated_at 값을 넣어 INSERT하면 성공해야 한다.$$
);

-- updated_at = NULL로 INSERT하면 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at, updated_at)
      VALUES ('%s'::uuid, 'updnul', 'USER', '2024-01-01 00:00:00+00'::timestamptz, NULL)
    $sql$,
    current_setting('test.profiles_constraints_not_null_updated_insert_null_id')
  ),
  '23502',
  NULL,
  $$updated_at = NULL로 INSERT하면 실패해야 한다.$$
);

-- 기존 유효한 행의 updated_at을 NULL로 UPDATE하려고 하면 실패해야 한다.
ALTER TABLE public.profiles DISABLE TRIGGER tr_profiles_updated_at;

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.profiles
      SET updated_at = NULL
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.profiles_constraints_not_null_updated_update_valid_id')
  ),
  '23502',
  NULL,
  $$기존 유효한 행의 updated_at을 NULL로 UPDATE하려고 하면 실패해야 한다.$$
);

ALTER TABLE public.profiles ENABLE TRIGGER tr_profiles_updated_at;

-- updated_at 생략 시의 성공 여부는 이 파일의 검증 대상이 아니며, 기본값 적용 여부는 constraints_default에서 검증한다.
SELECT ok(
  true,
  $$updated_at 생략 시의 성공 여부는 이 파일의 검증 대상이 아니며, 기본값 적용 여부는 constraints_default에서 검증한다.$$
);

-- [불변 조건]
-- profiles 테이블에는 updated_at IS NULL인 행이 존재해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE updated_at IS NULL
  ),
  0::bigint,
  $$profiles 테이블에는 updated_at IS NULL인 행이 존재해서는 안 된다.$$
);

-- 모든 profiles 행은 NULL이 아닌 updated_at을 가져야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE updated_at IS NOT NULL
  ),
  (
    SELECT count(*)::bigint
    FROM public.profiles
  ),
  $$모든 profiles 행은 NULL이 아닌 updated_at을 가져야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
