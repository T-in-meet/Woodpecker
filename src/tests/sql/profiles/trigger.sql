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

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.u1')::uuid, 'u1_' || current_setting('test.u1') || '@example.com', '{}'::jsonb),
  (current_setting('test.u2')::uuid, 'u2_' || current_setting('test.u2') || '@example.com', '{}'::jsonb),
  (current_setting('test.u3')::uuid, 'u3_' || current_setting('test.u3') || '@example.com', '{}'::jsonb),
  (current_setting('test.u4')::uuid, 'u4_' || current_setting('test.u4') || '@example.com', '{}'::jsonb),
  (current_setting('test.u5')::uuid, 'u5_' || current_setting('test.u5') || '@example.com', '{}'::jsonb),
  (current_setting('test.u6')::uuid, 'u6_' || current_setting('test.u6') || '@example.com', '{}'::jsonb);

-- [정답 조건]
-- profile 수정 시 updated_at이 갱신되어야 한다.
SELECT set_config('test.u1_t0', clock_timestamp()::text, true);

UPDATE public.profiles
SET nickname = 'n1a'
WHERE id = current_setting('test.u1')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u1_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u1')::uuid),
  'profile 수정 시 updated_at 갱신'
);

-- [예외 조건]
-- 수정이 발생했는데 updated_at이 그대로면 안 된다.
SELECT set_config('test.u2_t0', clock_timestamp()::text, true);

UPDATE public.profiles
SET nickname = 'n2a', avatar_url = 'https://example.com/a.png'
WHERE id = current_setting('test.u2')::uuid;

SELECT isnt(
  (SELECT updated_at FROM public.profiles WHERE id = current_setting('test.u2')::uuid),
  current_setting('test.u2_t0')::timestamptz,
  '수정 발생 시 updated_at 고정 불가'
);

-- [경계 조건]
-- 한 컬럼만 수정해도 updated_at은 갱신되어야 한다.
SELECT set_config('test.u3_t0', clock_timestamp()::text, true);

UPDATE public.profiles
SET nickname = 'n3a'
WHERE id = current_setting('test.u3')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u3_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u3')::uuid),
  '단일 컬럼 수정 시 updated_at 갱신'
);

-- 여러 컬럼을 동시에 수정해도 updated_at은 정상 갱신되어야 한다.
SELECT set_config('test.u4_t0', clock_timestamp()::text, true);

UPDATE public.profiles
SET nickname = 'n4a', avatar_url = 'https://example.com/b.png'
WHERE id = current_setting('test.u4')::uuid;

SELECT ok(
  (SELECT updated_at > current_setting('test.u4_t0')::timestamptz
   FROM public.profiles WHERE id = current_setting('test.u4')::uuid),
  '다중 컬럼 수정 시 updated_at 갱신'
);

-- 동일한 값으로 UPDATE한 경우에는 updated_at이 갱신되면 안 된다.
SELECT set_config('test.u5_t0', (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u5')::uuid), true);

UPDATE public.profiles
SET nickname = nickname
WHERE id = current_setting('test.u5')::uuid;

SELECT is(
  (SELECT updated_at FROM public.profiles WHERE id = current_setting('test.u5')::uuid),
  current_setting('test.u5_t0')::timestamptz,
  '동일 값 UPDATE 시 updated_at 미변경'
);

-- [불변 조건]
-- 실제 변경이 발생한 경우에만 updated_at은 최신 시각으로 유지되어야 한다.
SELECT set_config('test.u6_t0', clock_timestamp()::text, true);

UPDATE public.profiles
SET nickname = 'n6a'
WHERE id = current_setting('test.u6')::uuid;

SELECT set_config(
  'test.u6_t1',
  (SELECT updated_at::text FROM public.profiles WHERE id = current_setting('test.u6')::uuid),
  true
);

SELECT ok(
  (SELECT current_setting('test.u6_t1')::timestamptz > current_setting('test.u6_t0')::timestamptz),
  '실제 변경 시 updated_at 갱신'
);

UPDATE public.profiles
SET nickname = nickname
WHERE id = current_setting('test.u6')::uuid;

SELECT is(
  (SELECT updated_at FROM public.profiles WHERE id = current_setting('test.u6')::uuid),
  current_setting('test.u6_t1')::timestamptz,
  '실제 변경 없으면 updated_at 유지'
);

SELECT * FROM finish();

ROLLBACK;