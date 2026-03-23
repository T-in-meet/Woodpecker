-- =========================================
-- notifications / constraints_not_null
-- =========================================
-- 이 파일은 public.notifications 테이블의 NOT NULL 제약만 검증한다.
-- 값의 허용 범위나 도메인 유효성은 별도 CHECK 테스트에서 검증한다.
-- DEFAULT와의 상호작용은 NOT NULL 관점에서만 확인한다.


BEGIN;

SELECT plan(32);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_constraints_not_null_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_notification_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_notification_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_notification_insert_explicit_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_notification_boundary_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_read_at_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_not_null_skipped_at_null_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_constraints_not_null_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notifications_constraints_not_null_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.notifications_constraints_not_null_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notifications (UPDATE 검증용)
INSERT INTO public.notifications (
  id,
  user_id,
  note_id,
  type,
  title,
  body,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  NULL,
  'REVIEW',
  'seed title',
  'seed body',
  'SENT',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 유효한 user_id, type, title, status, sent_at를 가진 알림 행은 생성될 수 있어야 한다.
SAVEPOINT notifications_not_null_insert_ok;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_notification_insert_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REMINDER',
  'valid insert',
  'READ',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_insert_id')::uuid),
  1::bigint,
  $$유효한 user_id, type, title, status, sent_at를 가진 알림 행은 생성될 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_insert_ok;

-- read_at을 명시적으로 NULL로 INSERT해도 저장되어야 한다.
SAVEPOINT notifications_not_null_insert_read_at_null;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at,
  read_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_read_at_null_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'read_at null',
  'SENT',
  now(),
  NULL
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_read_at_null_id')::uuid),
  1::bigint,
  $$read_at을 명시적으로 NULL로 INSERT해도 저장되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_insert_read_at_null;

-- skipped_at을 명시적으로 NULL로 INSERT해도 저장되어야 한다.
SAVEPOINT notifications_not_null_insert_skipped_at_null;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at,
  skipped_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_skipped_at_null_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'skipped_at null',
  'SENT',
  now(),
  NULL
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_skipped_at_null_id')::uuid),
  1::bigint,
  $$skipped_at을 명시적으로 NULL로 INSERT해도 저장되어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_insert_skipped_at_null;

-- 유효한 기존 알림 행에서 user_id를 다른 유효한 비NULL auth.users.id 값으로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_user;
UPDATE public.notifications
SET user_id = current_setting('test.notifications_constraints_not_null_user_b_id')::uuid
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT is(
  (SELECT user_id FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid),
  current_setting('test.notifications_constraints_not_null_user_b_id')::uuid,
  $$유효한 기존 알림 행에서 user_id를 다른 유효한 비NULL auth.users.id 값으로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_user;

-- 유효한 기존 알림 행에서 type을 다른 유효한 비NULL 문자열로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_type;
UPDATE public.notifications
SET type = 'ALERT'
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT is(
  (SELECT type FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid),
  'ALERT',
  $$유효한 기존 알림 행에서 type을 다른 유효한 비NULL 문자열로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_type;

-- 유효한 기존 알림 행에서 title을 다른 유효한 비NULL 문자열로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_title;
UPDATE public.notifications
SET title = 'new title'
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT is(
  (SELECT title FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid),
  'new title',
  $$유효한 기존 알림 행에서 title을 다른 유효한 비NULL 문자열로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_title;

-- 유효한 기존 알림 행에서 status를 다른 유효한 허용 비NULL 값으로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_status;
UPDATE public.notifications
SET status = 'SKIPPED'
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT is(
  (SELECT status FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid),
  'SKIPPED',
  $$유효한 기존 알림 행에서 status를 다른 유효한 허용 비NULL 값으로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_status;

-- 유효한 기존 알림 행에서 sent_at을 다른 유효한 비NULL 시각 값으로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_sent_at;
UPDATE public.notifications
SET sent_at = now() + interval '1 hour'
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT ok(
  (SELECT sent_at FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid) IS NOT NULL,
  $$유효한 기존 알림 행에서 sent_at을 다른 유효한 비NULL 시각 값으로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_sent_at;

-- 유효한 기존 알림 행에서 read_at을 비NULL 시각 값으로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_read_at;
UPDATE public.notifications
SET read_at = now()
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT ok(
  (SELECT read_at FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid) IS NOT NULL,
  $$유효한 기존 알림 행에서 read_at을 비NULL 시각 값으로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_read_at;

-- 유효한 기존 알림 행에서 skipped_at을 비NULL 시각 값으로 UPDATE할 수 있어야 한다.
SAVEPOINT notifications_not_null_update_skipped_at;
UPDATE public.notifications
SET skipped_at = now()
WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid;

SELECT ok(
  (SELECT skipped_at FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_seed_id')::uuid) IS NOT NULL,
  $$유효한 기존 알림 행에서 skipped_at을 비NULL 시각 값으로 UPDATE할 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_update_skipped_at;

-- id를 명시적으로 넣는 경우 유효한 비NULL UUID면 생성될 수 있어야 한다.
SAVEPOINT notifications_not_null_insert_explicit_id;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_notification_insert_explicit_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'explicit id',
  'SENT',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_insert_explicit_id')::uuid),
  1::bigint,
  $$id를 명시적으로 넣는 경우 유효한 비NULL UUID면 생성될 수 있어야 한다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_insert_explicit_id;

-- [예외 조건]
-- id를 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (NULL, current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, 'REVIEW', 'null id', 'SENT', now());
  $sql$,
  '23502',
  'null value in column "id" of relation "notifications" violates not-null constraint',
  $$id를 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- user_id를 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), NULL, 'REVIEW', 'null user', 'SENT', now());
  $sql$,
  '23502',
  'null value in column "user_id" of relation "notifications" violates not-null constraint',
  $$user_id를 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- type을 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, NULL, 'null type', 'SENT', now());
  $sql$,
  '23502',
  'null value in column "type" of relation "notifications" violates not-null constraint',
  $$type을 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- title을 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, 'REVIEW', NULL, 'SENT', now());
  $sql$,
  '23502',
  'null value in column "title" of relation "notifications" violates not-null constraint',
  $$title을 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- status를 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, 'REVIEW', 'null status', NULL, now());
  $sql$,
  '23502',
  'null value in column "status" of relation "notifications" violates not-null constraint',
  $$status를 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- sent_at을 NULL로 명시한 알림 행은 저장되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, 'REVIEW', 'null sent_at', 'SENT', NULL);
  $sql$,
  '23502',
  'null value in column "sent_at" of relation "notifications" violates not-null constraint',
  $$sent_at을 NULL로 명시한 알림 행은 저장되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 user_id를 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "user_id" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 user_id를 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 type을 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET type = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "type" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 type을 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 title을 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET title = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "title" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 title을 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 status를 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "status" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 status를 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 sent_at을 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET sent_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "sent_at" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 sent_at을 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- 기존 유효 행을 UPDATE하여 id를 NULL로 바꾸는 시도는 허용되면 안 된다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  '23502',
  'null value in column "id" of relation "notifications" violates not-null constraint',
  $$기존 유효 행을 UPDATE하여 id를 NULL로 바꾸는 시도는 허용되면 안 된다.$$
);

-- [경계 조건]
-- type은 NOT NULL 제약의 대상이므로, 비NULL 문자열이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_type;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_not_null_notification_boundary_id')::uuid,
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'A',
  'boundary title',
  'SENT',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id = current_setting('test.notifications_constraints_not_null_notification_boundary_id')::uuid),
  1::bigint,
  $$type은 NOT NULL 제약의 대상이므로, 비NULL 문자열이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_type;

-- title은 NOT NULL 제약의 대상이므로, 비NULL 문자열이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_title;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'T',
  'SENT',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'T'),
  1::bigint,
  $$title은 NOT NULL 제약의 대상이므로, 비NULL 문자열이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_title;

