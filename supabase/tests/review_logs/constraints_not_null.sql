-- =========================================
-- review_logs / CONSTRAINTS_NOT_NULL
-- =========================================
-- TODO: add completed_at (nullable/transition) tests when domain behavior is confirmed

BEGIN;

SELECT plan(41);

-- 테스트용 UUID 준비
-- TODO: unify config key naming across test files
SELECT set_config('test.constraints_round_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_round_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_round_log_valid', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_not_null_note_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_note_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_note_note_a2', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_note_log_valid', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_not_null_user_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_user_user_b', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_user_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_user_note_b1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_user_log_valid', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_not_null_round_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_round_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_round_log_valid', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_not_null_scheduled_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_scheduled_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_scheduled_log_valid', gen_random_uuid()::text, true);

SELECT set_config('test.constraints_not_null_created_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_created_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_not_null_created_log_valid', gen_random_uuid()::text, true);



-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.constraints_round_user_a')::uuid, 'test.constraints_round_user_a_' || current_setting('test.constraints_round_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_note_user_a')::uuid, 'test.constraints_not_null_note_user_a_' || current_setting('test.constraints_not_null_note_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_user_user_a')::uuid, 'test.constraints_not_null_user_user_a_' || current_setting('test.constraints_not_null_user_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_user_user_b')::uuid, 'test.constraints_not_null_user_user_b_' || current_setting('test.constraints_not_null_user_user_b') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_round_user_a')::uuid, 'test.constraints_not_null_round_user_a_' || current_setting('test.constraints_not_null_round_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 'test.constraints_not_null_scheduled_user_a_' || current_setting('test.constraints_not_null_scheduled_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.constraints_not_null_created_user_a')::uuid, 'test.constraints_not_null_created_user_a_' || current_setting('test.constraints_not_null_created_user_a') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.constraints_round_note_a1')::uuid, current_setting('test.constraints_round_user_a')::uuid, 'round note', 'content', 1),
  (current_setting('test.constraints_not_null_note_note_a1')::uuid, current_setting('test.constraints_not_null_note_user_a')::uuid, 'not null note a1', 'content', 1),
  (current_setting('test.constraints_not_null_note_note_a2')::uuid, current_setting('test.constraints_not_null_note_user_a')::uuid, 'not null note a2', 'content', 1),
  (current_setting('test.constraints_not_null_user_note_a1')::uuid, current_setting('test.constraints_not_null_user_user_a')::uuid, 'not null user a1', 'content', 1),
  (current_setting('test.constraints_not_null_user_note_b1')::uuid, current_setting('test.constraints_not_null_user_user_b')::uuid, 'not null user b1', 'content', 1),
  (current_setting('test.constraints_not_null_round_note_a1')::uuid, current_setting('test.constraints_not_null_round_user_a')::uuid, 'not null round a1', 'content', 1),
  (current_setting('test.constraints_not_null_scheduled_note_a1')::uuid, current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 'not null scheduled a1', 'content', 1),
  (current_setting('test.constraints_not_null_created_note_a1')::uuid, current_setting('test.constraints_not_null_created_user_a')::uuid, 'not null created a1', 'content', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (current_setting('test.constraints_round_log_valid')::uuid, current_setting('test.constraints_round_note_a1')::uuid, current_setting('test.constraints_round_user_a')::uuid, 2, now() + interval '1 day'),
  (current_setting('test.constraints_not_null_note_log_valid')::uuid, current_setting('test.constraints_not_null_note_note_a1')::uuid, current_setting('test.constraints_not_null_note_user_a')::uuid, 1, now() + interval '2 days'),
  (current_setting('test.constraints_not_null_user_log_valid')::uuid, current_setting('test.constraints_not_null_user_note_a1')::uuid, current_setting('test.constraints_not_null_user_user_a')::uuid, 1, now() + interval '3 days'),
  (current_setting('test.constraints_not_null_round_log_valid')::uuid, current_setting('test.constraints_not_null_round_note_a1')::uuid, current_setting('test.constraints_not_null_round_user_a')::uuid, 1, now() + interval '4 days'),
  (current_setting('test.constraints_not_null_scheduled_log_valid')::uuid, current_setting('test.constraints_not_null_scheduled_note_a1')::uuid, current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 1, now() + interval '5 days'),
  (current_setting('test.constraints_not_null_created_log_valid')::uuid, current_setting('test.constraints_not_null_created_note_a1')::uuid, current_setting('test.constraints_not_null_created_user_a')::uuid, 1, now() + interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 정책 2: NOT NULL — note_id 필수 제약
-- =====================================================================
-- 규칙: review_logs.note_id는 NULL일 수 없다
-- [정답 조건]
-- NULL이 아닌 유효한 note_id로 review_logs를 생성할 수 있어야 한다
SAVEPOINT constraints_not_null_note_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '14 days');
    $sql$,
    current_setting('test.constraints_not_null_note_note_a1'),
    current_setting('test.constraints_not_null_note_user_a')
  ),
  $$NULL이 아닌 유효한 note_id로 review_logs를 생성할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_note_insert_valid;

