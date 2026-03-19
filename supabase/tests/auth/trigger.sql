-- =========================================
-- auth.users / TRIGGER
-- =========================================

BEGIN;

SELECT plan(22);

-- 테스트 데이터 준비: 사용자 ID 목록
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
  ('u8', gen_random_uuid()),
  ('u9', gen_random_uuid()),
  ('u10', gen_random_uuid());

-- [정답 조건]
-- auth.users에 새 사용자가 생성되면 profiles가 자동 생성되어야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u1'),
    (SELECT 'u1_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u1'),
    '{"nickname":"neo","avatar_url":"https://example.com/a.png"}'::jsonb
  );
$$, '정상 입력 시 auth.users insert 성공');

-- profiles가 생성되었는지 확인
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  1::bigint,
  'profiles 자동 생성됨'
);

-- profiles.id가 auth.users.id와 동일해야 한다.
SELECT is(
  (SELECT id::text FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  (SELECT id::text FROM _test_ids WHERE label = 'u1'),
  'profiles.id = auth.users.id'
);

-- raw_user_meta_data.nickname이 있으면 profiles.nickname에 저장되어야 한다.
SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  'neo',
  'nickname이 profiles에 저장됨'
);

-- raw_user_meta_data.avatar_url이 있으면 profiles.avatar_url에 저장되어야 한다.
SELECT is(
  (SELECT avatar_url FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u1')),
  'https://example.com/a.png',
  'avatar_url이 profiles에 저장됨'
);

-- [예외 조건]
-- nickname이 없을 때 트리거가 실패하면 안 된다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u2'),
    (SELECT 'u2_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u2'),
    '{}'::jsonb
  );
$$, 'nickname 누락 시에도 insert 성공');

-- nickname 누락 케이스에서도 profiles가 생성되어야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u2')),
  1::bigint,
  'nickname 누락 시에도 profiles 생성됨'
);

-- avatar_url이 없을 때 트리거가 실패하면 안 된다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u3'),
    (SELECT 'u3_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u3'),
    '{"nickname":"ava"}'::jsonb
  );
$$, 'avatar_url 누락 시에도 insert 성공');

-- avatar_url 누락 케이스에서도 profiles가 생성되어야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u3')),
  1::bigint,
  'avatar_url 누락 시에도 profiles 생성됨'
);

-- raw_user_meta_data가 NULL이어도 insert가 성공해야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u9'),
    (SELECT 'u9_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u9'),
    NULL
  );
$$, 'raw_user_meta_data NULL이어도 insert 성공');

-- raw_user_meta_data가 NULL이어도 profiles가 생성되어야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u9')),
  1::bigint,
  'raw_user_meta_data NULL이어도 profiles 생성됨'
);

-- raw_user_meta_data.nickname이 NULL이어도 insert가 성공해야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u10'),
    (SELECT 'u10_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u10'),
    '{"nickname":null}'::jsonb
  );
$$, 'nickname NULL이어도 insert 성공');

-- raw_user_meta_data.nickname이 NULL이어도 profiles가 생성되어야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u10')),
  1::bigint,
  'nickname NULL이어도 profiles 생성됨'
);


-- [경계 조건]
-- nickname이 없는 경우 기본 닉네임 fallback이 정상 생성되어야 한다.
SELECT ok(
  (SELECT nickname IS NOT NULL AND length(nickname) > 0
   FROM public.profiles
   WHERE id = (SELECT id FROM _test_ids WHERE label = 'u2')),
  'fallback nickname이 생성됨'
);

-- nickname이 최소 길이 근처일 때도 정상 동작해야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u5'),
    (SELECT 'u5_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u5'),
    '{"nickname":"a"}'::jsonb
  );
$$, 'nickname 최소 길이 입력 시 insert 성공');

SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u5')),
  'a',
  'nickname 최소 길이 저장됨'
);

-- nickname이 최대 길이 근처일 때도 정상 동작해야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u6'),
    (SELECT 'u6_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u6'),
    '{"nickname":"abcdefghij"}'::jsonb
  );
$$, 'nickname 최대 길이 입력 시 insert 성공');

SELECT is(
  (SELECT nickname FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u6')),
  'abcdefghij',
  'nickname 최대 길이 저장됨'
);

-- avatar_url이 null일 때도 insert가 가능해야 한다.
SELECT lives_ok($$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    (SELECT id FROM _test_ids WHERE label = 'u7'),
    (SELECT 'u7_' || id::text || '@example.com' FROM _test_ids WHERE label = 'u7'),
    '{"nickname":"nullava","avatar_url":null}'::jsonb
  );
$$, 'avatar_url이 null이어도 insert 성공');

SELECT is(
  (SELECT avatar_url IS NULL FROM public.profiles WHERE id = (SELECT id FROM _test_ids WHERE label = 'u7')),
  true,
  'avatar_url이 null로 저장됨'
);

-- TODO: nickname이 빈 문자열('')일 때 처리 정책 확정 필요
-- TODO: nickname 최대 길이 및 초과 처리 정책 확정 필요

-- [불변 조건]
-- profiles는 항상 auth.users와 1:1 관계를 유지해야 한다.
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id IN (
     (SELECT id FROM _test_ids WHERE label IN ('u1','u2','u3','u5','u6','u7'))
   )),
  (SELECT count(*) FROM auth.users WHERE id IN (
     (SELECT id FROM _test_ids WHERE label IN ('u1','u2','u3','u5','u6','u7'))
   )),
  'profiles와 auth.users의 1:1 관계 유지'
);

-- profiles.id는 항상 유효한 auth.users.id를 참조해야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.profiles p
   WHERE p.id IN (SELECT id FROM _test_ids WHERE label IN ('u1','u2','u3','u5','u6','u7'))
     AND NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id = p.id
     )
  ),
  0::bigint,
  'profiles.id는 항상 auth.users.id를 참조'
);

SELECT * FROM finish();
ROLLBACK;


