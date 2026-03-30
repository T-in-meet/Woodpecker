-- =========================================
-- notes / RLS
-- =========================================

BEGIN;

SELECT plan(32);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_a_select_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_a_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_a_delete_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_b_select_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_b_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_b_delete_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_invalid_authenticated_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_invalid_zero_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_invalid_one_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_invalid_many_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_invalid_anon_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_state_one_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_state_many_1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_state_many_2_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rls_note_state_many_3_id', gen_random_uuid()::text, true);

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
    current_setting('test.notes_rls_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notes_rls_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notes_rls_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.notes_rls_user_b_id') || '@example.com',
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
    current_setting('test.notes_rls_note_a_select_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note a select',
    'content a select',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.notes_rls_note_a_update_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note a update',
    'content a update',
    0,
    now() + interval '2 days'
  ),
  (
    current_setting('test.notes_rls_note_a_delete_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note a delete',
    'content a delete',
    0,
    now() + interval '3 days'
  ),
  (
    current_setting('test.notes_rls_note_b_select_id')::uuid,
    current_setting('test.notes_rls_user_b_id')::uuid,
    'note b select',
    'content b select',
    0,
    now() + interval '4 days'
  ),
  (
    current_setting('test.notes_rls_note_b_update_id')::uuid,
    current_setting('test.notes_rls_user_b_id')::uuid,
    'note b update',
    'content b update',
    0,
    now() + interval '5 days'
  ),
  (
    current_setting('test.notes_rls_note_b_delete_id')::uuid,
    current_setting('test.notes_rls_user_b_id')::uuid,
    'note b delete',
    'content b delete',
    0,
    now() + interval '6 days'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- user_a로 인증 후 user_a의 notes를 조건 없이 SELECT하면 본인 소유 행만 반환되어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  3::bigint,
  $$user_a로 인증 후 user_a의 notes를 조건 없이 SELECT하면 본인 소유 행만 반환되어야 한다$$
);

-- user_a로 인증 후 user_a의 특정 note를 조건 조회하면 해당 행이 반환되어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE id = current_setting('test.notes_rls_note_a_select_id')::uuid),
  1::bigint,
  $$user_a로 인증 후 user_a의 특정 note를 조건 조회하면 해당 행이 반환되어야 한다$$
);

-- user_a로 인증 후 user_a 명의(user_id = user_a)로 note를 INSERT할 수 있어야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'insert own', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_user_a_id')
  ),
  $$user_a로 인증 후 user_a 명의(user_id = user_a)로 note를 INSERT할 수 있어야 한다$$
);

-- user_a로 인증 후 user_a의 note를 UPDATE할 수 있어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'note a update allowed'
  WHERE id = current_setting('test.notes_rls_note_a_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  $$user_a로 인증 후 user_a의 note를 UPDATE할 수 있어야 한다$$
);

-- user_a로 인증 후 user_a의 note를 DELETE할 수 있어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.notes_rls_note_a_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  1::bigint,
  $$user_a로 인증 후 user_a의 note를 DELETE할 수 있어야 한다$$
);

-- [예외 조건]
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- user_a로 인증 후 user_b의 notes를 조건 없이 SELECT해도 반환되면 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.notes_rls_user_b_id')::uuid),
  0::bigint,
  $$user_a로 인증 후 user_b의 notes를 조건 없이 SELECT해도 반환되면 안 된다$$
);

-- user_a로 인증 후 user_b의 특정 note를 조건 조회해도 반환되면 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE id = current_setting('test.notes_rls_note_b_select_id')::uuid),
  0::bigint,
  $$user_a로 인증 후 user_b의 특정 note를 조건 조회해도 반환되면 안 된다$$
);

-- user_a로 인증 후 user_b 명의(user_id = user_b)로 note를 INSERT할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'blocked', 'blocked', 0);
    $sql$,
    current_setting('test.notes_rls_note_invalid_authenticated_id'),
    current_setting('test.notes_rls_user_b_id')
  ),
  '42501',
  NULL,
  $$user_a로 인증 후 user_b 명의(user_id = user_b)로 note를 INSERT할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 note를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'blocked'
  WHERE id = current_setting('test.notes_rls_note_b_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$user_a로 인증 후 user_b의 note를 UPDATE할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 note를 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.notes_rls_note_b_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$user_a로 인증 후 user_b의 note를 DELETE할 수 없어야 한다$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

-- anon 상태에서는 notes를 SELECT할 수 없어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  $$anon 상태에서는 notes를 SELECT할 수 없어야 한다$$
);