-- status는 NOT NULL 제약의 대상이므로, 허용된 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_status;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'boundary status',
  'SENT',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'boundary status'),
  1::bigint,
  $$status는 NOT NULL 제약의 대상이므로, 허용된 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_status;

-- sent_at은 NOT NULL 제약의 대상이므로, 비NULL 시각 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_sent_at;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'boundary sent_at',
  'READ',
  now()
);

SELECT ok(
  (SELECT sent_at FROM public.notifications WHERE title = 'boundary sent_at') IS NOT NULL,
  $$sent_at은 NOT NULL 제약의 대상이므로, 비NULL 시각 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_sent_at;

-- user_id는 NOT NULL 제약의 대상이므로, 유효한 부모 사용자를 참조하는 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_user_id;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'boundary user',
  'READ',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'boundary user'),
  1::bigint,
  $$user_id는 NOT NULL 제약의 대상이므로, 유효한 부모 사용자를 참조하는 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_user_id;

-- id는 NOT NULL 제약의 대상이므로, 유효한 UUID 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.
SAVEPOINT notifications_not_null_boundary_id;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  gen_random_uuid(),
  current_setting('test.notifications_constraints_not_null_user_a_id')::uuid,
  'REVIEW',
  'boundary id',
  'READ',
  now()
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'boundary id'),
  1::bigint,
  $$id는 NOT NULL 제약의 대상이므로, 유효한 UUID 비NULL 값이면 저장될 수 있어야 하고 NULL은 허용되면 안 된다.$$
);
ROLLBACK TO SAVEPOINT notifications_not_null_boundary_id;

