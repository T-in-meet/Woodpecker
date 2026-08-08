-- =========================================
-- notifications / FK / note_id -> public.notes(id)
-- =========================================


BEGIN;

SELECT plan(16);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_fk_note_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_note_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_insert_note_ok_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_insert_note_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_insert_note_min_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_insert_note_max_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_fk_note_invalid_note_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_fk_note_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notifications_fk_note_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.notifications_fk_note_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notes
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
    current_setting('test.notifications_fk_note_note_a_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    'note a',
    'content a',
    0,
    now() + interval '1 day'
  ),
  (
    current_setting('test.notifications_fk_note_note_b_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
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
,
  click_path)
VALUES
  (
    current_setting('test.notifications_fk_note_a1_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    current_setting('test.notifications_fk_note_note_a_id')::uuid,
    'REVIEW',
    'a1 title',
    'a1 body',
    'SENT'
  ,
  '/test'),
  (
    current_setting('test.notifications_fk_note_a2_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    current_setting('test.notifications_fk_note_note_a_id')::uuid,
    'SYSTEM',
    'a2 title',
    'a2 body',
    'SENT'
  ,
  '/test'),
  (
    current_setting('test.notifications_fk_note_b1_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    current_setting('test.notifications_fk_note_note_b_id')::uuid,
    'REVIEW',
    'b1 title',
    'b1 body',
    'SENT'
  ,
  '/test'),
  (
    current_setting('test.notifications_fk_note_null_id')::uuid,
    current_setting('test.notifications_fk_note_user_a_id')::uuid,
    NULL,
    'SYSTEM',
    'null note title',
    'null note body',
    'SENT'
  ,
  '/test')
ON CONFLICT (id) DO NOTHING;


-- [정답 조건]
-- 존재하는 public.notes.id를 note_id로 참조하는 notifications INSERT는 허용되어야 한다.
SAVEPOINT notifications_note_fk_insert_ok;
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status
,
  click_path)
VALUES (
  current_setting('test.notifications_fk_note_insert_note_ok_id')::uuid,
  current_setting('test.notifications_fk_note_user_a_id')::uuid,
  current_setting('test.notifications_fk_note_note_a_id')::uuid,
  'REVIEW',
  'note ok',
  'body',
  'SENT'
,
  '/test');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_insert_note_ok_id')::uuid),
  1::bigint,
  $$존재하는 public.notes.id를 note_id로 참조하는 notifications INSERT는 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_insert_ok;

-- REVIEW notifications는 note_id 없이 생성될 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, note_id, type, title,
  click_path)
      VALUES ('%s'::uuid, '%s'::uuid, NULL, 'REVIEW', 'null review note',
  '/test');
    $sql$,
    current_setting('test.notifications_fk_note_insert_note_null_id'),
    current_setting('test.notifications_fk_note_user_a_id')
  ),
  '23514',
  NULL,
  $$REVIEW notifications는 note_id 없이 생성될 수 없어야 한다.$$
);

-- 부모 note_a 삭제 시 이를 참조하던 notifications 행도 함께 삭제되어야 한다.
SAVEPOINT notifications_note_fk_delete_cascade;
DELETE FROM public.notes
WHERE id = current_setting('test.notifications_fk_note_note_a_id')::uuid;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE id = current_setting('test.notifications_fk_note_a1_id')::uuid
  ),
  $$부모 note_a 삭제 시 이를 참조하던 notifications 행도 함께 삭제되어야 한다.$$
);

-- 삭제되지 않은 다른 note를 참조하던 notifications는 그대로 유지되어야 한다.
SELECT ok(
  (
    (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_b1_id')::uuid) = 1
    AND (SELECT note_id FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_b1_id')::uuid)
      = current_setting('test.notifications_fk_note_note_b_id')::uuid
  ),
  $$삭제되지 않은 다른 note를 참조하던 notifications는 그대로 유지되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_delete_cascade;

-- [예외 조건]
-- 존재하지 않는 public.notes.id를 note_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, note_id, type, title,
  click_path)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 'REVIEW', 'invalid note',
  '/test');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_note_user_a_id'),
    current_setting('test.notifications_fk_note_invalid_note_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_note_id_fkey"',
  $$존재하지 않는 public.notes.id를 note_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET note_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_fk_note_invalid_note_id'),
    current_setting('test.notifications_fk_note_null_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_note_id_fkey"',
  $$존재하지 않는 public.notes.id를 note_id로 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

-- 부모 note 삭제 이후, 같은 삭제된 note_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.
SAVEPOINT notifications_note_fk_deleted_parent_block;
DELETE FROM public.notes
WHERE id = current_setting('test.notifications_fk_note_note_a_id')::uuid;

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, note_id, type, title,
  click_path)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 'REVIEW', 'deleted note',
  '/test');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_note_user_a_id'),
    current_setting('test.notifications_fk_note_note_a_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_note_id_fkey"',
  $$부모 note 삭제 이후, 같은 삭제된 note_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET note_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_fk_note_note_a_id'),
    current_setting('test.notifications_fk_note_null_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_note_id_fkey"',
  $$부모 note 삭제 이후, 같은 삭제된 note_id를 다시 참조하는 notifications INSERT/UPDATE는 허용되지 않아야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_deleted_parent_block;

-- 이미 존재하는 notifications의 note_id를 다른 유효한 note_id로 변경하는 것은 허용되어야 한다.
SAVEPOINT notifications_note_fk_update_valid;
UPDATE public.notifications
SET note_id = current_setting('test.notifications_fk_note_note_b_id')::uuid
WHERE id = current_setting('test.notifications_fk_note_a1_id')::uuid;

SELECT is(
  (SELECT note_id FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_a1_id')::uuid),
  current_setting('test.notifications_fk_note_note_b_id')::uuid,
  $$이미 존재하는 notifications의 note_id를 다른 유효한 note_id로 변경하는 것은 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_update_valid;

-- [경계 조건]
-- REVIEW notifications는 최소 형태에서도 note_id를 생략할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, note_id, type, title,
  click_path)
      VALUES ('%s'::uuid, '%s'::uuid, NULL, 'REVIEW', 'min note null',
  '/test');
    $sql$,
    current_setting('test.notifications_fk_note_insert_note_min_id'),
    current_setting('test.notifications_fk_note_user_a_id')
  ),
  '23514',
  NULL,
  $$REVIEW notifications는 최소 형태에서도 note_id를 생략할 수 없어야 한다.$$
);

-- 유효한 note_id를 포함한 최대 형태 notifications INSERT는 허용되어야 한다.
SAVEPOINT notifications_note_fk_max_insert;
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status,
  sent_at,
  read_at
,
  click_path)
VALUES (
  current_setting('test.notifications_fk_note_insert_note_max_id')::uuid,
  current_setting('test.notifications_fk_note_user_a_id')::uuid,
  current_setting('test.notifications_fk_note_note_b_id')::uuid,
  'SYSTEM',
  repeat('X', 200),
  repeat('B', 500),
  'READ',
  now(),
  now()
,
  '/test');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_insert_note_max_id')::uuid),
  1::bigint,
  $$유효한 note_id를 포함한 최대 형태 notifications INSERT는 허용되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_max_insert;

-- 존재하지 않는 임의 UUID를 note_id로 사용하는 경우는 차단되어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, note_id, type, title,
  click_path)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 'REVIEW', 'invalid note uuid',
  '/test');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_fk_note_user_a_id'),
    current_setting('test.notifications_fk_note_invalid_note_id')
  ),
  '23503',
  'insert or update on table "notifications" violates foreign key constraint "notifications_note_id_fkey"',
  $$존재하지 않는 임의 UUID를 note_id로 사용하는 경우는 차단되어야 한다.$$
);

