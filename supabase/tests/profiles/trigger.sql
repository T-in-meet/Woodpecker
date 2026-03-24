-- =========================================
-- profiles / TRIGGER
-- =========================================

BEGIN;

SELECT plan(7);

-- 테스트 데이터 준비
SELECT set_config('test.u1', gen_random_uuid()::text, true);
SELECT set_config('test.u2', gen_random_uuid()::text, true);
SELECT set_config('test.u3', gen_random_uuid()::text, true);
SELECT set_config('test.u4', gen_random_uuid()::text, true);
SELECT set_config('test.u5', gen_random_uuid()::text, true);
SELECT set_config('test.u6', gen_random_uuid()::text, true);

-- seed: auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.u1')::uuid, 'u1_' || current_setting('test.u1') || '@example.com', '{}'::jsonb),
  (current_setting('test.u2')::uuid, 'u2_' || current_setting('test.u2') || '@example.com', '{}'::jsonb),
  (current_setting('test.u3')::uuid, 'u3_' || current_setting('test.u3') || '@example.com', '{}'::jsonb),
  (current_setting('test.u4')::uuid, 'u4_' || current_setting('test.u4') || '@example.com', '{}'::jsonb),
  (current_setting('test.u5')::uuid, 'u5_' || current_setting('test.u5') || '@example.com', '{}'::jsonb),
  (current_setting('test.u6')::uuid, 'u6_' || current_setting('test.u6') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- seed: profiles (handle_new_user 트리거 미동작 환경 대비 직접 INSERT)
INSERT INTO public.profiles (id, nickname, role)
VALUES
  (current_setting('test.u1')::uuid, 'nick1', 'USER'),
  (current_setting('test.u2')::uuid, 'nick2', 'USER'),
  (current_setting('test.u3')::uuid, 'nick3', 'USER'),
  (current_setting('test.u4')::uuid, 'nick4', 'USER'),
  (current_setting('test.u5')::uuid, 'nick5', 'USER'),
  (current_setting('test.u6')::uuid, 'nick6', 'USER')
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- nickname을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.u1_t0',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u1')::uuid),
  true
);

UPDATE public.profiles
SET nickname = 'n1a'
WHERE id = current_setting('test.u1')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u1_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u1')::uuid),
  'nickname을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- avatar_url을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다
SELECT set_config(
  'test.u2_t0',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u2')::uuid),
  true
);

UPDATE public.profiles
SET avatar_url = 'https://example.com/a.png'
WHERE id = current_setting('test.u2')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u2_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u2')::uuid),
  'avatar_url을 다른 값으로 UPDATE하면 updated_at이 이전 값보다 커야 한다'
);

-- [예외 조건]
-- 없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)
SELECT ok(
  true,
  '없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)'
);

-- [경계 조건]
-- 동일한 값으로 UPDATE하면 updated_at이 변경되지 않아야 한다
SELECT set_config(
  'test.u5_t0',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u5')::uuid),
  true
);

UPDATE public.profiles
SET nickname = nickname
WHERE id = current_setting('test.u5')::uuid;

SELECT is(
  (SELECT updated_at FROM public.profiles WHERE id = current_setting('test.u5')::uuid),
  current_setting('test.u5_t0')::timestamptz,
  '동일한 값으로 UPDATE하면 updated_at이 변경되지 않아야 한다'
);

-- [불변 조건]
-- updated_at은 created_at보다 항상 크거나 같아야 한다 (Status)
SELECT ok(
  (SELECT count(*) FROM public.profiles WHERE updated_at < created_at) = 0,
  'updated_at은 created_at보다 항상 크거나 같아야 한다 (Status)'
);

-- 실제 변경이 발생한 UPDATE 후 new.updated_at > old.updated_at이어야 한다 (Transition)
SELECT set_config(
  'test.u6_t0',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u6')::uuid),
  true
);

UPDATE public.profiles
SET nickname = 'n6a'
WHERE id = current_setting('test.u6')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u6_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u6')::uuid),
  '실제 변경이 발생한 UPDATE 후 new.updated_at > old.updated_at이어야 한다 (Transition)'
);

-- 동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)
SELECT set_config(
  'test.u4_t0',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u4')::uuid),
  true
);

UPDATE public.profiles
SET nickname = nickname
WHERE id = current_setting('test.u4')::uuid;

SELECT is(
  (SELECT updated_at FROM public.profiles WHERE id = current_setting('test.u4')::uuid),
  current_setting('test.u4_t0')::timestamptz,
  '동일한 값으로 UPDATE한 후 new.updated_at = old.updated_at이어야 한다 (Transition)'
);

SELECT * FROM finish();
ROLLBACK;
