-- =========================================
-- profiles / DEFAULT
-- =========================================

BEGIN;

SELECT plan(41);
SELECT set_config('test.profiles_constraints_default_tx_start', transaction_timestamp()::text, true);

-- 테스트용 UUID 준비
SELECT set_config('test.profiles_constraints_default_role_answer_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_role_answer_admin_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_role_boundary_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_role_boundary_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_role_boundary_admin_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_created_answer_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_created_answer_past_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_created_boundary_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_created_boundary_future_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_updated_answer_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_updated_answer_past_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_updated_boundary_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.profiles_constraints_default_updated_boundary_future_id', gen_random_uuid()::text, true);

SELECT set_config('test.profiles_constraints_default_created_answer_past_value', '2000-01-01 00:00:00+00'::timestamptz::text, true);
SELECT set_config('test.profiles_constraints_default_created_boundary_future_value', '2099-12-31 23:59:59+00'::timestamptz::text, true);
SELECT set_config('test.profiles_constraints_default_updated_answer_past_value', '2001-01-01 00:00:00+00'::timestamptz::text, true);
SELECT set_config('test.profiles_constraints_default_updated_boundary_future_value', '2098-12-31 23:59:59+00'::timestamptz::text, true);

-- seed: auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid, 'profiles_constraints_default_role_answer_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_role_answer_admin_id')::uuid, 'profiles_constraints_default_role_answer_admin@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_role_boundary_default_id')::uuid, 'profiles_constraints_default_role_boundary_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_role_boundary_user_id')::uuid, 'profiles_constraints_default_role_boundary_user@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_role_boundary_admin_id')::uuid, 'profiles_constraints_default_role_boundary_admin@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid, 'profiles_constraints_default_created_answer_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_created_answer_past_id')::uuid, 'profiles_constraints_default_created_answer_past@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_created_boundary_default_id')::uuid, 'profiles_constraints_default_created_boundary_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_created_boundary_future_id')::uuid, 'profiles_constraints_default_created_boundary_future@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid, 'profiles_constraints_default_updated_answer_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_updated_answer_past_id')::uuid, 'profiles_constraints_default_updated_answer_past@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_updated_boundary_default_id')::uuid, 'profiles_constraints_default_updated_boundary_default@example.com', '{}'::jsonb),
  (current_setting('test.profiles_constraints_default_updated_boundary_future_id')::uuid, 'profiles_constraints_default_updated_boundary_future@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed 정리: auth.users INSERT 트리거로 미리 생성된 profiles 행 제거
DELETE FROM public.profiles
WHERE id IN (
  current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid,
  current_setting('test.profiles_constraints_default_role_answer_admin_id')::uuid,
  current_setting('test.profiles_constraints_default_role_boundary_default_id')::uuid,
  current_setting('test.profiles_constraints_default_role_boundary_user_id')::uuid,
  current_setting('test.profiles_constraints_default_role_boundary_admin_id')::uuid,
  current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid,
  current_setting('test.profiles_constraints_default_created_answer_past_id')::uuid,
  current_setting('test.profiles_constraints_default_created_boundary_default_id')::uuid,
  current_setting('test.profiles_constraints_default_created_boundary_future_id')::uuid,
  current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid,
  current_setting('test.profiles_constraints_default_updated_answer_past_id')::uuid,
  current_setting('test.profiles_constraints_default_updated_boundary_default_id')::uuid,
  current_setting('test.profiles_constraints_default_updated_boundary_future_id')::uuid
);

-- [정답 조건]
-- role을 생략하고 INSERT하면 행 생성이 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname)
      VALUES ('%s'::uuid, 'rdflt1')
    $sql$,
    current_setting('test.profiles_constraints_default_role_answer_default_id')
  ),
  $$role을 생략하고 INSERT하면 행 생성이 성공해야 한다.$$
);

-- role을 생략하고 생성된 행의 role은 USER여야 한다.
SELECT is(
  (
    SELECT role
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid
  ),
  'USER',
  $$role을 생략하고 생성된 행의 role은 USER여야 한다.$$
);

-- 명시적으로 role = 'ADMIN'을 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'radmin1', 'ADMIN')
    $sql$,
    current_setting('test.profiles_constraints_default_role_answer_admin_id')
  ),
  $$명시적으로 role = 'ADMIN'을 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.$$
);

