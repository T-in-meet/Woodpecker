-- =========================================
-- profiles / FK
-- =========================================

BEGIN;

SELECT plan(7);

-- 테스트 데이터 준비
SELECT set_config('test.u1', gen_random_uuid()::text, false);
SELECT set_config('test.u2', gen_random_uuid()::text, false);
SELECT set_config('test.u3', gen_random_uuid()::text, false);
SELECT set_config('test.u4', gen_random_uuid()::text, false);
SELECT set_config('test.bogus', gen_random_uuid()::text, false);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.u1')::uuid, 'u1_' || current_setting('test.u1') || '@example.com', '{}'::jsonb),
  (current_setting('test.u2')::uuid, 'u2_' || current_setting('test.u2') || '@example.com', '{}'::jsonb),
  (current_setting('test.u3')::uuid, 'u3_' || current_setting('test.u3') || '@example.com', '{}'::jsonb),
  (current_setting('test.u4')::uuid, 'u4_' || current_setting('test.u4') || '@example.com', '{}'::jsonb);

-- [정답 조건]
-- 유효한 auth.users.id로만 profile이 존재해야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   JOIN auth.users u ON u.id = p.id
   WHERE p.id = current_setting('test.u1')::uuid),
  1::bigint,
  '유효한 user에 대한 profile 존재'
);

-- user 삭제 시 해당 profile도 삭제되어야 한다.
DELETE FROM auth.users WHERE id = current_setting('test.u2')::uuid;
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2')::uuid),
  0::bigint,
  'user 삭제 시 profile 삭제'
);

-- [예외 조건]
-- 존재하지 않는 auth.users.id로 profile insert가 성공하면 안 된다.
SELECT throws_ok($$
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (current_setting('test.bogus')::uuid, 'n_bogus', 'USER');
$$, '23503', 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"', '존재하지 않는 user로 insert 실패');

-- 동일한 id로 profile이 중복 생성되면 안 된다.
SELECT throws_ok($$
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (current_setting('test.u1')::uuid, 'n_dup', 'USER');
$$, '23505', 'duplicate key value violates unique constraint "profiles_pkey"', '동일 id 중복 생성 불가');

-- [경계 조건]
-- user 삭제 직후 profile이 남아 있으면 안 된다.
DELETE FROM auth.users WHERE id = current_setting('test.u3')::uuid;
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u3')::uuid),
  0::bigint,
  'user 삭제 직후 profile 없음'
);

-- 같은 user에 대해 profile을 두 번 생성하려 하면 허용되면 안 된다.
SELECT throws_ok($$
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (current_setting('test.u4')::uuid, 'n_dup2', 'USER');
$$, '23505', 'duplicate key value violates unique constraint "profiles_pkey"', '동일 user profile 2회 생성 불가');

-- [불변 조건]
-- profile은 항상 유효한 user에 종속되어야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   LEFT JOIN auth.users u ON u.id = p.id
   WHERE u.id IS NULL),
  0::bigint,
  '항상 유효한 user에 종속'
);

SELECT * FROM finish();
ROLLBACK;
