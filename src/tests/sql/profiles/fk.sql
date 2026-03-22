-- =========================================
-- profiles / FK
-- =========================================

BEGIN;

SELECT plan(6);

-- 테스트 데이터 준비
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);
SELECT set_config('test.u3', gen_random_uuid()::text, true);
SELECT set_config('test.u4', gen_random_uuid()::text, true);
SELECT set_config('test.bogus', gen_random_uuid()::text, true);

-- seed: auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.u1')::uuid, 'u1_' || current_setting('test.u1') || '@example.com', '{}'::jsonb),
  (current_setting('test.u2')::uuid, 'u2_' || current_setting('test.u2') || '@example.com', '{}'::jsonb),
  (current_setting('test.u3')::uuid, 'u3_' || current_setting('test.u3') || '@example.com', '{}'::jsonb),
  (current_setting('test.u4')::uuid, 'u4_' || current_setting('test.u4') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed: profiles (handle_new_user 트리거 미동작 환경 대비 직접 INSERT)
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.u1')::uuid, 'nick1', 'USER'),
  (current_setting('test.u2')::uuid, 'nick2', 'USER'),
  (current_setting('test.u3')::uuid, 'nick3', 'USER'),
  (current_setting('test.u4')::uuid, 'nick4', 'USER')
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- auth.users에 존재하는 id로 profile이 존재해야 한다
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   JOIN auth.users u ON u.id = p.id
   WHERE p.id = current_setting('test.u1')::uuid),
  1::bigint,
  'auth.users에 존재하는 id로 profile이 존재해야 한다'
);

-- auth.users에서 user를 삭제하면 해당 profile도 자동으로 삭제되어야 한다
SAVEPOINT fk_delete_cascade;
DELETE FROM auth.users WHERE id = current_setting('test.u2')::uuid;
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = current_setting('test.u2')::uuid),
  0::bigint,
  'auth.users에서 user를 삭제하면 해당 profile도 자동으로 삭제되어야 한다'
);
ROLLBACK TO SAVEPOINT fk_delete_cascade;

-- [예외 조건]
-- auth.users에 존재하지 않는 id로 profile INSERT를 시도하면 FK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'n_bogus', 'USER');
    $sql$,
    current_setting('test.bogus')
  ),
  '23503',
  'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
  'auth.users에 존재하지 않는 id로 profile INSERT를 시도하면 FK 위반으로 실패해야 한다'
);

-- 동일한 id로 profile을 중복 생성하면 PK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'n_dup', 'USER');
    $sql$,
    current_setting('test.u1')
  ),
  '23505',
  'duplicate key value violates unique constraint "profiles_pkey"',
  '동일한 id로 profile을 중복 생성하면 PK 위반으로 실패해야 한다'
);

-- [경계 조건]
-- auth.users에서 user가 삭제된 직후 해당 id로 profile INSERT를 시도하면 실패해야 한다
SAVEPOINT fk_stale_reference;
DELETE FROM auth.users WHERE id = current_setting('test.u3')::uuid;
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.profiles (id, nickname, role)
      VALUES ('%s'::uuid, 'stale', 'USER');
    $sql$,
    current_setting('test.u3')
  ),
  '23503',
  'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
  'auth.users에서 user가 삭제된 직후 해당 id로 profile INSERT를 시도하면 실패해야 한다'
);
ROLLBACK TO SAVEPOINT fk_stale_reference;

-- [불변 조건]
-- profiles 테이블에는 auth.users에 대응하는 행이 없는 orphan profile이 존재해서는 안 된다
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   LEFT JOIN auth.users u ON u.id = p.id
   WHERE u.id IS NULL),
  0::bigint,
  'profiles 테이블에는 auth.users에 대응하는 행이 없는 orphan profile이 존재해서는 안 된다'
);

SELECT * FROM finish();
ROLLBACK;