-- 기존 유효 행의 note_id를 다른 유효한 note_id로 변경할 수 있어야 한다
SAVEPOINT constraints_not_null_note_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET note_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_note_note_a2'),
    current_setting('test.constraints_not_null_note_log_valid')
  ),
  $$기존 유효 행의 note_id를 다른 유효한 note_id로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_note_update_valid;

-- [예외 조건]
-- note_id가 NULL인 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), NULL, '%s'::uuid, 1, now() + interval '15 days');
    $sql$,
    current_setting('test.constraints_not_null_note_user_a')
  ),
  '23502',
  NULL,
  $$note_id가 NULL인 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 note_id를 NULL로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET note_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_note_log_valid')
  ),
  '23502',
  NULL,
  $$기존 유효 행의 note_id를 NULL로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 방금 생성한 유효한 note_id는 허용되어야 한다
SELECT set_config('test.constraints_not_null_note_boundary_new_note_id',
  gen_random_uuid()::text, true);

SAVEPOINT constraints_not_null_note_boundary_new;
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.constraints_not_null_note_boundary_new_note_id')::uuid,
  current_setting('test.constraints_not_null_note_user_a')::uuid,
  'not null note new', 'content', 1
);

SELECT lives_ok(
  format($sql$
    INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
    VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '16 days');
  $sql$,
  current_setting('test.constraints_not_null_note_boundary_new_note_id'),
  current_setting('test.constraints_not_null_note_user_a')
),
$$방금 생성한 유효한 note_id는 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_note_boundary_new;

-- NULL은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET note_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_note_log_valid')
  ),
  '23502',
  NULL,
  $$NULL은 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 note_id가 NULL인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id IS NULL),
  0::bigint,
  $$review_logs 테이블에는 note_id가 NULL인 행이 존재해서는 안 된다 (Status)$$
);

SELECT lives_ok(
  format(
    $sql$
      DO $do$
      DECLARE
        v_before uuid;
        v_after uuid;
      BEGIN
        SELECT note_id INTO v_before
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        BEGIN
          UPDATE public.review_logs
          SET note_id = NULL
          WHERE id = '%s'::uuid;
        EXCEPTION WHEN not_null_violation THEN
          NULL;
        END;

        SELECT note_id INTO v_after
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        IF v_after IS DISTINCT FROM v_before THEN
          RAISE EXCEPTION 'note_id changed after failed NULL update';
        END IF;
      END
      $do$;
    $sql$,
    current_setting('test.constraints_not_null_note_log_valid'),
    current_setting('test.constraints_not_null_note_log_valid'),
    current_setting('test.constraints_not_null_note_log_valid')
  ),
  $$NULL UPDATE 실패 시도 이후에도 기존 note_id 값은 유지되어야 한다 (Transition)$$
);

-- =====================================================================
-- 정책 3: NOT NULL — user_id 필수 제약
-- =====================================================================
-- 규칙: review_logs.user_id는 NULL일 수 없다

-- [정답 조건]
-- NULL이 아닌 유효한 user_id로 review_logs를 생성할 수 있어야 한다
SAVEPOINT constraints_not_null_user_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '17 days');
    $sql$,
    current_setting('test.constraints_not_null_user_note_a1'),
    current_setting('test.constraints_not_null_user_user_a')
  ),
  $$NULL이 아닌 유효한 user_id로 review_logs를 생성할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_user_insert_valid;