-- 한 note를 여러 notifications가 참조하더라도 부모 note 삭제 시 관련 모든 notifications 행이 함께 삭제되어야 한다.
SAVEPOINT notifications_note_fk_delete_many;
DELETE FROM public.notes
WHERE id = current_setting('test.notifications_fk_note_note_a_id')::uuid;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE id IN (
      current_setting('test.notifications_fk_note_a1_id')::uuid,
      current_setting('test.notifications_fk_note_a2_id')::uuid
    )
  ),
  $$한 note를 여러 notifications가 참조하더라도 부모 note 삭제 시 관련 모든 notifications 행이 함께 삭제되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_delete_many;

-- 부모 note 삭제 직후에는 해당 note를 참조하던 notifications 행 수만큼 전체 행 수가 줄어야 한다.
SAVEPOINT notifications_note_fk_delete_row_count;
SELECT set_config(
  'test.notifications_fk_note_before_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);
SELECT set_config(
  'test.notifications_fk_note_before_note_a_for_count',
  (SELECT count(*) FROM public.notifications WHERE note_id = current_setting('test.notifications_fk_note_note_a_id')::uuid)::text,
  true
);

DELETE FROM public.notes
WHERE id = current_setting('test.notifications_fk_note_note_a_id')::uuid;

SELECT ok(
  (
    (SELECT count(*) FROM public.notifications)
      = current_setting('test.notifications_fk_note_before_total')::bigint
        - current_setting('test.notifications_fk_note_before_note_a_for_count')::bigint
    AND (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_fk_note_a1_id')::uuid) = 0
  ),
  $$부모 note 삭제 직후에는 해당 note를 참조하던 notifications 행 수만큼 전체 행 수가 줄어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_note_fk_delete_row_count;

-- [불변 조건]
-- 테스트 종료 시점에 존재하는 모든 notifications의 note_id는 NULL이거나 존재하는 public.notes.id만 참조해야 한다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    LEFT JOIN public.notes p ON p.id = n.note_id
    WHERE n.note_id IS NOT NULL AND p.id IS NULL
  ),
  $$테스트 종료 시점에 존재하는 모든 notifications의 note_id는 NULL이거나 존재하는 public.notes.id만 참조해야 한다.$$
);

-- 부모 note 삭제 전후를 비교했을 때, 해당 note를 참조하던 notifications는 삭제되며 다른 note를 참조하던 notifications는 영향을 받지 않아야 한다.
SAVEPOINT notifications_note_fk_transition;
SELECT set_config(
  'test.notifications_fk_note_before_note_b',
  (SELECT count(*) FROM public.notifications WHERE note_id = current_setting('test.notifications_fk_note_note_b_id')::uuid)::text,
  true
);

DELETE FROM public.notes
WHERE id = current_setting('test.notifications_fk_note_note_a_id')::uuid;

SELECT ok(
  (
    (SELECT count(*) FROM public.notifications WHERE note_id = current_setting('test.notifications_fk_note_note_a_id')::uuid) = 0
    AND (SELECT count(*) FROM public.notifications WHERE note_id = current_setting('test.notifications_fk_note_note_b_id')::uuid)
      = current_setting('test.notifications_fk_note_before_note_b')::bigint
  ),
  $$부모 note 삭제 전후를 비교했을 때, 해당 note를 참조하던 notifications는 삭제되며 다른 note를 참조하던 notifications는 영향을 받지 않아야 한다.$$
);
RELEASE SAVEPOINT notifications_note_fk_transition;

SELECT * FROM finish();
ROLLBACK;