-- anon 상태에서는 notes를 INSERT할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'anon blocked', 'anon blocked', 0);
    $sql$,
    current_setting('test.notes_rls_note_invalid_anon_id'),
    current_setting('test.notes_rls_user_a_id')
  ),
  '42501',
  NULL,
  $$anon 상태에서는 notes를 INSERT할 수 없어야 한다$$
);

-- anon 상태에서는 notes를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'anon blocked'
  WHERE id = current_setting('test.notes_rls_note_b_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$anon 상태에서는 notes를 UPDATE할 수 없어야 한다$$
);

-- anon 상태에서는 notes를 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.notes_rls_note_b_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$anon 상태에서는 notes를 DELETE할 수 없어야 한다$$
);

-- [경계 조건]
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

DELETE FROM public.notes
WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid;

-- user_a 소유 notes가 0건이고 user_b 소유 notes만 존재할 때, user_a의 조건 없는 SELECT 결과는 빈 집합이어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  $$user_a 소유 notes가 0건이고 user_b 소유 notes만 존재할 때, user_a의 조건 없는 SELECT 결과는 빈 집합이어야 한다$$
);

-- user_a 소유 notes가 0건일 때, user_a는 user_b의 note를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'zero blocked'
  WHERE id = current_setting('test.notes_rls_note_b_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$user_a 소유 notes가 0건일 때, user_a는 user_b의 note를 UPDATE할 수 없어야 한다$$
);

-- user_a 소유 notes가 0건인 상태에서도 user_a 명의 INSERT는 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'zero own insert', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_user_a_id')
  ),
  $$user_a 소유 notes가 0건인 상태에서도 user_a 명의 INSERT는 성공해야 한다$$
);

-- user_a 소유 notes가 0건인 상태에서도 user_b 명의 INSERT는 허용되면 안 된다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'zero invalid', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_note_invalid_zero_id'),
    current_setting('test.notes_rls_user_b_id')
  ),
  '42501',
  NULL,
  $$user_a 소유 notes가 0건인 상태에서도 user_b 명의 INSERT는 허용되면 안 된다$$
);

DELETE FROM public.notes
WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES (
  current_setting('test.notes_rls_note_state_one_id')::uuid,
  current_setting('test.notes_rls_user_a_id')::uuid,
  'note state one',
  'content state one',
  0
)
ON CONFLICT (id) DO NOTHING;

-- user_a 소유 notes가 1건일 때, user_a의 조건 없는 SELECT 결과는 정확히 1건이어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  1::bigint,
  $$user_a 소유 notes가 1건일 때, user_a의 조건 없는 SELECT 결과는 정확히 1건이어야 한다$$
);

-- user_a 소유 notes가 1건일 때, user_a는 자신의 1건만 UPDATE할 수 있어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'one own updated'
  WHERE id = current_setting('test.notes_rls_note_state_one_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  $$user_a 소유 notes가 1건일 때, user_a는 자신의 1건만 UPDATE할 수 있어야 한다$$
);

-- user_a 소유 notes가 1건일 때, user_a는 타인 note를 UPDATE할 수 없어야 한다
WITH updated AS (
  UPDATE public.notes
  SET title = 'one other blocked'
  WHERE id = current_setting('test.notes_rls_note_b_update_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$user_a 소유 notes가 1건일 때, user_a는 타인 note를 UPDATE할 수 없어야 한다$$
);

-- user_a 소유 notes가 1건일 때도 user_b 명의 INSERT는 허용되면 안 된다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'one invalid', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_note_invalid_one_id'),
    current_setting('test.notes_rls_user_b_id')
  ),
  '42501',
  NULL,
  $$user_a 소유 notes가 1건일 때도 user_b 명의 INSERT는 허용되면 안 된다$$
);

DELETE FROM public.notes
WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES
  (
    current_setting('test.notes_rls_note_state_many_1_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 1',
    'content state many 1',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_2_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 2',
    'content state many 2',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_3_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 3',
    'content state many 3',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- user_a 소유 notes가 여러 건일 때, user_a의 조건 없는 SELECT 결과는 본인 행만 기대 개수만큼 반환되어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  3::bigint,
  $$user_a 소유 notes가 여러 건일 때, user_a의 조건 없는 SELECT 결과는 본인 행만 기대 개수만큼 반환되어야 한다$$
);

-- user_a 소유 notes가 여러 건일 때, user_a는 자신의 note들만 DELETE할 수 있어야 하며 타인 note는 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  3::bigint,
  $$user_a 소유 notes가 여러 건일 때, user_a는 자신의 note들만 DELETE할 수 있어야 하며 타인 note는 DELETE할 수 없어야 한다$$
);

