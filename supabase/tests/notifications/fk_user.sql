-- =========================================
-- notifications / FK / user_id -> auth.users(id)
-- =========================================


BEGIN;

-- TODO: fix plan count after schema is finalized
SELECT plan(15);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_fk_user_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_note_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_notification_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_insert_ok_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_insert_min_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_insert_max_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_user_invalid_user_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_fk_user_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notifications_fk_user_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.notifications_fk_user_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notes
-- notifications seed에서 note_id가 사용되므로 최소한의 note seed 유지
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
    current_setting('test.notifications_fk_user_note_a_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    'note a',
    'content a',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.notifications_fk_user_note_b_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    'note b',
    'content b',
    1,
    now() + interval '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notifications
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status
)
VALUES
  (
    current_setting('test.notifications_fk_user_a1_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    current_setting('test.notifications_fk_user_note_a_id')::uuid,
    'REVIEW',
    'a1 title',
    'a1 body',
    'SENT'
  ),
  (
    current_setting('test.notifications_fk_user_a2_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    current_setting('test.notifications_fk_user_note_a_id')::uuid,
    'REMINDER',
    'a2 title',
    'a2 body',
    'SENT'
  ),
  (
    current_setting('test.notifications_fk_user_b1_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    current_setting('test.notifications_fk_user_note_b_id')::uuid,
    'REVIEW',
    'b1 title',
    'b1 body',
    'SENT'
  ),
  (
    current_setting('test.notifications_fk_user_null_id')::uuid,
    current_setting('test.notifications_fk_user_user_a_id')::uuid,
    NULL,
    'ALERT',
    'null note title',
    'null note body',
    'SENT'
  ),
  (
    current_setting('test.notifications_fk_user_notification_user_b_id')::uuid,
    current_setting('test.notifications_fk_user_user_b_id')::uuid,
    NULL,
    'REVIEW',
    'user b title',
    'user b body',
    'SENT'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 존재하는 auth.users.id를 user_id로 참조하는 notifications INSERT는 허용되어야 한다.
SAVEPOINT notifications_user_fk_insert_ok;
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status
)
VALUES (
  current_setting('test.notifications_fk_user_insert_ok_id')::uuid,
  current_setting('test.notifications_fk_user_user_a_id')::uuid,
  NULL,
  'REVIEW',
  'insert ok',
  'body',
  'SENT'
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_user_insert_ok_id')::uuid),
  1::bigint,
  $$존재하는 auth.users.id를 user_id로 참조하는 notifications INSERT는 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_insert_ok;

-- 서로 다른 부모 user를 참조하는 notifications는 각각 독립적으로 저장되어야 한다.
SELECT ok(
  (
    (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid) >= 2
    AND (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_b_id')::uuid) >= 1
  ),
  $$서로 다른 부모 user를 참조하는 notifications는 각각 독립적으로 저장되어야 한다.$$
);

-- 부모 user_a 삭제 시 user_a의 notifications는 함께 삭제되어야 한다.
SAVEPOINT notifications_user_fk_delete_cascade;
DELETE FROM auth.users
WHERE id = current_setting('test.notifications_fk_user_user_a_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid),
  0::bigint,
  $$부모 user_a 삭제 시 user_a의 notifications는 함께 삭제되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_delete_cascade;

-- [예외 조건]
-- 존재하지 않는 auth.users.id를 user_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REVIEW', 'invalid user');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_user_invalid_user_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_user_id_fkey"',
  $$존재하지 않는 auth.users.id를 user_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_fk_user_invalid_user_id'),
    current_setting('test.notifications_fk_user_notification_user_b_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_user_id_fkey"',
  $$존재하지 않는 auth.users.id를 user_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

-- 부모 user 삭제 이후, 같은 삭제된 user_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.
SAVEPOINT notifications_user_fk_deleted_parent_block;
DELETE FROM auth.users
WHERE id = current_setting('test.notifications_fk_user_user_a_id')::uuid;

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REVIEW', 'deleted parent');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_user_user_a_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_user_id_fkey"',
  $$부모 user 삭제 이후, 같은 삭제된 user_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_fk_user_user_a_id'),
    current_setting('test.notifications_fk_user_notification_user_b_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_user_id_fkey"',
  $$부모 user 삭제 이후, 같은 삭제된 user_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_deleted_parent_block;

-- 이미 존재하는 notifications의 user_id를 다른 유효한 user_id로 변경하는 것은 허용되어야 한다.
SAVEPOINT notifications_user_fk_update_valid;
UPDATE public.notifications
SET user_id = current_setting('test.notifications_fk_user_user_b_id')::uuid
WHERE id = current_setting('test.notifications_fk_user_a1_id')::uuid;

SELECT is(
  (SELECT user_id FROM public.notifications WHERE id = current_setting('test.notifications_fk_user_a1_id')::uuid),
  current_setting('test.notifications_fk_user_user_b_id')::uuid,
  $$이미 존재하는 notifications의 user_id를 다른 유효한 user_id로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_update_valid;

-- [경계 조건]
-- 유효한 부모 user를 참조하는 최소 형태 notifications INSERT는 허용되어야 한다.
SAVEPOINT notifications_user_fk_min_insert;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title
)
VALUES (
  current_setting('test.notifications_fk_user_insert_min_id')::uuid,
  current_setting('test.notifications_fk_user_user_a_id')::uuid,
  'REVIEW',
  'min title'
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_user_insert_min_id')::uuid),
  1::bigint,
  $$유효한 부모 user를 참조하는 최소 형태 notifications INSERT는 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_min_insert;

-- 유효한 부모 user를 참조하는 최대 형태 notifications INSERT는 허용되어야 한다.
SAVEPOINT notifications_user_fk_max_insert;
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status,
  sent_at,
  read_at,
  skipped_at
)
VALUES (
  current_setting('test.notifications_fk_user_insert_max_id')::uuid,
  current_setting('test.notifications_fk_user_user_a_id')::uuid,
  NULL,
  repeat('T', 50),
  repeat('X', 200),
  repeat('B', 500),
  'READ',
  now(),
  now(),
  NULL
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_user_insert_max_id')::uuid),
  1::bigint,
  $$유효한 부모 user를 참조하는 최대 형태 notifications INSERT는 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_max_insert;

-- 존재하지 않는 임의 UUID를 user_id로 사용하는 경우는 차단되어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REVIEW', 'invalid uuid');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_user_invalid_user_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_user_id_fkey"',
  $$존재하지 않는 임의 UUID를 user_id로 사용하는 경우는 차단되어야 한다.$$
);

-- 부모 user 삭제 직후에는 해당 user를 참조하던 notifications가 0건이어야 한다.
SAVEPOINT notifications_user_fk_delete_zero;
DELETE FROM auth.users
WHERE id = current_setting('test.notifications_fk_user_user_a_id')::uuid;

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid),
  0::bigint,
  $$부모 user 삭제 직후에는 해당 user를 참조하던 notifications가 0건이어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_delete_zero;

-- 한 user가 여러 notifications를 참조하더라도 부모 삭제 시 관련 notifications는 모두 함께 제거되어야 한다.
SAVEPOINT notifications_user_fk_delete_many;
SELECT set_config(
  'test.notifications_fk_user_before_count',
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid)::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.notifications_fk_user_user_a_id')::uuid;

SELECT ok(
  (
    current_setting('test.notifications_fk_user_before_count')::bigint >= 2
    AND (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid) = 0
  ),
  $$한 user가 여러 notifications를 참조하더라도 부모 삭제 시 관련 notifications는 모두 함께 제거되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_delete_many;

-- [불변 조건]
-- 테스트 종료 시점에 존재하는 모든 notifications의 user_id는 항상 존재하는 auth.users.id만 참조해야 한다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    LEFT JOIN auth.users u ON u.id = n.user_id
    WHERE u.id IS NULL
  ),
  $$테스트 종료 시점에 존재하는 모든 notifications의 user_id는 항상 존재하는 auth.users.id만 참조해야 한다.$$
);

-- 부모 user_a 삭제 전후를 비교했을 때, 해당 user를 참조하던 notifications는 삭제되어야 하고, 다른 user(예: user_b)의 notifications는 영향을 받지 않아야 한다.
SAVEPOINT notifications_user_fk_transition;
SELECT set_config(
  'test.notifications_fk_user_before_a',
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid)::text,
  true
);
SELECT set_config(
  'test.notifications_fk_user_before_b',
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_b_id')::uuid)::text,
  true
);

DELETE FROM auth.users
WHERE id = current_setting('test.notifications_fk_user_user_a_id')::uuid;

SELECT ok(
  (
    (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_a_id')::uuid) = 0
    AND (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_fk_user_user_b_id')::uuid)
      = current_setting('test.notifications_fk_user_before_b')::bigint
  ),
  $$부모 user_a 삭제 전후를 비교했을 때, 해당 user를 참조하던 notifications는 삭제되어야 하고, 다른 user(예: user_b)의 notifications는 영향을 받지 않아야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_user_fk_transition;

SELECT * FROM finish();
ROLLBACK;
