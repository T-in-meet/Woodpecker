-- =========================================
-- push_subscriptions / constraints_unique
-- 본 테스트는 unique constraint 검증용이며 RLS 정책 검증은 포함하지 않는다.
-- =========================================

BEGIN;

SELECT plan(14);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_boundary_id', gen_random_uuid()::text, true);
SELECT set_config('test.sub_transition_id', gen_random_uuid()::text, true);

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
    current_setting('test.user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: push_subscriptions
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES
  (
    current_setting('test.sub_a1_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'https://push.example.com/sub/user-a-1',
    'p256dh_a1',
    'auth_a1'
  ),
  (
    current_setting('test.sub_b1_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'https://push.example.com/sub/user-b-1',
    'p256dh_b1',
    'auth_b1'
  )
ON CONFLICT (id) DO NOTHING;


-- [정답 조건]
-- 새로운 endpoint로 INSERT 가능
SAVEPOINT push_subscriptions_unique_insert_new;
INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.sub_insert_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://push.example.com/sub/new-endpoint',
  'p256dh_new',
  'auth_new'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.sub_insert_id')::uuid),
  1::bigint,
  $$새로운 endpoint로 INSERT 가능$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_insert_new;

-- 새로운 endpoint로 UPDATE 가능
SAVEPOINT push_subscriptions_unique_update_new;
UPDATE public.push_subscriptions
SET endpoint = 'https://push.example.com/sub/updated-endpoint'
WHERE id = current_setting('test.sub_a1_id')::uuid;

SELECT is(
  (SELECT endpoint FROM public.push_subscriptions WHERE id = current_setting('test.sub_a1_id')::uuid),
  'https://push.example.com/sub/updated-endpoint',
  $$새로운 endpoint로 UPDATE 가능$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_update_new;

-- 서로 다른 endpoint 허용
SELECT ok(
  (
    (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://push.example.com/sub/user-a-1') = 1
    AND (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://push.example.com/sub/user-b-1') = 1
  ),
  $$서로 다른 endpoint 허용$$
);

-- [예외 조건]
-- 이미 존재하는 endpoint로 INSERT 불가
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://push.example.com/sub/user-a-1', 'p256dh_dup', 'auth_dup');
  $sql$,
  '23505',
  NULL,
  $$이미 존재하는 endpoint로 INSERT 불가$$
);

-- 이미 존재하는 endpoint로 UPDATE 불가
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.push_subscriptions
      SET endpoint = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    'https://push.example.com/sub/user-a-1',
    current_setting('test.sub_b1_id')
  ),
  '23505',
  NULL,
  $$이미 존재하는 endpoint로 UPDATE 불가$$
);

-- user와 무관하게 전체 범위에서 중복 금지
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_b_id')::uuid, 'https://push.example.com/sub/user-a-1', 'p256dh_dup2', 'auth_dup2');
  $sql$,
  '23505',
  NULL,
  $$user와 무관하게 전체 범위에서 중복 금지$$
);

-- [경계 조건]
-- 동일 endpoint → 허용되지 않음
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://push.example.com/sub/user-b-1', 'p256dh_dup3', 'auth_dup3');
  $sql$,
  '23505',
  NULL,
  $$동일 endpoint → 허용되지 않음$$
);

-- 1글자 차이 → 허용
SAVEPOINT push_subscriptions_unique_boundary_char;
INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
VALUES (
  current_setting('test.sub_boundary_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://push.example.com/sub/user-a-1x',
  'p256dh_boundary',
  'auth_boundary'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE id = current_setting('test.sub_boundary_id')::uuid),
  1::bigint,
  $$1글자 차이 → 허용$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_boundary_char;

-- suffix 추가 → 허용
SAVEPOINT push_subscriptions_unique_boundary_suffix;
INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
VALUES (
  gen_random_uuid(),
  current_setting('test.user_a_id')::uuid,
  'https://push.example.com/sub/user-a-1/suffix',
  'p256dh_suffix',
  'auth_suffix'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint = 'https://push.example.com/sub/user-a-1/suffix'),
  1::bigint,
  $$suffix 추가 → 허용$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_boundary_suffix;

-- 0건 → INSERT 허용
SAVEPOINT push_subscriptions_unique_boundary_empty;
DELETE FROM public.push_subscriptions;

INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
VALUES (
  current_setting('test.sub_boundary_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://push.example.com/sub/empty',
  'p256dh_empty',
  'auth_empty'
);

SELECT is(
  (SELECT count(*) FROM public.push_subscriptions),
  1::bigint,
  $$0건 → INSERT 허용$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_boundary_empty;

-- 1건 → 동일값 추가 불가
SELECT throws_ok(
  $sql$
    INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    VALUES (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'https://push.example.com/sub/user-b-1', 'p256dh_dup4', 'auth_dup4');
  $sql$,
  '23505',
  NULL,
  $$1건 → 동일값 추가 불가$$
);

-- [불변 조건]
-- 동일 endpoint는 항상 1건 이하 (Status)
SELECT ok(
  NOT EXISTS (
    SELECT endpoint
    FROM public.push_subscriptions
    GROUP BY endpoint
    HAVING count(*) > 1
  ),
  $$동일 endpoint는 항상 1건 이하 (Status)$$
);

-- INSERT 후에는 전체 행 수가 1 증가하고, UPDATE 후에는 전체 행 수가 유지되며, 전 과정에서 중복 endpoint가 발생하지 않아야 한다. (Transition)
SAVEPOINT push_subscriptions_unique_transition;

SELECT set_config(
  'test.unique_before_count',
  (SELECT count(*) FROM public.push_subscriptions)::text,
  true
);

INSERT INTO public.push_subscriptions (
  id,
  user_id,
  endpoint,
  p256dh,
  auth
)
VALUES (
  current_setting('test.sub_transition_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'https://push.example.com/sub/transition',
  'p256dh_transition',
  'auth_transition'
);

SELECT set_config(
  'test.unique_after_insert_count',
  (SELECT count(*) FROM public.push_subscriptions)::text,
  true
);

UPDATE public.push_subscriptions
SET endpoint = 'https://push.example.com/sub/transition-updated'
WHERE id = current_setting('test.sub_transition_id')::uuid;

SELECT ok(
  (
    current_setting('test.unique_after_insert_count')::int
      = current_setting('test.unique_before_count')::int + 1
    AND (SELECT count(*) FROM public.push_subscriptions)
      = current_setting('test.unique_after_insert_count')::int
    AND (SELECT endpoint
         FROM public.push_subscriptions
         WHERE id = current_setting('test.sub_transition_id')::uuid)
      = 'https://push.example.com/sub/transition-updated'
    AND NOT EXISTS (
      SELECT endpoint
      FROM public.push_subscriptions
      GROUP BY endpoint
      HAVING count(*) > 1
    )
  ),
  $$INSERT 후에는 전체 행 수가 1 증가하고, UPDATE 후에는 전체 행 수가 유지되며, 전 과정에서 중복 endpoint가 발생하지 않아야 한다. (Transition)$$
);
ROLLBACK TO SAVEPOINT push_subscriptions_unique_transition;

-- user_id와 무관하게 고유성 유지 (Status)
SELECT ok(
  NOT EXISTS (
    SELECT endpoint
    FROM public.push_subscriptions
    GROUP BY endpoint
    HAVING count(*) > 1
  ),
  $$user_id와 무관하게 고유성 유지 (Status)$$
);

SELECT * FROM finish();
ROLLBACK;