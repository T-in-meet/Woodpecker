-- =========================================
-- quizzes / RLS
-- =========================================

BEGIN;

SELECT plan(9);

-- 테스트용 UUID 준비
SELECT set_config('test.quizzes_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.quizzes_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.quizzes_rls_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.quizzes_rls_note_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.quizzes_rls_quiz_b_id', gen_random_uuid()::text, true);

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
    current_setting('test.quizzes_rls_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quiz_user_a_' || current_setting('test.quizzes_rls_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.quizzes_rls_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quiz_user_b_' || current_setting('test.quizzes_rls_user_b_id') || '@example.com',
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
    current_setting('test.quizzes_rls_note_a_id')::uuid,
    current_setting('test.quizzes_rls_user_a_id')::uuid,
    'note a',
    'content a',
    0
  ),
  (
    current_setting('test.quizzes_rls_note_b_id')::uuid,
    current_setting('test.quizzes_rls_user_b_id')::uuid,
    'note b',
    'content b',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- user_b 소유 퀴즈 (RLS 우회 상태에서 미리 넣어 둔다)
INSERT INTO public.quizzes (id, note_id, user_id, quiz_type, questions, note_content_hash)
VALUES (
  current_setting('test.quizzes_rls_quiz_b_id')::uuid,
  current_setting('test.quizzes_rls_note_b_id')::uuid,
  current_setting('test.quizzes_rls_user_b_id')::uuid,
  'ox',
  '{"questions":[]}'::jsonb,
  'hash-b'
)
ON CONFLICT (note_id, quiz_type) DO NOTHING;

-- [정답 조건]
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.quizzes_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- user_a로 인증 후 본인 노트에 대한 quiz를 INSERT할 수 있어야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.quizzes (note_id, user_id, quiz_type, questions, note_content_hash)
      VALUES ('%s'::uuid, '%s'::uuid, 'ox', '{"questions":[]}'::jsonb, 'hash-a');
    $sql$,
    current_setting('test.quizzes_rls_note_a_id'),
    current_setting('test.quizzes_rls_user_a_id')
  ),
  $$user_a로 인증 후 본인 노트에 대한 quiz를 INSERT할 수 있어야 한다$$
);

-- 같은 노트라도 유형이 다르면 별도 행으로 저장되어야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.quizzes (note_id, user_id, quiz_type, questions, note_content_hash)
      VALUES ('%s'::uuid, '%s'::uuid, 'choice', '{"questions":[]}'::jsonb, 'hash-a');
    $sql$,
    current_setting('test.quizzes_rls_note_a_id'),
    current_setting('test.quizzes_rls_user_a_id')
  ),
  $$같은 노트라도 유형이 다르면 별도 행으로 저장되어야 한다$$
);

-- user_a로 인증 후 본인 quiz를 SELECT하면 유형별로 각각 반환되어야 한다
SELECT is(
  (SELECT count(*) FROM public.quizzes WHERE note_id = current_setting('test.quizzes_rls_note_a_id')::uuid),
  2::bigint,
  $$user_a로 인증 후 본인 quiz를 SELECT하면 유형별로 각각 반환되어야 한다$$
);

-- user_a로 인증 후 본인 quiz를 UPDATE할 수 있어야 한다
WITH updated AS (
  UPDATE public.quizzes
  SET note_content_hash = 'hash-a-updated'
  WHERE note_id = current_setting('test.quizzes_rls_note_a_id')::uuid
    AND quiz_type = 'ox'
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  $$user_a로 인증 후 본인 quiz를 UPDATE할 수 있어야 한다$$
);

-- 같은 note_id·유형으로 quiz를 다시 INSERT하면 unique 제약에 걸려야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.quizzes (note_id, user_id, quiz_type, questions, note_content_hash)
      VALUES ('%s'::uuid, '%s'::uuid, 'ox', '{"questions":[]}'::jsonb, 'hash-a-dup');
    $sql$,
    current_setting('test.quizzes_rls_note_a_id'),
    current_setting('test.quizzes_rls_user_a_id')
  ),
  '23505',
  NULL,
  $$같은 note_id·유형으로 quiz를 다시 INSERT하면 unique 제약에 걸려야 한다$$
);

-- [예외 조건]

-- user_a로 인증 후 user_b의 노트에 대한 quiz를 본인 명의로 INSERT할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.quizzes (note_id, user_id, quiz_type, questions, note_content_hash)
      VALUES ('%s'::uuid, '%s'::uuid, 'ox', '{"questions":[]}'::jsonb, 'hijack');
    $sql$,
    current_setting('test.quizzes_rls_note_b_id'),
    current_setting('test.quizzes_rls_user_a_id')
  ),
  '42501',
  NULL,
  $$user_a로 인증 후 user_b의 노트에 대한 quiz를 본인 명의로 INSERT할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 quiz를 SELECT해도 반환되면 안 된다
SELECT is(
  (SELECT count(*) FROM public.quizzes WHERE note_id = current_setting('test.quizzes_rls_note_b_id')::uuid),
  0::bigint,
  $$user_a로 인증 후 user_b의 quiz를 SELECT해도 반환되면 안 된다$$
);

-- user_a로 인증 후 user_b의 quiz를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.quizzes
  SET note_content_hash = 'blocked'
  WHERE note_id = current_setting('test.quizzes_rls_note_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$user_a로 인증 후 user_b의 quiz를 UPDATE할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 quiz를 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.quizzes
  WHERE note_id = current_setting('test.quizzes_rls_note_b_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$user_a로 인증 후 user_b의 quiz를 DELETE할 수 없어야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