-- user_a 소유 notes가 여러 건일 때, user_a는 자신의 note들만 DELETE할 수 있어야 하며 타인 note는 DELETE할 수 없어야 한다
WITH deleted AS (
  DELETE FROM public.notes
  WHERE id = current_setting('test.notes_rls_note_b_delete_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$user_a 소유 notes가 여러 건일 때, user_a는 자신의 note들만 DELETE할 수 있어야 하며 타인 note는 DELETE할 수 없어야 한다$$
);

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES
  (
    current_setting('test.notes_rls_note_state_many_1_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 1',
    'content state many 1',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_2_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 2',
    'content state many 2',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_3_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note state many 3',
    'content state many 3',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- user_a 소유 notes가 이미 여러 건인 상태에서도 user_a 명의 INSERT는 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'many own insert', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_user_a_id')
  ),
  $$user_a 소유 notes가 이미 여러 건인 상태에서도 user_a 명의 INSERT는 성공해야 한다$$
);

-- user_a 소유 notes가 여러 건인 상태에서도 user_b 명의 INSERT는 허용되면 안 된다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'many invalid', 'content', 0);
    $sql$,
    current_setting('test.notes_rls_note_invalid_many_id'),
    current_setting('test.notes_rls_user_b_id')
  ),
  '42501',
  NULL,
  $$user_a 소유 notes가 여러 건인 상태에서도 user_b 명의 INSERT는 허용되면 안 된다$$
);

-- [불변 조건]
DELETE FROM public.notes
WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES
  (
    current_setting('test.notes_rls_note_state_many_1_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note invariant many 1',
    'content invariant many 1',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_2_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note invariant many 2',
    'content invariant many 2',
    0
  ),
  (
    current_setting('test.notes_rls_note_state_many_3_id')::uuid,
    current_setting('test.notes_rls_user_a_id')::uuid,
    'note invariant many 3',
    'content invariant many 3',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- 인증된 사용자의 조건 없는 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.notes_rls_user_a_id')::uuid),
  3::bigint,
  $$인증된 사용자의 조건 없는 조회 결과에는 본인 데이터가 기대 개수만큼 존재해야 한다$$
);

-- 인증된 사용자의 조건 없는 조회 결과에는 타인 데이터가 0건이어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.notes_rls_user_b_id')::uuid),
  0::bigint,
  $$인증된 사용자의 조건 없는 조회 결과에는 타인 데이터가 0건이어야 한다$$
);

-- 인증된 사용자의 조건 조회 결과도 반환된 모든 행의 user_id가 항상 auth.uid()와 일치해야 한다
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id IN (
     current_setting('test.notes_rls_note_state_many_1_id')::uuid,
     current_setting('test.notes_rls_note_state_many_2_id')::uuid,
     current_setting('test.notes_rls_note_state_many_3_id')::uuid,
     current_setting('test.notes_rls_note_b_select_id')::uuid
   )
   AND user_id <> current_setting('test.notes_rls_user_a_id')::uuid),
  0::bigint,
  $$인증된 사용자의 조건 조회 결과도 반환된 모든 행의 user_id가 항상 auth.uid()와 일치해야 한다$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

-- anon 상태의 조회 결과에는 notes 행이 0건이어야 한다
SELECT is(
  (SELECT count(*) FROM public.notes),
  0::bigint,
  $$anon 상태의 조회 결과에는 notes 행이 0건이어야 한다$$
);


-- 타인 명의 INSERT 시도 후에도 생성된 notes 행의 user_id가 인증 사용자와 불일치하는 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id IN (
     current_setting('test.notes_rls_note_invalid_authenticated_id')::uuid,
     current_setting('test.notes_rls_note_invalid_zero_id')::uuid,
     current_setting('test.notes_rls_note_invalid_one_id')::uuid,
     current_setting('test.notes_rls_note_invalid_many_id')::uuid
   )
   AND user_id <> current_setting('test.notes_rls_user_a_id')::uuid),
  0::bigint,
  $$타인 명의 INSERT 시도 후에도 생성된 notes 행의 user_id가 인증 사용자와 불일치하는 행이 존재해서는 안 된다$$
);

SELECT * FROM finish();
ROLLBACK;