-- DEFAULT가 있는 id, status, sent_at는 NOT NULL 관점에서 생략 시 유효하게 채워질 수 있지만, 명시적 NULL 지정은 허용되면 안 된다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (NULL, current_setting('test.notifications_constraints_not_null_user_a_id')::uuid, 'REVIEW', 'default null', NULL, NULL);
  $sql$,
  '23502',
  'null value in column "id" of relation "notifications" violates not-null constraint',
  $$DEFAULT가 있는 id, status, sent_at는 NOT NULL 관점에서 생략 시 유효하게 채워질 수 있지만, 명시적 NULL 지정은 허용되면 안 된다.$$
);

-- [불변 조건]
-- notifications 테이블에는 NOT NULL 대상 컬럼(id, user_id, type, title, status, sent_at) 중 하나라도 NULL인 행이 존재해서는 안 된다. (Status)
SELECT is(
  (
    SELECT count(*)
    FROM public.notifications
    WHERE id IS NULL
       OR user_id IS NULL
       OR type IS NULL
       OR title IS NULL
       OR status IS NULL
       OR sent_at IS NULL
  ),
  0::bigint,
  $$notifications 테이블에는 NOT NULL 대상 컬럼(id, user_id, type, title, status, sent_at) 중 하나라도 NULL인 행이 존재해서는 안 된다. (Status)$$
);

-- NULL UPDATE 실패 시도 이후에도 seed 행의 NOT NULL 대상 값은 시도 전과 동일하게 유지되어야 한다. (Transition)
SELECT results_eq(
  format(
    $sql$
      SELECT user_id::text, type::text, title::text, status::text, sent_at::text
      FROM public.notifications
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  format(
    $sql$
      SELECT '%s'::text, 'REVIEW'::text, 'seed title'::text, 'SENT'::text,
             sent_at::text
      FROM public.notifications
      WHERE id = '%s'::uuid
    $sql$,
    current_setting('test.notifications_constraints_not_null_user_a_id'),
    current_setting('test.notifications_constraints_not_null_notification_seed_id')
  ),
  $$NULL UPDATE 실패 시도 이후에도 seed 행의 NOT NULL 대상 값은 시도 전과 동일하게 유지되어야 한다. (Transition)$$
);

SELECT * FROM finish();
ROLLBACK;
