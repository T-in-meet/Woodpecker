-- =========================================
-- notifications / RLS
-- =========================================


BEGIN;

SELECT plan(33);

-- 테스트용 UUID 준비
SELECT set_config('test.notifications_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_single_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_insert_min_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_insert_max_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_insert_own_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_insert_other_id', gen_random_uuid()::text, true);
SELECT set_config('test.notifications_rls_insert_transition_id', gen_random_uuid()::text, true);

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
    current_setting('test.notifications_rls_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_a_' || current_setting('test.notifications_rls_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notifications_rls_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_b_' || current_setting('test.notifications_rls_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.notifications_rls_user_c_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'user_c_' || current_setting('test.notifications_rls_user_c_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- seed: notifications
INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  body,
  status
)
VALUES
  (
    current_setting('test.notifications_rls_a1_id')::uuid,
    current_setting('test.notifications_rls_user_a_id')::uuid,
    'REVIEW',
    'a1 title',
    'a1 body',
    'SENT'
  ),
  (
    current_setting('test.notifications_rls_a2_id')::uuid,
    current_setting('test.notifications_rls_user_a_id')::uuid,
    'REMINDER',
    'a2 title',
    'a2 body',
    'SENT'
  ),
  (
    current_setting('test.notifications_rls_b1_id')::uuid,
    current_setting('test.notifications_rls_user_b_id')::uuid,
    'REVIEW',
    'b1 title',
    'b1 body',
    'SENT'
  )
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- [정답 조건]
-- user_a 조회 시 → user_a 데이터만 반환
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_rls_user_a_id')::uuid),
  2::bigint,
  $$user_a 조회 시 → user_a 데이터만 반환$$
);

-- user_b 조회 시 → user_b 데이터만 반환
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_rls_user_b_id')::uuid),
  1::bigint,
  $$user_b 조회 시 → user_b 데이터만 반환$$
);

-- user_c 조회 시 → 빈 결과 반환
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  0::bigint,
  $$user_c 조회 시 → 빈 결과 반환$$
);

-- [예외 조건]
-- 타인의 notifications는 조회되지 않아야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_rls_user_b_id')::uuid),
  0::bigint,
  $$타인의 notifications는 조회되지 않아야 한다.$$
);

-- [경계 조건]
-- 전체 조회 (조건 없음) → 본인 데이터만 반환
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  1::bigint,
  $$전체 조회 (조건 없음) → 본인 데이터만 반환$$
);

-- 조건 조회 (user_id 조건 포함) → 본인 데이터만 반환
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.notifications
    WHERE user_id IN (
      current_setting('test.notifications_rls_user_a_id')::uuid,
      current_setting('test.notifications_rls_user_b_id')::uuid
    )
  ),
  2::bigint,
  $$조건 조회 (user_id 조건 포함) → 본인 데이터만 반환$$
);

-- 데이터 0건 → 빈 결과 반환
SAVEPOINT notifications_rls_boundary_zero;
RESET ROLE;
DELETE FROM public.notifications
WHERE user_id = current_setting('test.notifications_rls_user_a_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  0::bigint,
  $$데이터 0건 → 빈 결과 반환$$
);

ROLLBACK TO SAVEPOINT notifications_rls_boundary_zero;

-- 데이터 1건 → 정확히 1건 반환
SAVEPOINT notifications_rls_boundary_one;
RESET ROLE;
DELETE FROM public.notifications
WHERE user_id = current_setting('test.notifications_rls_user_a_id')::uuid;

INSERT INTO public.notifications (
  id,
  user_id,
  type,
  title,
  body,
  status
)
VALUES (
  current_setting('test.notifications_rls_single_id')::uuid,
  current_setting('test.notifications_rls_user_a_id')::uuid,
  'REVIEW',
  'single title',
  'single body',
  'SENT'
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  1::bigint,
  $$데이터 1건 → 정확히 1건 반환$$
);

ROLLBACK TO SAVEPOINT notifications_rls_boundary_one;

-- 데이터 다건 → 해당 사용자 데이터만 반환
SELECT is(
  (SELECT count(*) FROM public.notifications),
  2::bigint,
  $$데이터 다건 → 해당 사용자 데이터만 반환$$
);

-- [불변 조건]
-- 조회 결과에는 항상 auth.uid()와 동일한 user_id만 포함되어야 한다.
SELECT ok(
  (
    (SELECT count(*) FROM public.notifications WHERE user_id = current_setting('test.notifications_rls_user_a_id')::uuid) = 2
    AND (SELECT count(*) FROM public.notifications WHERE user_id <> current_setting('test.notifications_rls_user_a_id')::uuid) = 0
  ),
  $$조회 결과에는 항상 auth.uid()와 동일한 user_id만 포함되어야 한다.$$
);

-- [정답 조건]
-- 정책상 authenticated 사용자에게 허용된 INSERT 성공 경로가 존재하지 않는다.

-- [예외 조건]
-- 모든 INSERT 시도는 실패해야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title, body, status)
      VALUES ('%s'::uuid, '%s'::uuid, 'ALERT', 'insert denied', 'body', 'SENT');
    $sql$,
    gen_random_uuid(),
    current_setting('test.notifications_rls_user_a_id')
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  $$모든 INSERT 시도는 실패해야 한다.$$
);

