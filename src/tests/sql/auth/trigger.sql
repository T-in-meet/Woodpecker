-- =========================================
-- auth.users / TRIGGER
-- =========================================

BEGIN;

SELECT plan(23);

-- 테스트 데이터 준비: auth.users UUID를 미리 생성해 관리
-- (auth.users는 set_config 방식으로 ID를 참조하기 어려워 temp table 사용)
CREATE TEMP TABLE _test_ids (
  label text PRIMARY KEY,
  id uuid NOT NULL
);

INSERT INTO _test_ids (label, id) VALUES
  ('u1', gen_random_uuid()),
  ('u2', gen_random_uuid()),
  ('u3', gen_random_uuid()),
  ('u5', gen_random_uuid()),
  ('u6', gen_random_uuid()),
  ('u7', gen_random_uuid()),
  ('u9', gen_random_uuid()),
  ('u10', gen_random_uuid());

-- [정답 조건]
-- auth.users에 새 사용자가 생성되면 profiles가 자동 생성되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u1'),
    (SELECT 'u1_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u1'),
    '{"nickname":"neo","avatar_url":"https://example.com/a.png"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'auth.users에 새 사용자가 생성되면 INSERT가 성공해야 한다');

-- profiles가 자동으로 생성되어야 한다
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  1::bigint,
  'auth.users INSERT 후 profiles가 자동 생성되어야 한다'
);

-- profiles.id가 auth.users.id와 동일해야 한다
SELECT is(
  (SELECT id::text FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  (SELECT id::text FROM _test_ids WHERE label = 'u1'),
  'profiles.id는 auth.users.id와 동일해야 한다'
);

-- raw_user_meta_data.nickname이 있으면 profiles.nickname에 저장되어야 한다
SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  'neo',
  'raw_user_meta_data.nickname이 있으면 profiles.nickname에 저장되어야 한다'
);

-- raw_user_meta_data.avatar_url이 있으면 profiles.avatar_url에 저장되어야 한다
SELECT is(
  (SELECT avatar_url FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  'https://example.com/a.png',
  'raw_user_meta_data.avatar_url이 있으면 profiles.avatar_url에 저장되어야 한다'
);

-- nickname이 없어도 INSERT가 성공하고 profiles가 생성되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u2'),
    (SELECT 'u2_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u2'),
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'nickname이 없어도 INSERT가 성공해야 한다');

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u2')),
  1::bigint,
  'nickname이 없어도 profiles가 생성되어야 한다'
);

-- avatar_url이 없어도 INSERT가 성공하고 profiles가 생성되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u3'),
    (SELECT 'u3_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u3'),
    '{"nickname":"ava"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'avatar_url이 없어도 INSERT가 성공해야 한다');

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u3')),
  1::bigint,
  'avatar_url이 없어도 profiles가 생성되어야 한다'
);

-- raw_user_meta_data가 NULL이어도 INSERT가 성공하고 profiles가 생성되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u9'),
    (SELECT 'u9_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u9'),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'raw_user_meta_data가 NULL이어도 INSERT가 성공해야 한다');

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u9')),
  1::bigint,
  'raw_user_meta_data가 NULL이어도 profiles가 생성되어야 한다'
);

-- raw_user_meta_data.nickname이 NULL이어도 INSERT가 성공하고 profiles가 생성되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u10'),
    (SELECT 'u10_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u10'),
    '{"nickname":null}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'raw_user_meta_data.nickname이 NULL이어도 INSERT가 성공해야 한다');

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u10')),
  1::bigint,
  'raw_user_meta_data.nickname이 NULL이어도 profiles가 생성되어야 한다'
);

-- [예외 조건]
-- 없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)
SELECT ok(
  true,
  '없음 (이 트리거는 잘못된 입력을 거부하는 정책이 아니라, 입력을 교정/정규화하는 정책이다)'
);

-- [경계 조건]
-- nickname이 없는 경우 fallback nickname이 자동 생성되어야 한다
SELECT ok(
  (SELECT nickname IS NOT NULL AND length(nickname) > 0
   FROM public.profiles
   WHERE id = (SELECT id FROM _test_ids WHERE label = 'u2')),
  'nickname이 없는 경우 fallback nickname이 자동 생성되어야 한다'
);

-- nickname이 최소 길이(1자)일 때 정상 저장되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u5'),
    (SELECT 'u5_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u5'),
    '{"nickname":"a"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'nickname이 최소 길이(1자)일 때 INSERT가 성공해야 한다');

SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u5')),
  'a',
  'nickname이 최소 길이(1자)일 때 profiles.nickname에 정상 저장되어야 한다'
);

-- nickname이 최대 길이(10자)일 때 정상 저장되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u6'),
    (SELECT 'u6_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u6'),
    '{"nickname":"abcdefghij"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'nickname이 최대 길이(10자)일 때 INSERT가 성공해야 한다');

SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u6')),
  'abcdefghij',
  'nickname이 최대 길이(10자)일 때 profiles.nickname에 정상 저장되어야 한다'
);

-- avatar_url이 null일 때 profiles.avatar_url도 null로 저장되어야 한다
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u7'),
    (SELECT 'u7_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u7'),
    '{"nickname":"nullava","avatar_url":null}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
$$, 'avatar_url이 null일 때 INSERT가 성공해야 한다');

SELECT is(
  (SELECT avatar_url IS NULL FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u7')),
  true,
  'avatar_url이 null일 때 profiles.avatar_url도 null로 저장되어야 한다'
);

-- [불변 조건]
-- profiles는 항상 auth.users와 1:1 관계를 유지해야 한다
SELECT is(
  (SELECT count(*) FROM public.profiles p
   WHERE p.id IN (SELECT id FROM _test_ids)),
  (SELECT count(*) FROM auth.users u
   WHERE u.id IN (SELECT id FROM _test_ids)),
  'profiles는 auth.users와 항상 1:1 관계를 유지해야 한다'
);

-- profiles.id는 항상 유효한 auth.users.id를 참조해야 한다
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   LEFT JOIN auth.users u ON u.id = p.id
   WHERE u.id IS NULL),
  0::bigint,
  'profiles.id는 항상 유효한 auth.users.id를 참조해야 한다'
);

SELECT * FROM finish();
ROLLBACK;
