-- =========================================
-- notifications / constraints_default
-- =========================================

BEGIN;

SELECT plan(10);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_constraints_default_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_default_notification_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_default_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_default_status_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_constraints_default_sent_at_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_constraints_default_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_constraints_default_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notifications (불변 조건용)
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_default_notification_seed_id')::uuid,
  current_setting('test.notifications_constraints_default_user_a_id')::uuid,
  'REVIEW',
  'seed title',
  'SENT',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- id를 생략한 INSERT 시 UUID가 자동 생성된다.
SAVEPOINT notifications_default_id;
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  status,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_default_user_a_id')::uuid,
  'REVIEW',
  'default id',
  'SENT',
  now()
);

SELECT ok(
  (SELECT count(*) FROM public.notifications WHERE title = 'default id' AND id IS NOT NULL) = 1,
  $$id를 생략한 INSERT 시 UUID가 자동 생성된다.$$
);
ROLLBACK TO SAVEPOINT notifications_default_id;

-- status를 생략한 INSERT 시 기본값이 설정된다.
SAVEPOINT notifications_default_status;
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  sent_at
)
VALUES (
  current_setting('test.notifications_constraints_default_status_id')::uuid,
  current_setting('test.notifications_constraints_default_user_a_id')::uuid,
  'REVIEW',
  'default status',
  now()
);

SELECT is(
  (SELECT status FROM public.notifications WHERE id = current_setting('test.notifications_constraints_default_status_id')::uuid),
  'SENT',
  $$status를 생략한 INSERT 시 기본값이 설정된다.$$
);
ROLLBACK TO SAVEPOINT notifications_default_status;

-- sent_at을 생략한 INSERT 시 현재 시각에 근접한 값이 자동 설정된다.
SAVEPOINT notifications_default_sent_at;
SELECT set_config('test.notifications_constraints_default_sent_at_before', now()::text, true);
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  status
)
VALUES (
  current_setting('test.notifications_constraints_default_sent_at_id')::uuid,
  current_setting('test.notifications_constraints_default_user_a_id')::uuid,
  'REVIEW',
  'default sent_at',
  'SENT'
);
SELECT set_config('test.notifications_constraints_default_sent_at_after', now()::text, true);

SELECT ok(
  (
    (SELECT sent_at FROM public.notifications WHERE id = current_setting('test.notifications_constraints_default_sent_at_id')::uuid)
      BETWEEN current_setting('test.notifications_constraints_default_sent_at_before')::timestamptz - interval '2 seconds'
          AND current_setting('test.notifications_constraints_default_sent_at_after')::timestamptz + interval '2 seconds'
  ),
  $$sent_at을 생략한 INSERT 시 현재 시각에 근접한 값이 자동 설정된다.$$
);
ROLLBACK TO SAVEPOINT notifications_default_sent_at;

-- [예외 조건]
-- 없음 (DEFAULT는 차단 시나리오가 존재하지 않음)

-- [경계 조건]
-- id를 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 NOT NULL 제약 위반으로 실패해야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (NULL, current_setting('test.notifications_constraints_default_user_a_id')::uuid, 'REVIEW', 'null id', 'SENT', now());
  $sql$,
  '23502',
  'null value in column "id" of relation "notifications" violates not-null constraint',
  $$id를 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 NOT NULL 제약 위반으로 실패해야 한다.$$
);

-- status를 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 해당 컬럼의 NOT NULL 제약에 따라 실패해야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_default_user_a_id')::uuid, 'REVIEW', 'null status', NULL, now());
  $sql$,
  '23502',
  'null value in column "status" of relation "notifications" violates not-null constraint',
  $$status를 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 해당 컬럼의 NOT NULL 제약에 따라 실패해야 한다.$$
);

-- sent_at을 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 해당 컬럼의 제약 조건에 따라 실패해야 한다.
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (gen_random_uuid(), current_setting('test.notifications_constraints_default_user_a_id')::uuid, 'REVIEW', 'null sent_at', 'SENT', NULL);
  $sql$,
  '23502',
  'null value in column "sent_at" of relation "notifications" violates not-null constraint',
  $$sent_at을 명시적으로 NULL로 INSERT하려는 경우: → DEFAULT 적용 대상이 아니며 해당 컬럼의 제약 조건에 따라 실패해야 한다.$$
);

-- [불변 조건]
-- 명시적 NULL INSERT 실패 시 notifications의 전체 행 수는 증가하지 않아야 한다.
SELECT set_config(
  'test.notifications_constraints_default_notifications_count_before_failed_insert',
  (SELECT count(*)::text FROM public.notifications),
  true
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (id, user_id, type, title, status, sent_at)
    VALUES (NULL, current_setting('test.notifications_constraints_default_user_a_id')::uuid, 'REVIEW', 'transition null id', 'SENT', now());
  EXCEPTION
    WHEN not_null_violation THEN
      NULL;
  END;
END
$$;

SELECT is(
  (SELECT count(*) FROM public.notifications),
  current_setting('test.notifications_constraints_default_notifications_count_before_failed_insert')::bigint,
  $$명시적 NULL INSERT 실패 시 notifications의 전체 행 수는 증가하지 않아야 한다.$$
);

-- 모든 notifications 행의 id는 NULL이 아니어야 한다.
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE id IS NULL),
  0::bigint,
  $$모든 notifications 행의 id는 NULL이 아니어야 한다.$$
);

-- status가 NULL인 행은 존재하지 않아야 한다.
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE status IS NULL),
  0::bigint,
  $$status가 NULL인 행은 존재하지 않아야 한다.$$
);

-- sent_at이 NULL인 행은 존재하지 않아야 한다.
SELECT is(
  (SELECT count(*) FROM public.notifications WHERE sent_at IS NULL),
  0::bigint,
  $$sent_at이 NULL인 행은 존재하지 않아야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
