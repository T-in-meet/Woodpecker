-- =========================================
-- notes / CONSTRAINTS_CHECK
-- =========================================

BEGIN;

SELECT plan(25);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_check_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_invalid_high_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_invalid_low_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_boundary_move_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_boundary_fail_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_invariant_status_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_invariant_other_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_constraints_check_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_constraints_check_user_a_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  review_round
)
VALUES
  (
    current_setting('test.notes_constraints_check_note_update_valid_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update valid seed',
    'update valid content',
    0
  ),
  (
    current_setting('test.notes_constraints_check_note_update_invalid_high_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update invalid high seed',
    'update invalid high content',
    2
  ),
  (
    current_setting('test.notes_constraints_check_note_update_invalid_low_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update invalid low seed',
    'update invalid low content',
    1
  ),
  (
    current_setting('test.notes_constraints_check_note_boundary_move_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'boundary move seed',
    'boundary move content',
    0
  ),
  (
    current_setting('test.notes_constraints_check_note_boundary_fail_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'boundary fail seed',
    'boundary fail content',
    3
  ),
  (
    current_setting('test.notes_constraints_check_note_invariant_status_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'invariant status seed',
    'invariant status content',
    2
  ),
  (
    current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'invariant other seed',
    'invariant other content',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- review_round = 0으로 INSERT 시 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr0', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 0으로 INSERT 시 성공해야 한다$$
);

-- review_round = 1으로 INSERT 시 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr1', 'content', 1);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 1으로 INSERT 시 성공해야 한다$$
);

-- review_round = 2로 INSERT 시 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr2', 'content', 2);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 2로 INSERT 시 성공해야 한다$$
);

-- review_round = 3으로 INSERT 시 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr3', 'content', 3);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 3으로 INSERT 시 성공해야 한다$$
);

-- review_round가 유효한 값(0~3)에서 다른 유효한 값으로 UPDATE 시 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 1
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_update_valid_id')
  ),
  $$review_round가 유효한 값(0~3)에서 다른 유효한 값으로 UPDATE 시 성공해야 한다$$
);

-- [예외 조건]
-- review_round = -1로 INSERT 시 CHECK 제약 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr-1', 'content', -1);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$review_round = -1로 INSERT 시 CHECK 제약 위반으로 실패해야 한다$$
);

-- review_round = 4로 INSERT 시 CHECK 제약 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr4', 'content', 4);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$review_round = 4로 INSERT 시 CHECK 제약 위반으로 실패해야 한다$$
);

-- review_round를 범위 초과 값(5)으로 UPDATE 시 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 5
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_update_invalid_high_id')
  ),
  '23514',
  NULL,
  $$review_round를 범위 초과 값(5)으로 UPDATE 시 실패해야 한다$$
);

-- review_round를 범위 미만 값(-1)으로 UPDATE 시 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = -1
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_update_invalid_low_id')
  ),
  '23514',
  NULL,
  $$review_round를 범위 미만 값(-1)으로 UPDATE 시 실패해야 한다$$
);

-- [경계 조건]
-- review_round = 0은 성공해야 한다 (최소값)
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr0b', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 0은 성공해야 한다 (최소값)$$
);

-- review_round = 3은 성공해야 한다 (최대값)
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr3b', 'content', 3);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$review_round = 3은 성공해야 한다 (최대값)$$
);

-- review_round = -1은 실패해야 한다 (최소값 바로 아래)
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr-1b', 'content', -1);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$review_round = -1은 실패해야 한다 (최소값 바로 아래)$$
);

-- review_round = 4는 실패해야 한다 (최대값 바로 위)
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr4b', 'content', 4);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$review_round = 4는 실패해야 한다 (최대값 바로 위)$$
);

-- review_round = 0 → 3으로 UPDATE는 성공해야 한다 (경계 내부 이동)
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 3
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_boundary_move_id')
  ),
  $$review_round = 0 → 3으로 UPDATE는 성공해야 한다 (경계 내부 이동)$$
);

-- review_round = 3 → 4로 UPDATE는 실패해야 한다 (경계 초과)
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 4
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_boundary_fail_id')
  ),
  '23514',
  NULL,
  $$review_round = 3 → 4로 UPDATE는 실패해야 한다 (경계 초과)$$
);

-- [불변 조건]
-- notes 테이블에는 review_round < 0인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round < 0),
  0::bigint,
  $$notes 테이블에는 review_round < 0인 행이 존재해서는 안 된다 (Status)$$
);

-- notes 테이블에는 review_round > 3인 행이 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round > 3),
  0::bigint,
  $$notes 테이블에는 review_round > 3인 행이 존재해서는 안 된다 (Status)$$
);

-- 유효한 값으로 UPDATE 후 review_round는 항상 0~3 범위를 유지해야 한다 (Status)
UPDATE public.notes
SET review_round = 3
WHERE id = current_setting('test.notes_constraints_check_note_invariant_status_id')::uuid;
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id = current_setting('test.notes_constraints_check_note_invariant_status_id')::uuid
     AND review_round BETWEEN 0 AND 3),
  1::bigint,
  $$유효한 값으로 UPDATE 후 review_round는 항상 0~3 범위를 유지해야 한다 (Status)$$
);

-- UPDATE 성공 시 수정 대상 외 컬럼(id, user_id, created_at 등)은 변경되지 않아야 한다 (Transition)
SELECT set_config(
  'test.notes_constraints_check_other_before_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_constraints_check_other_before_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid),
  true
);
UPDATE public.notes
SET review_round = 3
WHERE id = current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid;
SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE id = current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid
      AND user_id::text = current_setting('test.notes_constraints_check_other_before_user_id')
      AND created_at::text = current_setting('test.notes_constraints_check_other_before_created_at')
  ),
  1::bigint,
  $$UPDATE 성공 시 수정 대상 외 컬럼(id, user_id, created_at 등)은 변경되지 않아야 한다 (Transition)$$
);

-- [정답 조건]
-- title이 1자이면 INSERT가 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'a', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$title이 1자이면 INSERT가 성공해야 한다$$
);

-- title이 100자이면 INSERT가 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('a', 100), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$title이 100자이면 INSERT가 성공해야 한다$$
);

-- [예외 조건]
-- title이 101자이면 INSERT가 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('a', 101), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '22001',
  NULL,
  $$title이 101자이면 INSERT가 실패해야 한다$$
);

-- [경계 조건]
-- 최대 허용값 100자는 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('b', 100), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$최대 허용값 100자는 성공해야 한다$$
);

-- 최대 초과 101자는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('b', 101), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '22001',
  NULL,
  $$최대 초과 101자는 실패해야 한다$$
);

-- [불변 조건]
-- notes 테이블에 title 길이가 100자를 초과하는 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE length(title) > 100),
  0::bigint,
  $$notes 테이블에 title 길이가 100자를 초과하는 행이 존재해서는 안 된다$$
);

SELECT * FROM finish();
ROLLBACK;