-- 기존 유효 행의 user_id를 다른 유효한 user_id로 변경할 수 있어야 한다
SAVEPOINT constraints_not_null_user_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_user_user_b'),
    current_setting('test.constraints_not_null_user_log_valid')
  ),
  $$기존 유효 행의 user_id를 다른 유효한 user_id로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_user_update_valid;

-- [예외 조건]
-- user_id가 NULL인 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, NULL, 1, now() + interval '18 days');
    $sql$,
    current_setting('test.constraints_not_null_user_note_a1')
  ),
  '23502',
  NULL,
  $$user_id가 NULL인 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 user_id를 NULL로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_user_log_valid')
  ),
  '23502',
  NULL,
  $$기존 유효 행의 user_id를 NULL로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 방금 생성한 유효한 user_id는 허용되어야 한다
SAVEPOINT constraints_not_null_user_boundary_new;
SELECT set_config('test.constraints_not_null_user_temp', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.constraints_not_null_user_temp')::uuid,
  'test.constraints_not_null_user_temp_' || current_setting('test.constraints_not_null_user_temp') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '19 days');
    $sql$,
    current_setting('test.constraints_not_null_user_note_a1'),
    current_setting('test.constraints_not_null_user_temp')
  ),
  $$방금 생성한 유효한 user_id는 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_user_boundary_new;

-- NULL은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_user_log_valid')
  ),
  '23502',
  NULL,
  $$NULL은 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 user_id가 NULL인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id IS NULL),
  0::bigint,
  $$review_logs 테이블에는 user_id가 NULL인 행이 존재해서는 안 된다 (Status)$$
);

SELECT lives_ok(
  format(
    $sql$
      DO $do$
      DECLARE
        v_before uuid;
        v_after uuid;
      BEGIN
        SELECT user_id INTO v_before
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        BEGIN
          UPDATE public.review_logs
          SET user_id = NULL
          WHERE id = '%s'::uuid;
        EXCEPTION WHEN not_null_violation THEN
          NULL;
        END;

        SELECT user_id INTO v_after
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        IF v_after IS DISTINCT FROM v_before THEN
          RAISE EXCEPTION 'user_id changed after failed NULL update';
        END IF;
      END
      $do$;
    $sql$,
    current_setting('test.constraints_not_null_user_log_valid'),
    current_setting('test.constraints_not_null_user_log_valid'),
    current_setting('test.constraints_not_null_user_log_valid')
  ),
  $$NULL UPDATE 실패 시도 이후에도 기존 user_id 값은 유지되어야 한다 (Transition)$$
);

-- =====================================================================
-- 정책 4: NOT NULL — round 필수 제약
-- =====================================================================
-- 규칙: review_logs.round는 NULL일 수 없다
-- [정답 조건]
-- NULL이 아닌 유효한 round로 review_logs를 생성할 수 있어야 한다
SAVEPOINT constraints_not_null_round_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '20 days');
    $sql$,
    current_setting('test.constraints_not_null_round_note_a1'),
    current_setting('test.constraints_not_null_round_user_a')
  ),
  $$NULL이 아닌 유효한 round로 review_logs를 생성할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_round_insert_valid;

-- 기존 유효 행의 round를 다른 유효한 round로 변경할 수 있어야 한다
SAVEPOINT constraints_not_null_round_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = 2
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_round_log_valid')
  ),
  $$기존 유효 행의 round를 다른 유효한 round로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_round_update_valid;

-- [예외 조건]
-- round가 NULL인 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, NULL, now() + interval '21 days');
    $sql$,
    current_setting('test.constraints_not_null_round_note_a1'),
    current_setting('test.constraints_not_null_round_user_a')
  ),
  '23502',
  NULL,
  $$round가 NULL인 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 round를 NULL로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_round_log_valid')
  ),
  '23502',
  NULL,
  $$기존 유효 행의 round를 NULL로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- round = 1은 허용되어야 한다
