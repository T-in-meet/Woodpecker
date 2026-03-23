-- =========================================
-- review_logs / CONSTRAINTS_CHECK
-- =========================================

BEGIN;

SELECT plan(13);

-- 테스트용 UUID 준비
SELECT set_config('test.constraints_round_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_round_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.constraints_round_log_valid', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    current_setting('test.constraints_round_user_a')::uuid,
    'test.constraints_round_user_a_' || current_setting('test.constraints_round_user_a') || '@example.com',
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.constraints_round_note_a1')::uuid,
    current_setting('test.constraints_round_user_a')::uuid,
    'round note',
    'content',
    1
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.constraints_round_log_valid')::uuid,
    current_setting('test.constraints_round_note_a1')::uuid,
    current_setting('test.constraints_round_user_a')::uuid,
    2,
    now() + interval '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 정책 1: CHECK — round 범위 제약
-- =====================================================================
-- [정답 조건]
-- round = 1인 review_logs는 생성될 수 있어야 한다
SAVEPOINT constraints_round_insert_1;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '7 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  $$round = 1인 review_logs는 생성될 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_insert_1;

-- round = 2인 review_logs는 생성될 수 있어야 한다
SAVEPOINT constraints_round_insert_2;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 2, now() + interval '8 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  $$round = 2인 review_logs는 생성될 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_insert_2;

-- round = 3인 review_logs는 생성될 수 있어야 한다
SAVEPOINT constraints_round_insert_3;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 3, now() + interval '9 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  $$round = 3인 review_logs는 생성될 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_insert_3;

-- 기존 유효 행의 round를 1, 2, 3 중 다른 유효 값으로 변경할 수 있어야 한다
SAVEPOINT constraints_round_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = 1
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_round_log_valid')
  ),
  $$기존 유효 행의 round를 1, 2, 3 중 다른 유효 값으로 변경할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_update_valid;

-- [예외 조건]
-- round가 1보다 작은 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, -1, now() + interval '10 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  '23514',
  NULL,
  $$round가 1보다 작은 review_logs는 생성될 수 없어야 한다$$
);

-- round가 3보다 큰 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 5, now() + interval '11 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  '23514',
  NULL,
  $$round가 3보다 큰 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 유효 행의 round를 1보다 작은 값으로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = -1
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_round_log_valid')
  ),
  '23514',
  NULL,
  $$기존 유효 행의 round를 1보다 작은 값으로 변경할 수 없어야 한다$$
);

-- 기존 유효 행의 round를 3보다 큰 값으로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = 5
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.constraints_round_log_valid')
  ),
  '23514',
  NULL,
  $$기존 유효 행의 round를 3보다 큰 값으로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 하한 경계값인 round = 1은 허용되어야 한다
SAVEPOINT constraints_round_boundary_1;
UPDATE public.review_logs
SET round = 1
WHERE id = current_setting('test.constraints_round_log_valid')::uuid;
SELECT is(
  (SELECT round FROM public.review_logs WHERE id = current_setting('test.constraints_round_log_valid')::uuid),
  1,
  $$하한 경계값인 round = 1은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_boundary_1;

-- 상한 경계값인 round = 3은 허용되어야 한다
SAVEPOINT constraints_round_boundary_3;
UPDATE public.review_logs
SET round = 3
WHERE id = current_setting('test.constraints_round_log_valid')::uuid;
SELECT is(
  (SELECT round FROM public.review_logs WHERE id = current_setting('test.constraints_round_log_valid')::uuid),
  3,
  $$상한 경계값인 round = 3은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT constraints_round_boundary_3;

-- 하한 바로 바깥값인 round = 0은 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 0, now() + interval '12 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  '23514',
  NULL,
  $$하한 바로 바깥값인 round = 0은 허용되지 않아야 한다$$
);

-- 상한 바로 바깥값인 round = 4는 허용되지 않아야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 4, now() + interval '13 days');
    $sql$,
    current_setting('test.constraints_round_note_a1'),
    current_setting('test.constraints_round_user_a')
  ),
  '23514',
  NULL,
  $$상한 바로 바깥값인 round = 4는 허용되지 않아야 한다$$
);

-- [불변 조건]
-- review_logs 테이블에는 round가 1 미만이거나 3 초과인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE round < 1 OR round > 3),
  0::bigint,
  $$review_logs 테이블에는 round가 1 미만이거나 3 초과인 행이 존재해서는 안 된다 (Status)$$
);

-- =====================================================================
SELECT * FROM finish();
ROLLBACK;