-- [예외 조건]
-- role을 생략했는데 NULL로 저장되면 안 된다.
SELECT ok(
  (
    SELECT role IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid
  ),
  $$role을 생략했는데 NULL로 저장되면 안 된다.$$
);

-- role을 생략했는데 USER 외 다른 값으로 저장되면 안 된다.
SELECT ok(
  (
    SELECT role = 'USER'
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid
  ),
  $$role을 생략했는데 USER 외 다른 값으로 저장되면 안 된다.$$
);

-- 명시적으로 넣은 유효한 role 값이 기본값으로 덮어써지면 안 된다.
SELECT is(
  (
    SELECT role
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_role_answer_admin_id')::uuid
  ),
  'ADMIN',
  $$명시적으로 넣은 유효한 role 값이 기본값으로 덮어써지면 안 된다.$$
);

-- [경계 조건]
-- role 생략 + 유효한 id, nickname 제공 시 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname)
      VALUES ('%s'::uuid, 'rbdft1')
    $sql$,
    current_setting('test.profiles_constraints_default_role_boundary_default_id')
  ),
  $$role 생략 + 유효한 id, nickname 제공 시 성공해야 한다.$$
);

-- role = 'USER' 명시 시 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'ruser01', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_default_role_boundary_user_id')
  ),
  $$role = 'USER' 명시 시 성공해야 한다.$$
);

-- role = 'ADMIN' 명시 시 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'radm002', 'ADMIN')
    $sql$,
    current_setting('test.profiles_constraints_default_role_boundary_admin_id')
  ),
  $$role = 'ADMIN' 명시 시 성공해야 한다.$$
);

-- role = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.
SELECT ok(
  true,
  $$role = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.$$
);

-- role = 'MANAGER' 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, 허용값 차단은 constraints_check에서 검증한다.
SELECT ok(
  true,
  $$role = 'MANAGER' 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, 허용값 차단은 constraints_check에서 검증한다.$$
);

-- [불변 조건]
-- role 생략 INSERT로 생성된 모든 행의 role은 항상 USER여야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_constraints_default_role_answer_default_id')::uuid,
      current_setting('test.profiles_constraints_default_role_boundary_default_id')::uuid
    )
    AND role <> 'USER'
  ),
  0::bigint,
  $$role 생략 INSERT로 생성된 모든 행의 role은 항상 USER여야 한다.$$
);

-- 기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE (id = current_setting('test.profiles_constraints_default_role_answer_admin_id')::uuid AND role = 'ADMIN')
       OR (id = current_setting('test.profiles_constraints_default_role_boundary_user_id')::uuid AND role = 'USER')
       OR (id = current_setting('test.profiles_constraints_default_role_boundary_admin_id')::uuid AND role = 'ADMIN')
  ),
  3::bigint,
  $$기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.$$
);

-- [정답 조건]
-- created_at을 생략하고 INSERT하면 행 생성이 성공해야 한다.
SELECT set_config('test.profiles_constraints_default_created_answer_default_before', clock_timestamp()::text, true);
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'cdflt1', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_default_created_answer_default_id')
  ),
  $$created_at을 생략하고 INSERT하면 행 생성이 성공해야 한다.$$
);
SELECT set_config('test.profiles_constraints_default_created_answer_default_after', clock_timestamp()::text, true);

-- created_at을 생략하고 생성된 행의 created_at은 NULL이 아니어야 한다.
SELECT ok(
  (
    SELECT created_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid
  ),
  $$created_at을 생략하고 생성된 행의 created_at은 NULL이 아니어야 한다.$$
);

-- created_at을 명시적으로 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at)
      VALUES ('%s'::uuid, 'cpast01', 'USER', '%s'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_default_created_answer_past_id'),
    current_setting('test.profiles_constraints_default_created_answer_past_value')
  ),
  $$created_at을 명시적으로 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.$$
);

-- [예외 조건]
-- created_at을 생략했는데 NULL로 저장되면 안 된다.
SELECT ok(
  (
    SELECT created_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid
  ),
  $$created_at을 생략했는데 NULL로 저장되면 안 된다.$$
);

-- created_at을 생략했는데 비어 있는 값으로 저장되면 안 된다.
SELECT ok(
  (
    SELECT created_at::text <> ''
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid
  ),
  $$created_at을 생략했는데 비어 있는 값으로 저장되면 안 된다.$$
);