SAVEPOINT constraints_not_null_round_boundary_1;
UPDATE public.review_logs
SET round = 1
WHERE id = current_setting('test.constraints_not_null_round_log_valid')::uuid;
SELECT is(
  (SELECT round FROM public.review_logs WHERE id = current_setting('test.constraints_not_null_round_log_valid')::uuid),
  1,
  $$round = 1은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_round_boundary_1;

-- round = 3은 허용되어야 한다
SAVEPOINT constraints_not_null_round_boundary_3;
UPDATE public.review_logs
SET round = 3
WHERE id = current_setting('test.constraints_not_null_round_log_valid')::uuid;
SELECT is(
  (SELECT round FROM public.review_logs WHERE id = current_setting('test.constraints_not_null_round_log_valid')::uuid),
  3,
  $$round = 3은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_round_boundary_3;

-- NULL은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_round_log_valid')
  ),
  '23502',
  NULL,
  $$NULL은 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 round가 NULL인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE round IS NULL),
  0::bigint,
  $$review_logs 테이블에는 round가 NULL인 행이 존재해서는 안 된다 (Status)$$
);

SELECT lives_ok(
  format(
    $sql$
      DO $do$
      DECLARE
        v_before integer;
        v_after integer;
      BEGIN
        SELECT round INTO v_before
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        BEGIN
          UPDATE public.review_logs
          SET round = NULL
          WHERE id = '%s'::uuid;
        EXCEPTION WHEN not_null_violation THEN
          NULL;
        END;

        SELECT round INTO v_after
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        IF v_after IS DISTINCT FROM v_before THEN
          RAISE EXCEPTION 'round changed after failed NULL update';
        END IF;
      END
      $do$;
    $sql$,
    current_setting('test.constraints_not_null_round_log_valid'),
    current_setting('test.constraints_not_null_round_log_valid'),
    current_setting('test.constraints_not_null_round_log_valid')
  ),
  $$NULL UPDATE 실패 시도 이후에도 기존 round 값은 유지되어야 한다 (Transition)$$
);

-- =====================================================================
-- 정책 5: NOT NULL — scheduled_at 필수 제약
-- =====================================================================
-- 규칙: review_logs.scheduled_at은 NULL일 수 없다

-- [정답 조건]
-- NULL이 아닌 유효한 scheduled_at으로 review_logs를 생성할 수 있어야 한다
SAVEPOINT constraints_not_null_scheduled_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '22 days');
    $sql$,
    current_setting('test.constraints_not_null_scheduled_note_a1'),
    current_setting('test.constraints_not_null_scheduled_user_a')
  ),
  $$NULL이 아닌 유효한 scheduled_at으로 review_logs를 생성할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_scheduled_insert_valid;

-- 기존 유효 행의 scheduled_at을 다른 유효한 시각으로 변경할 수 있어야 한다
SAVEPOINT constraints_not_null_scheduled_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET scheduled_at = now() + interval '30 days'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_scheduled_log_valid')
  ),
  $$기존 유효 행의 scheduled_at을 다른 유효한 시각으로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_scheduled_update_valid;

-- [예외 조건]
-- scheduled_at이 NULL인 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, NULL);
    $sql$,
    current_setting('test.constraints_not_null_scheduled_note_a1'),
    current_setting('test.constraints_not_null_scheduled_user_a')
  ),
  '23502',
  NULL,
  $$scheduled_at이 NULL인 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 scheduled_at을 NULL로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET scheduled_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_scheduled_log_valid')
  ),
  '23502',
  NULL,
  $$기존 유효 행의 scheduled_at을 NULL로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 과거/현재/미래 시각 자체는 스키마에 금지 규칙이 없으므로 NULL이 아니면 허용되어야 한다
SAVEPOINT constraints_not_null_scheduled_boundary_times;
WITH inserted AS (
  INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
  VALUES
    (gen_random_uuid(), current_setting('test.constraints_not_null_scheduled_note_a1')::uuid, current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 1, now() - interval '1 day'),
    (gen_random_uuid(), current_setting('test.constraints_not_null_scheduled_note_a1')::uuid, current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 1, now()),
    (gen_random_uuid(), current_setting('test.constraints_not_null_scheduled_note_a1')::uuid, current_setting('test.constraints_not_null_scheduled_user_a')::uuid, 1, now() + interval '1 day')
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM inserted),
  3::bigint,
  $$과거/현재/미래 시각 자체는 스키마에 금지 규칙이 없으므로 NULL이 아니면 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_scheduled_boundary_times;

-- NULL은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET scheduled_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_scheduled_log_valid')
  ),
  '23502',
  NULL,
  $$NULL은 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 scheduled_at이 NULL인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE scheduled_at IS NULL),
  0::bigint,
  $$review_logs 테이블에는 scheduled_at이 NULL인 행이 존재해서는 안 된다 (Status)$$
);

