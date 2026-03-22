-- =========================================
-- notes / RLS
-- =========================================

BEGIN;

SELECT plan(15);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a_select_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a_delete_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_b_select_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_b_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_b_delete_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a_single_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_invalid_id', gen_random_uuid()::text, true);

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

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round,
  next_review_at
)
VALUES
  (
    current_setting('test.note_a_select_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'note a select',
    'content a select',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.note_a_update_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'note a update',
    'content a update',
    0,
    now() + interval '2 days'
  ),
  (
    current_setting('test.note_a_delete_id')::uuid,
    current_setting('test.user_a_id')::uuid,
    'note a delete',
    'content a delete',
    0,
    now() + interval '3 days'
  ),
  (
    current_setting('test.note_b_select_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'note b select',
    'content b select',
    0,
    now() + interval '4 days'
  ),
  (
    current_setting('test.note_b_update_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'note b update',
    'content b update',
    0,
    now() + interval '5 days'
  ),
  (
    current_setting('test.note_b_delete_id')::uuid,
    current_setting('test.user_b_id')::uuid,
    'note b delete',
    'content b delete',
    0,
    now() + interval '6 days'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- user_a로 인증 후 user_a의 노트를 SELECT하면 해당 행이 반환된다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notes WHERE id = current_setting('test.note_a_select_id')::uuid),
  1::bigint,
  'user_a로 인증 후 user_a의 노트를 SELECT하면 해당 행이 반환된다'
);

-- user_a로 인증 후 user_a의 노트를 UPDATE할 수 있어야 한다
SAVEPOINT notes_update_own;

WITH updated AS (
  UPDATE public.notes
  SET title = title || ' updated'
  WHERE id = current_setting('test.note_a_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'user_a로 인증 후 user_a의 노트를 UPDATE할 수 있어야 한다'
);

ROLLBACK TO SAVEPOINT notes_update_own;

-- user_a로 인증 후 user_a의 노트를 DELETE할 수 있어야 한다
SAVEPOINT notes_delete_own;

WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.note_a_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  1::bigint,
  'user_a로 인증 후 user_a의 노트를 DELETE할 수 있어야 한다'
);

ROLLBACK TO SAVEPOINT notes_delete_own;

-- [예외 조건]
-- user_a로 인증 후 user_b의 노트를 SELECT할 수 없어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE id = current_setting('test.note_b_select_id')::uuid),
  0::bigint,
  'user_a로 인증 후 user_b의 노트를 SELECT할 수 없어야 한다'
);

-- user_a로 인증 후 user_b의 노트를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'blocked'
  WHERE id = current_setting('test.note_b_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'user_a로 인증 후 user_b의 노트를 UPDATE할 수 없어야 한다'
);

-- user_a로 인증 후 user_b의 노트를 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.note_b_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  'user_a로 인증 후 user_b의 노트를 DELETE할 수 없어야 한다'
);

-- user_a로 인증 후 user_id를 user_b로 설정하여 INSERT를 시도하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'blocked', 'blocked', 0);
    $sql$,
    current_setting('test.note_invalid_id'),
    current_setting('test.user_b_id')
  ),
  '42501',
  'new row violates row-level security policy for table "notes"',
  'user_a로 인증 후 user_id를 user_b로 설정하여 INSERT를 시도하면 실패해야 한다'
);

-- 인증되지 않은 상태(anon)에서 SELECT하면 어떤 행도 반환되지 않는다
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  '인증되지 않은 상태(anon)에서 SELECT하면 어떤 행도 반환되지 않는다'
);

-- [경계 조건]
-- user_a의 노트가 0개일 때 전체 조회 결과는 0개여야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SAVEPOINT notes_boundary_zero;
DELETE FROM public.notes
WHERE user_id = current_setting('test.user_a_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  'user_a의 노트가 0개일 때 전체 조회 결과는 0개여야 한다'
);

ROLLBACK TO SAVEPOINT notes_boundary_zero;

-- user_a의 노트가 1개일 때 전체 조회 결과는 정확히 1개여야 한다
SAVEPOINT notes_boundary_one;
DELETE FROM public.notes
WHERE user_id = current_setting('test.user_a_id')::uuid;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES (
  current_setting('test.note_a_single_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'note a single',
  'content a single',
  0
)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT count(*) FROM public.notes),
  1::bigint,
  'user_a의 노트가 1개일 때 전체 조회 결과는 정확히 1개여야 한다'
);

ROLLBACK TO SAVEPOINT notes_boundary_one;

-- user_a의 노트가 여러 개일 때 전체 조회 결과는 본인 행 3개여야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  3::bigint,
  'user_a의 노트가 여러 개일 때 전체 조회 결과는 본인 행 3개여야 한다'
);

-- [불변 조건]
-- 인증된 사용자의 전체 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.user_a_id')::uuid),
  3::bigint,
  '인증된 사용자의 전체 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다'
);

-- 인증된 사용자의 전체 조회 결과에는 타인 데이터가 0개여야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id <> current_setting('test.user_a_id')::uuid),
  0::bigint,
  '인증된 사용자의 전체 조회 결과에는 타인 데이터가 0개여야 한다'
);

-- 인증된 사용자의 전체 조회 결과에는 user_b의 notes가 0개여야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.user_b_id')::uuid),
  0::bigint,
  '인증된 사용자의 전체 조회 결과에는 user_b의 notes가 0개여야 한다'
);

-- anon 상태에서는 notes 행이 0개여야 한다
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  'anon 상태에서는 notes 행이 0개여야 한다'
);

SELECT * FROM finish();
ROLLBACK;