-- 명시적으로 넣은 created_at 값이 기본값으로 덮어써지면 안 된다.
SELECT is(
  (
    SELECT created_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_past_id')::uuid
  ),
  current_setting('test.profiles_constraints_default_created_answer_past_value')::timestamptz,
  $$명시적으로 넣은 created_at 값이 기본값으로 덮어써지면 안 된다.$$
);

-- [경계 조건]
-- created_at 생략 + 유효한 id, nickname 제공 시 성공해야 한다.
SELECT set_config('test.profiles_constraints_default_created_boundary_default_before', clock_timestamp()::text, true);
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'cbdft1', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_default_created_boundary_default_id')
  ),
  $$created_at 생략 + 유효한 id, nickname 제공 시 성공해야 한다.$$
);
SELECT set_config('test.profiles_constraints_default_created_boundary_default_after', clock_timestamp()::text, true);

-- 명시적으로 유효한 과거 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.
SELECT is(
  (
    SELECT created_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_past_id')::uuid
  ),
  current_setting('test.profiles_constraints_default_created_answer_past_value')::timestamptz,
  $$명시적으로 유효한 과거 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.$$
);

-- 명시적으로 유효한 현재/미래 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, created_at)
      VALUES ('%s'::uuid, 'cfutr1', 'USER', '%s'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_default_created_boundary_future_id'),
    current_setting('test.profiles_constraints_default_created_boundary_future_value')
  ),
  $$명시적으로 유효한 현재/미래 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.$$
);

-- created_at = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.
SELECT ok(
  true,
  $$created_at = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.$$
);

-- 시간 오차 허용 범위, now()와의 정밀 비교 방식은 구현 방식이므로 이 설계표에서 고정하지 않는다.
SELECT ok(
  true,
  $$시간 오차 허용 범위, now()와의 정밀 비교 방식은 구현 방식이므로 이 설계표에서 고정하지 않는다.$$
);

-- [불변 조건]
-- created_at 생략 INSERT로 생성된 모든 행의 created_at은 항상 NULL이 아니어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid,
      current_setting('test.profiles_constraints_default_created_boundary_default_id')::uuid
    )
    AND created_at IS NULL
  ),
  0::bigint,
  $$created_at 생략 INSERT로 생성된 모든 행의 created_at은 항상 NULL이 아니어야 한다.$$
);

-- 기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE (id = current_setting('test.profiles_constraints_default_created_answer_past_id')::uuid
           AND created_at = current_setting('test.profiles_constraints_default_created_answer_past_value')::timestamptz)
       OR (id = current_setting('test.profiles_constraints_default_created_boundary_future_id')::uuid
           AND created_at = current_setting('test.profiles_constraints_default_created_boundary_future_value')::timestamptz)
  ),
  2::bigint,
  $$기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.$$
);

-- created_at 기본값은 “생성 시각 기록”이라는 정책 의도를 유지해야 한다.
SELECT ok(
  (
    SELECT created_at >= current_setting('test.profiles_constraints_default_tx_start')::timestamptz
       AND created_at <= current_setting('test.profiles_constraints_default_created_answer_default_after')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_created_answer_default_id')::uuid
  ),
  $$created_at 기본값은 “생성 시각 기록”이라는 정책 의도를 유지해야 한다.$$
);

-- [정답 조건]
-- updated_at을 생략하고 INSERT하면 행 생성이 성공해야 한다.
SELECT set_config('test.profiles_constraints_default_updated_answer_default_before', clock_timestamp()::text, true);
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'udflt1', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_default_updated_answer_default_id')
  ),
  $$updated_at을 생략하고 INSERT하면 행 생성이 성공해야 한다.$$
);
SELECT set_config('test.profiles_constraints_default_updated_answer_default_after', clock_timestamp()::text, true);

-- updated_at을 생략하고 생성된 행의 updated_at은 NULL이 아니어야 한다.
SELECT ok(
  (
    SELECT updated_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid
  ),
  $$updated_at을 생략하고 생성된 행의 updated_at은 NULL이 아니어야 한다.$$
);

-- updated_at을 명시적으로 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, updated_at)
      VALUES ('%s'::uuid, 'upast01', 'USER', '%s'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_default_updated_answer_past_id'),
    current_setting('test.profiles_constraints_default_updated_answer_past_value')
  ),
  $$updated_at을 명시적으로 넣고 INSERT하면 기본값이 아니라 명시값이 유지되어야 한다.$$
);

-- [예외 조건]
-- updated_at을 생략했는데 NULL로 저장되면 안 된다.
SELECT ok(
  (
    SELECT updated_at IS NOT NULL
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid
  ),
  $$updated_at을 생략했는데 NULL로 저장되면 안 된다.$$
);