SELECT lives_ok(
  format(
    $sql$
      DO $do$
      DECLARE
        v_before timestamptz;
        v_after timestamptz;
      BEGIN
        SELECT scheduled_at INTO v_before
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        BEGIN
          UPDATE public.review_logs
          SET scheduled_at = NULL
          WHERE id = '%s'::uuid;
        EXCEPTION WHEN not_null_violation THEN
          NULL;
        END;

        SELECT scheduled_at INTO v_after
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        IF v_after IS DISTINCT FROM v_before THEN
          RAISE EXCEPTION 'scheduled_at changed after failed NULL update';
        END IF;
      END
      $do$;
    $sql$,
    current_setting('test.constraints_not_null_scheduled_log_valid'),
    current_setting('test.constraints_not_null_scheduled_log_valid'),
    current_setting('test.constraints_not_null_scheduled_log_valid')
  ),
  $$NULL UPDATE 실패 시도 이후에도 기존 scheduled_at 값은 유지되어야 한다 (Transition)$$
);

-- =====================================================================
-- 정책 6: NOT NULL — created_at 필수 제약
-- =====================================================================
-- 규칙: review_logs.created_at은 NULL일 수 없다
-- [정답 조건]
-- NULL이 아닌 유효한 created_at으로 review_logs를 생성할 수 있어야 한다
SAVEPOINT constraints_not_null_created_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, created_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '23 days', now() - interval '1 day');
    $sql$,
    current_setting('test.constraints_not_null_created_note_a1'),
    current_setting('test.constraints_not_null_created_user_a')
  ),
  $$NULL이 아닌 유효한 created_at으로 review_logs를 생성할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_created_insert_valid;

-- 기존 유효 행의 created_at을 다른 유효한 시각으로 변경할 수 있어야 한다
SAVEPOINT constraints_not_null_created_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET created_at = now() - interval '2 days'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_created_log_valid')
  ),
  $$기존 유효 행의 created_at을 다른 유효한 시각으로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_created_update_valid;

-- [예외 조건]
-- created_at이 NULL인 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, created_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '24 days', NULL);
    $sql$,
    current_setting('test.constraints_not_null_created_note_a1'),
    current_setting('test.constraints_not_null_created_user_a')
  ),
  '23502',
  NULL,
  $$created_at이 NULL인 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 created_at을 NULL로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET created_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_created_log_valid')
  ),
  '23502',
  NULL,
  $$기존 유효 행의 created_at을 NULL로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 명시적으로 유효한 created_at을 넣는 INSERT는 허용되어야 한다
SAVEPOINT constraints_not_null_created_boundary_explicit;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at, created_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '25 days', now());
    $sql$,
    current_setting('test.constraints_not_null_created_note_a1'),
    current_setting('test.constraints_not_null_created_user_a')
  ),
  $$명시적으로 유효한 created_at을 넣는 INSERT는 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_not_null_created_boundary_explicit;

-- NULL은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET created_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_not_null_created_log_valid')
  ),
  '23502',
  NULL,
  $$NULL은 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE created_at IS NULL),
  0::bigint,
  $$review_logs 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다 (Status)$$
);

SELECT lives_ok(
  format(
    $sql$
      DO $do$
      DECLARE
        v_before timestamptz;
        v_after timestamptz;
      BEGIN
        SELECT created_at INTO v_before
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        BEGIN
          UPDATE public.review_logs
          SET created_at = NULL
          WHERE id = '%s'::uuid;
        EXCEPTION WHEN not_null_violation THEN
          NULL;
        END;

        SELECT created_at INTO v_after
        FROM public.review_logs
        WHERE id = '%s'::uuid;

        IF v_after IS DISTINCT FROM v_before THEN
          RAISE EXCEPTION 'created_at changed after failed NULL update';
        END IF;
      END
      $do$;
    $sql$,
    current_setting('test.constraints_not_null_created_log_valid'),
    current_setting('test.constraints_not_null_created_log_valid'),
    current_setting('test.constraints_not_null_created_log_valid')
  ),
  $$NULL UPDATE 실패 시도 이후에도 기존 created_at 값은 유지되어야 한다 (Transition)$$
);

-- =====================================================================
SELECT * FROM finish();
ROLLBACK;