-- [경계 조건]
-- 최소 유효 입력 → 차단
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REVIEW', 'min title');
    $sql$,
    current_setting('test.notifications_rls_insert_min_id'),
    current_setting('test.notifications_rls_user_a_id')
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  $$최소 유효 입력 → 차단$$
);

-- 최대 유효 입력 → 차단
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (
        id,
        user_id,
        type,
        title,
        body,
        status,
        sent_at,
        read_at,
        skipped_at,
        note_id
      )
      VALUES (
        '%s'::uuid,
        '%s'::uuid,
        '%s',
        '%s',
        '%s',
        'READ',
        now(),
        now(),
        now(),
        NULL
      );
    $sql$,
    current_setting('test.notifications_rls_insert_max_id'),
    current_setting('test.notifications_rls_user_a_id'),
    repeat('T', 50),
    repeat('X', 200),
    repeat('B', 500)
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  $$최대 유효 입력 → 차단$$
);

-- 본인 명의(user_id = auth.uid()) → 차단
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REMINDER', 'own denied');
    $sql$,
    current_setting('test.notifications_rls_insert_own_id'),
    current_setting('test.notifications_rls_user_a_id')
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  $$본인 명의(user_id = auth.uid()) → 차단$$
);

-- 타인 명의(user_id ≠ auth.uid()) → 차단
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notifications (id, user_id, type, title)
      VALUES ('%s'::uuid, '%s'::uuid, 'REMINDER', 'other denied');
    $sql$,
    current_setting('test.notifications_rls_insert_other_id'),
    current_setting('test.notifications_rls_user_b_id')
  ),
  '42501',
  'new row violates row-level security policy for table "notifications"',
  $$타인 명의(user_id ≠ auth.uid()) → 차단$$
);

-- [불변 조건]
-- INSERT 시도 전후 전체 notifications 행 수는 동일해야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_insert_before_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

DO $$
BEGIN
  INSERT INTO public.notifications (id, user_id, type, title)
  VALUES (gen_random_uuid(), current_setting('test.notifications_rls_user_a_id')::uuid, 'REVIEW', 'blocked');
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_insert_after_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  current_setting('test.notifications_rls_insert_before_total')::bigint,
  current_setting('test.notifications_rls_insert_after_total')::bigint,
  $$INSERT 시도 전후 전체 notifications 행 수는 동일해야 한다.$$
);

-- INSERT 시도 전 스냅샷과 비교했을 때, 시도 후에도 새로운 notifications.id가 추가되지 않아야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_insert_before_exists',
  (
    SELECT count(*)
    FROM public.notifications
    WHERE id = current_setting('test.notifications_rls_insert_transition_id')::uuid
  )::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

DO $$
BEGIN
  INSERT INTO public.notifications (id, user_id, type, title)
  VALUES (
    current_setting('test.notifications_rls_insert_transition_id')::uuid,
    current_setting('test.notifications_rls_user_a_id')::uuid,
    'REVIEW',
    'transition blocked'
  );
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_insert_after_exists',
  (
    SELECT count(*)
    FROM public.notifications
    WHERE id = current_setting('test.notifications_rls_insert_transition_id')::uuid
  )::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  (
    current_setting('test.notifications_rls_insert_before_exists')::bigint = 0
    AND current_setting('test.notifications_rls_insert_after_exists')::bigint = 0
  ),
  $$INSERT 시도 전 스냅샷과 비교했을 때, 시도 후에도 새로운 notifications.id가 추가되지 않아야 한다.$$
);

-- [정답 조건]
-- 정책상 authenticated 사용자에게 허용된 UPDATE 성공 경로가 존재하지 않는다.

-- [예외 조건]
-- 모든 UPDATE 시도는 실패해야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.notifications
  SET title = 'blocked update'
  WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$모든 UPDATE 시도는 실패해야 한다.$$
);

-- [경계 조건]
-- 단일 컬럼 수정 → 차단
WITH updated AS (
  UPDATE public.notifications
  SET status = 'READ'
  WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$단일 컬럼 수정 → 차단$$
);

-- 다중 컬럼 수정 → 차단
WITH updated AS (
  UPDATE public.notifications
  SET title = 'multi', body = 'multi body'
  WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$다중 컬럼 수정 → 차단$$
);

