-- =========================================
-- quiz_generations / 테이블 자체의 한도 보호 성질
--
-- 선점 RPC의 동작은 generation_v2.sql이 검증한다. 이 파일은 어떤 RPC를 쓰든
-- 성립해야 하는 테이블 수준 보장만 다룬다. 20260815230000이 v1
-- claim_quiz_generation을 제거하면서 generation_limits.sql이 사라졌고,
-- 그 파일에만 있던 아래 세 가지를 여기로 옮겼다.
-- =========================================

BEGIN;

SELECT plan(3);

SELECT set_config('test.qgt_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgt_note_id', gen_random_uuid()::text, true);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  current_setting('test.qgt_user_id')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'qgt_' || current_setting('test.qgt_user_id') || '@example.com',
  crypt('password123', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.qgt_note_id')::uuid,
  current_setting('test.qgt_user_id')::uuid,
  'note',
  'content',
  0
)
ON CONFLICT (id) DO NOTHING;

-- quiz_generations에는 쓰기 정책이 없다. fixture는 테이블 소유자 역할로 넣는다.
INSERT INTO public.quiz_generations (user_id, note_id, quiz_type)
VALUES
  (
    current_setting('test.qgt_user_id')::uuid,
    current_setting('test.qgt_note_id')::uuid,
    'ox'
  ),
  (
    current_setting('test.qgt_user_id')::uuid,
    current_setting('test.qgt_note_id')::uuid,
    'blank'
  );

-- 1. 인증 사용자는 quiz_generations에 직접 INSERT할 수 없어야 한다
-- (기록을 마음대로 만들거나 지울 수 있으면 한도가 무의미해진다)
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.qgt_user_id'), 'role', 'authenticated')::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.quiz_generations (user_id, note_id, quiz_type)
      VALUES ('%s'::uuid, '%s'::uuid, 'choice');
    $sql$,
    current_setting('test.qgt_user_id'),
    current_setting('test.qgt_note_id')
  ),
  '42501',
  NULL,
  $$인증 사용자는 quiz_generations에 직접 INSERT할 수 없어야 한다$$
);

RESET ROLE;

-- 2·3. 노트를 지워도 사용량이 초기화되면 안 된다
-- (임시 노트를 만들고 지우는 방식으로 한도를 우회할 수 있기 때문이다)
SELECT set_config(
  'test.qgt_before_delete',
  (SELECT count(*) FROM public.quiz_generations
   WHERE user_id = current_setting('test.qgt_user_id')::uuid)::text,
  true
);

DELETE FROM public.notes
WHERE id = current_setting('test.qgt_note_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.quiz_generations
   WHERE user_id = current_setting('test.qgt_user_id')::uuid),
  current_setting('test.qgt_before_delete')::bigint,
  $$노트를 삭제해도 사용 기록 수가 유지되어야 한다$$
);

-- note_id는 on delete set null이다 (cascade면 기록까지 함께 사라진다)
SELECT is(
  (SELECT count(*) FROM public.quiz_generations
   WHERE user_id = current_setting('test.qgt_user_id')::uuid
     AND note_id IS NULL),
  2::bigint,
  $$삭제된 노트의 사용 기록은 note_id가 NULL이 되어야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