-- updated_at을 생략했는데 비어 있는 값으로 저장되면 안 된다.
SELECT ok(
  (
    SELECT updated_at::text <> ''
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid
  ),
  $$updated_at을 생략했는데 비어 있는 값으로 저장되면 안 된다.$$
);

-- 명시적으로 넣은 updated_at 값이 기본값으로 덮어써지면 안 된다.
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_past_id')::uuid
  ),
  current_setting('test.profiles_constraints_default_updated_answer_past_value')::timestamptz,
  $$명시적으로 넣은 updated_at 값이 기본값으로 덮어써지면 안 된다.$$
);

-- [경계 조건]
-- updated_at 생략 + 유효한 id, nickname 제공 시 성공해야 한다.
SELECT set_config('test.profiles_constraints_default_updated_boundary_default_before', clock_timestamp()::text, true);
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'ubdft1', 'USER')
    $sql$,
    current_setting('test.profiles_constraints_default_updated_boundary_default_id')
  ),
  $$updated_at 생략 + 유효한 id, nickname 제공 시 성공해야 한다.$$
);
SELECT set_config('test.profiles_constraints_default_updated_boundary_default_after', clock_timestamp()::text, true);

-- 명시적으로 유효한 과거 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.
SELECT is(
  (
    SELECT updated_at
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_past_id')::uuid
  ),
  current_setting('test.profiles_constraints_default_updated_answer_past_value')::timestamptz,
  $$명시적으로 유효한 과거 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.$$
);

-- 명시적으로 유효한 현재/미래 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role, updated_at)
      VALUES ('%s'::uuid, 'ufutr1', 'USER', '%s'::timestamptz)
    $sql$,
    current_setting('test.profiles_constraints_default_updated_boundary_future_id'),
    current_setting('test.profiles_constraints_default_updated_boundary_future_value')
  ),
  $$명시적으로 유효한 현재/미래 시각을 넣고 INSERT하면 성공해야 하며 명시값이 유지되어야 한다.$$
);

-- updated_at = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.
SELECT ok(
  true,
  $$updated_at = NULL 명시 시 성공 여부는 DEFAULT 검증 대상이 아니며, NULL 차단은 constraints_not_null에서 검증한다.$$
);

-- INSERT 이후 UPDATE 시 자동 변경 여부는 DEFAULT 검증 대상이 아니며, 변경 시각 갱신 책임은 trigger 설계표에서 검증한다.
SELECT ok(
  true,
  $$INSERT 이후 UPDATE 시 자동 변경 여부는 DEFAULT 검증 대상이 아니며, 변경 시각 갱신 책임은 trigger 설계표에서 검증한다.$$
);

-- [불변 조건]
-- updated_at 생략 INSERT로 생성된 모든 행의 updated_at은 항상 NULL이 아니어야 한다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE id IN (
      current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid,
      current_setting('test.profiles_constraints_default_updated_boundary_default_id')::uuid
    )
    AND updated_at IS NULL
  ),
  0::bigint,
  $$updated_at 생략 INSERT로 생성된 모든 행의 updated_at은 항상 NULL이 아니어야 한다.$$
);

-- 기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.
SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.profiles
    WHERE (id = current_setting('test.profiles_constraints_default_updated_answer_past_id')::uuid
           AND updated_at = current_setting('test.profiles_constraints_default_updated_answer_past_value')::timestamptz)
       OR (id = current_setting('test.profiles_constraints_default_updated_boundary_future_id')::uuid
           AND updated_at = current_setting('test.profiles_constraints_default_updated_boundary_future_value')::timestamptz)
  ),
  2::bigint,
  $$기본값은 생략 시에만 적용되어야 하며, 명시값을 침범해서는 안 된다.$$
);

-- INSERT 시점 기준의 기본 생성 타임스탬프라는 정책 의도를 유지해야 한다.
SELECT ok(
  (
    SELECT updated_at >= current_setting('test.profiles_constraints_default_tx_start')::timestamptz
       AND updated_at <= current_setting('test.profiles_constraints_default_updated_answer_default_after')::timestamptz
    FROM public.profiles
    WHERE id = current_setting('test.profiles_constraints_default_updated_answer_default_id')::uuid
  ),
  $$INSERT 시점 기준의 기본 생성 타임스탬프라는 정책 의도를 유지해야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