-- 본인 행(user_id = auth.uid()) → 차단
WITH updated AS (
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = current_setting('test.notifications_rls_user_a_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$본인 행(user_id = auth.uid()) → 차단$$
);

-- 타인 행(user_id ≠ auth.uid()) → 차단
WITH updated AS (
  UPDATE public.notifications
  SET skipped_at = now()
  WHERE id = current_setting('test.notifications_rls_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$타인 행(user_id ≠ auth.uid()) → 차단$$
);

-- 본인 소유 행이 0건인 사용자는 UPDATE 가능한 행이 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH updated AS (
  UPDATE public.notifications
  SET title = 'user_c blocked update'
  WHERE user_id = current_setting('test.notifications_rls_user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$본인 소유 행이 0건인 사용자는 UPDATE 가능한 행이 0건이어야 한다.$$
);

-- [불변 조건]
-- UPDATE 시도 전후 전체 notifications 행 수는 동일해야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_update_before_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

UPDATE public.notifications
SET title = 'blocked update total'
WHERE id = current_setting('test.notifications_rls_a2_id')::uuid;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_update_after_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  current_setting('test.notifications_rls_update_before_total')::bigint,
  current_setting('test.notifications_rls_update_after_total')::bigint,
  $$UPDATE 시도 전후 전체 notifications 행 수는 동일해야 한다.$$
);

-- UPDATE 시도 전후 대상 행의 status, title, body, read_at, skipped_at, note_id 값은 변경되지 않아야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_update_before_snapshot',
  (
    SELECT row_to_json(t)::text
    FROM (
      SELECT status, title, body, read_at, skipped_at, note_id
      FROM public.notifications
      WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
    ) t
  ),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

UPDATE public.notifications
SET title = 'blocked transition', body = 'blocked transition body'
WHERE id = current_setting('test.notifications_rls_a1_id')::uuid;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_update_after_snapshot',
  (
    SELECT row_to_json(t)::text
    FROM (
      SELECT status, title, body, read_at, skipped_at, note_id
      FROM public.notifications
      WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
    ) t
  ),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  current_setting('test.notifications_rls_update_before_snapshot') = current_setting('test.notifications_rls_update_after_snapshot'),
  $$UPDATE 시도 전후 대상 행의 status, title, body, read_at, skipped_at, note_id 값은 변경되지 않아야 한다.$$
);

-- [정답 조건]
-- 정책상 authenticated 사용자에게 허용된 DELETE 성공 경로가 존재하지 않는다.

-- [예외 조건]
-- 모든 DELETE 시도는 실패해야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH deleted AS (
  DELETE FROM public.notifications
  WHERE id = current_setting('test.notifications_rls_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$모든 DELETE 시도는 실패해야 한다.$$
);

-- [경계 조건]
-- 단건 삭제 → 차단
WITH deleted AS (
  DELETE FROM public.notifications
  WHERE id = current_setting('test.notifications_rls_a2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$단건 삭제 → 차단$$
);

-- 다건 삭제 → 차단
WITH deleted AS (
  DELETE FROM public.notifications
  WHERE user_id IN (
    current_setting('test.notifications_rls_user_a_id')::uuid,
    current_setting('test.notifications_rls_user_b_id')::uuid
  )
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$다건 삭제 → 차단$$
);

-- 본인 행(user_id = auth.uid()) → 차단
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_b_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH deleted AS (
  DELETE FROM public.notifications
  WHERE id = current_setting('test.notifications_rls_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$본인 행(user_id = auth.uid()) → 차단$$
);

-- 타인 행(user_id ≠ auth.uid()) → 차단
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH deleted AS (
  DELETE FROM public.notifications
  WHERE id = current_setting('test.notifications_rls_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$타인 행(user_id ≠ auth.uid()) → 차단$$
);

-- 본인 소유 행이 0건인 사용자는 DELETE 가능한 행이 0건이어야 한다.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_c_id'),
    'role', 'authenticated'
  )::text,
  true
);

WITH deleted AS (
  DELETE FROM public.notifications
  WHERE user_id = current_setting('test.notifications_rls_user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$본인 소유 행이 0건인 사용자는 DELETE 가능한 행이 0건이어야 한다.$$
);

-- [불변 조건]
-- DELETE 시도 전후 전체 notifications 행 수는 동일해야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_delete_before_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

DELETE FROM public.notifications
WHERE id = current_setting('test.notifications_rls_a1_id')::uuid;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_delete_after_total',
  (SELECT count(*) FROM public.notifications)::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT is(
  current_setting('test.notifications_rls_delete_before_total')::bigint,
  current_setting('test.notifications_rls_delete_after_total')::bigint,
  $$DELETE 시도 전후 전체 notifications 행 수는 동일해야 한다.$$
);

-- DELETE 시도 대상 행은 시도 이후에도 그대로 존재해야 한다.
RESET ROLE;
SELECT set_config(
  'test.notifications_rls_delete_before_exists',
  (
    SELECT count(*)
    FROM public.notifications
    WHERE id = current_setting('test.notifications_rls_a2_id')::uuid
  )::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

DELETE FROM public.notifications
WHERE id = current_setting('test.notifications_rls_a2_id')::uuid;

RESET ROLE;
SELECT set_config(
  'test.notifications_rls_delete_after_exists',
  (
    SELECT count(*)
    FROM public.notifications
    WHERE id = current_setting('test.notifications_rls_a2_id')::uuid
  )::text,
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notifications_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT ok(
  (
    current_setting('test.notifications_rls_delete_before_exists')::bigint = 1
    AND current_setting('test.notifications_rls_delete_after_exists')::bigint = 1
  ),
  $$DELETE 시도 대상 행은 시도 이후에도 그대로 존재해야 한다.$$
);

SELECT * FROM finish();
ROLLBACK;
