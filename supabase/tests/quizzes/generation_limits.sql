-- =========================================
-- quiz_generations / 사용량 제한 RPC
-- =========================================

BEGIN;

SELECT plan(9);

-- 테스트용 UUID 준비
SELECT set_config('test.quiz_gen_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.quiz_gen_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.quiz_gen_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.quiz_gen_note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.quiz_gen_note_b_id', gen_random_uuid()::text, true);

-- seed
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
    current_setting('test.quiz_gen_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quiz_gen_a_' || current_setting('test.quiz_gen_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.quiz_gen_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quiz_gen_b_' || current_setting('test.quiz_gen_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.quiz_gen_note_a_id')::uuid,
    current_setting('test.quiz_gen_user_a_id')::uuid,
    'note a',
    'content a',
    0
  ),
  (
    current_setting('test.quiz_gen_note_a2_id')::uuid,
    current_setting('test.quiz_gen_user_a_id')::uuid,
    'note a2',
    'content a2',
    0
  ),
  (
    current_setting('test.quiz_gen_note_b_id')::uuid,
    current_setting('test.quiz_gen_user_b_id')::uuid,
    'note b',
    'content b',
    0
  )
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.quiz_gen_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- [정답 조건]

-- 본인 노트에 대한 첫 요청은 ok를 반환해야 한다
SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_a_id')::uuid,
    'ox'
  ),
  'ok',
  $$본인 노트에 대한 첫 요청은 ok를 반환해야 한다$$
);

-- ok 반환 시 quiz_generations에 기록이 남아야 한다
SELECT is(
  (SELECT count(*) FROM public.quiz_generations
   WHERE note_id = current_setting('test.quiz_gen_note_a_id')::uuid),
  1::bigint,
  $$ok 반환 시 quiz_generations에 기록이 남아야 한다$$
);

-- 같은 노트라도 유형이 다르면 중복 요청으로 보지 않아야 한다
SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_a_id')::uuid,
    'blank'
  ),
  'ok',
  $$같은 노트라도 유형이 다르면 중복 요청으로 보지 않아야 한다$$
);

-- release 후에는 기록이 줄어야 한다
SELECT public.release_quiz_generation(
  current_setting('test.quiz_gen_note_a_id')::uuid,
  'blank'
);
SELECT is(
  (SELECT count(*) FROM public.quiz_generations
   WHERE note_id = current_setting('test.quiz_gen_note_a_id')::uuid
     AND quiz_type = 'blank'),
  0::bigint,
  $$release 후에는 기록이 줄어야 한다$$
);

-- [예외 조건]

-- 같은 노트·유형을 곧바로 다시 요청하면 in_flight를 반환해야 한다
SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_a_id')::uuid,
    'ox'
  ),
  'in_flight',
  $$같은 노트·유형을 곧바로 다시 요청하면 in_flight를 반환해야 한다$$
);

-- 타인 노트로 요청하면 not_found를 반환해야 한다
SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_b_id')::uuid,
    'ox'
  ),
  'not_found',
  $$타인 노트로 요청하면 not_found를 반환해야 한다$$
);

-- 타인 노트 요청은 quiz_generations에 기록을 남기지 않아야 한다
SELECT is(
  (SELECT count(*) FROM public.quiz_generations
   WHERE note_id = current_setting('test.quiz_gen_note_b_id')::uuid),
  0::bigint,
  $$타인 노트 요청은 quiz_generations에 기록을 남기지 않아야 한다$$
);

-- 60초 안에 5회를 채우면 too_many_requests를 반환해야 한다
-- (위에서 ox 1건이 남아 있으므로 4건을 더 채운다)
INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, created_at)
SELECT
  current_setting('test.quiz_gen_user_a_id')::uuid,
  current_setting('test.quiz_gen_note_a2_id')::uuid,
  'burst_' || i,
  now() - interval '5 seconds'
FROM generate_series(1, 4) AS i;

SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_a2_id')::uuid,
    'choice'
  ),
  'too_many_requests',
  $$60초 안에 5회를 채우면 too_many_requests를 반환해야 한다$$
);

-- 버스트 윈도우를 벗어난 기록이 30건이면 daily_exceeded를 반환해야 한다
UPDATE public.quiz_generations
SET created_at = now() - interval '2 minutes'
WHERE user_id = current_setting('test.quiz_gen_user_a_id')::uuid;

INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, created_at)
SELECT
  current_setting('test.quiz_gen_user_a_id')::uuid,
  current_setting('test.quiz_gen_note_a2_id')::uuid,
  'daily_' || i,
  now() - interval '2 minutes'
FROM generate_series(1, 25) AS i;

SELECT is(
  public.claim_quiz_generation(
    current_setting('test.quiz_gen_note_a2_id')::uuid,
    'choice'
  ),
  'daily_exceeded',
  $$하루 30회를 채우면 daily_exceeded를 반환해야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
