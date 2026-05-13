-- =========================================
-- notifications / constraints_check
-- =========================================

BEGIN;

SELECT plan(20);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_constraints_check_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_check_notification_seed_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_constraints_check_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_constraints_check_user_a_id') || '@example.com',
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
  status
)
VALUES (
  current_setting('test.notifications_constraints_check_notification_seed_id')::uuid,
  current_setting('test.notifications_constraints_check_user_a_id')::uuid,
  NULL,
  'ALERT',
  'seed title',
  'seed body',
  'SENT'
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- status가 'SENT'이면 INSERT가 성공해야 한다
SAVEPOINT notifications_status_insert_sent;
INSERT INTO public.notifications (id, user_id, type, title, status)
VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'sent ok', 'SENT');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'sent ok'),
  1::bigint,
  $$status가 'SENT'이면 INSERT가 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_insert_sent;

-- status가 'READ'이면 INSERT가 성공해야 한다
SAVEPOINT notifications_status_insert_read;
INSERT INTO public.notifications (id, user_id, type, title, status)
VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'read ok', 'READ');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'read ok'),
  1::bigint,
  $$status가 'READ'이면 INSERT가 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_insert_read;

-- status = 'SKIPPED' INSERT는 notifications_status_check 제약 위반으로 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'skipped blocked', 'SKIPPED');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$status = 'SKIPPED' INSERT는 notifications_status_check 제약 위반으로 차단되어야 한다$$
);

-- 기존의 유효한 notifications 행을 status = 'SENT'로 UPDATE하면 성공해야 한다
SAVEPOINT notifications_status_update_sent;
UPDATE public.notifications
SET status = 'SENT'
WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid;

SELECT is(
  (SELECT status FROM public.notifications WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid),
  'SENT',
  $$기존의 유효한 notifications 행을 status = 'SENT'로 UPDATE하면 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_update_sent;

-- 기존의 유효한 notifications 행을 status = 'READ'로 UPDATE하면 성공해야 한다
SAVEPOINT notifications_status_update_read;
UPDATE public.notifications
SET status = 'READ'
WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid;

SELECT is(
  (SELECT status FROM public.notifications WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid),
  'READ',
  $$기존의 유효한 notifications 행을 status = 'READ'로 UPDATE하면 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_update_read;

-- 기존의 유효한 notifications 행을 status = 'SKIPPED'로 UPDATE하면 차단되어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = 'SKIPPED'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$기존의 유효한 notifications 행을 status = 'SKIPPED'로 UPDATE하면 차단되어야 한다$$
);

-- [예외 조건]
-- status가 허용 목록에 없는 값이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'invalid status', 'FAILED');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$status가 허용 목록에 없는 값이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- status가 소문자('sent', 'read')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'lowercase status', 'sent');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$status가 소문자('sent', 'read')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- status에 앞뒤 공백이 포함된 값(' SENT', 'READ ')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'spaced status', ' SENT');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$status에 앞뒤 공백이 포함된 값(' SENT', 'READ ')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- status가 빈 문자열('')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'empty status', '');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$status가 빈 문자열('')이면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- 기존의 유효한 notifications 행을 허용 목록 밖 status로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    'FAILED',
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$기존의 유효한 notifications 행을 허용 목록 밖 status로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- 기존의 유효한 notifications 행을 소문자 status('sent')로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    'sent',
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$기존의 유효한 notifications 행을 소문자 status('sent')로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- 기존의 유효한 notifications 행을 공백 포함 status('READ ')로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    'READ ',
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$기존의 유효한 notifications 행을 공백 포함 status('READ ')로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- 기존의 유효한 notifications 행을 빈 문자열('') status로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    '',
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$기존의 유효한 notifications 행을 빈 문자열('') status로 UPDATE하면 notifications_status_check 제약 위반으로 저장이 차단되어야 한다$$
);

-- invalid UPDATE 시도 전후로 status 값은 변하지 않아야 한다 (Transition)
SAVEPOINT notifications_status_invalid_update_transition;

SELECT set_config(
  'test.notifications_constraints_check_prev_status',
  (
    SELECT status::text
    FROM public.notifications
    WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid
  ),
  true
);

SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notifications
      SET status = '%s'
      WHERE id = '%s'::uuid;
    $sql$,
    'FAILED',
    current_setting('test.notifications_constraints_check_notification_seed_id')
  ),
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$허용되지 않은 status로 UPDATE 시도하면 notifications_status_check 제약 위반으로 차단되어야 한다$$
);

SELECT is(
  (
    SELECT status::text
    FROM public.notifications
    WHERE id = current_setting('test.notifications_constraints_check_notification_seed_id')::uuid
  ),
  current_setting('test.notifications_constraints_check_prev_status'),
  $$invalid UPDATE 시도 전후로 status 값은 변하지 않아야 한다$$
);

ROLLBACK TO SAVEPOINT notifications_status_invalid_update_transition;

-- [경계 조건]
-- 정확히 'SENT'는 허용값 경계로서 성공해야 한다
SAVEPOINT notifications_status_boundary_sent;
INSERT INTO public.notifications (id, user_id, type, title, status)
VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'boundary sent', 'SENT');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'boundary sent'),
  1::bigint,
  $$정확히 'SENT'는 허용값 경계로서 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_boundary_sent;

-- 정확히 'READ'는 허용값 경계로서 성공해야 한다
SAVEPOINT notifications_status_boundary_read;
INSERT INTO public.notifications (id, user_id, type, title, status)
VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'boundary read', 'READ');

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE title = 'boundary read'),
  1::bigint,
  $$정확히 'READ'는 허용값 경계로서 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT notifications_status_boundary_read;

-- 정확히 'SKIPPED'도 허용값이 아니므로 차단되어야 한다
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_check_user_a_id')::uuid, 'ALERT', 'boundary skipped', 'SKIPPED');
  $sql$,
  '23514',
  'new row for relation "notifications" violates check constraint "notifications_status_check"',
  $$정확히 'SKIPPED'도 허용값이 아니므로 차단되어야 한다$$
);

-- [불변 조건]
-- 어떠한 경우에도 notifications_status_check를 위반하는 notifications 행의 수는 0개여야 한다 (Status)
SELECT is(
  (
    SELECT count(*)
    FROM public.notifications
    WHERE status NOT IN ('SENT', 'READ')
  ),
  0::bigint,
  $$어떠한 경우에도 notifications_status_check를 위반하는 notifications 행의 수는 0개여야 한다 (Status)$$
);

SELECT * FROM finish();
ROLLBACK;
