-- =========================================
-- notes / CONSTRAINTS_CHECK
-- =========================================

BEGIN;

SELECT plan(17);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_check_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_seed_note_id', gen_random_uuid()::text, true);

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
VALUES (
  current_setting('test.notes_constraints_check_seed_note_id')::uuid,
  current_setting('test.notes_constraints_check_user_a_id')::uuid,
  'seed title',
  'seed content',
  0
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- review_round가 0이면 INSERT가 성공해야 한다
SAVEPOINT notes_review_round_zero_insert;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr0', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  'review_round가 0이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_zero_insert;

-- review_round가 1, 2, 3이면 INSERT가 성공해야 한다
SAVEPOINT notes_review_round_123_insert;
WITH inserted AS (
  INSERT INTO public.notes (id, user_id, title, content, review_round)
  VALUES
    (gen_random_uuid(), current_setting('test.notes_constraints_check_user_a_id')::uuid, 'rr1', 'content', 1),
    (gen_random_uuid(), current_setting('test.notes_constraints_check_user_a_id')::uuid, 'rr2', 'content', 2),
    (gen_random_uuid(), current_setting('test.notes_constraints_check_user_a_id')::uuid, 'rr3', 'content', 3)
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM inserted),
  3::bigint,
  'review_round가 1, 2, 3이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_123_insert;

-- 기존의 유효한 review_round 값을 1로 UPDATE하면 성공해야 한다
SAVEPOINT notes_review_round_update_valid;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 1
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_seed_note_id')
  ),
  '기존의 유효한 review_round 값을 1로 UPDATE하면 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_update_valid;

-- [예외 조건]
-- review_round가 -1이면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr-1', 'content', -1);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  'review_round가 -1이면 CHECK 위반으로 실패해야 한다'
);

-- review_round가 4이면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr4', 'content', 4);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  'review_round가 4이면 CHECK 위반으로 실패해야 한다'
);

-- 기존의 유효한 review_round 값을 4로 UPDATE하면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = 4
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_seed_note_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  '기존의 유효한 review_round 값을 4로 UPDATE하면 CHECK 위반으로 실패해야 한다'
);

-- [경계 조건]
-- 최소 허용값 0은 성공해야 한다
SAVEPOINT notes_review_round_boundary_min_ok;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr0b', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '최소 허용값 0은 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_boundary_min_ok;

-- 최대 허용값 3은 성공해야 한다
SAVEPOINT notes_review_round_boundary_max_ok;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr3b', 'content', 3);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '최대 허용값 3은 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_boundary_max_ok;

-- 최소 미만 -1은 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr-1b', 'content', -1);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  '최소 미만 -1은 실패해야 한다'
);

-- 최대 초과 4는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr4b', 'content', 4);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  '최대 초과 4는 실패해야 한다'
);

-- [불변 조건]
-- notes 테이블에 review_round가 0 미만이거나 3 초과인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round < 0 OR review_round > 3),
  0::bigint,
  'notes 테이블에 review_round가 0 미만이거나 3 초과인 행이 존재해서는 안 된다'
);

-- [정답 조건]
-- title이 1자이면 INSERT가 성공해야 한다
SAVEPOINT notes_title_len_one_insert;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'a', 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  'title이 1자이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_title_len_one_insert;

-- title이 100자이면 INSERT가 성공해야 한다
SAVEPOINT notes_title_len_100_insert;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('a', 100), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  'title이 100자이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_title_len_100_insert;

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
  'value too long for type character varying(100)',
  'title이 101자이면 INSERT가 실패해야 한다'
);

-- [경계 조건]
-- 최대 허용값 100자는 성공해야 한다
SAVEPOINT notes_title_boundary_100_ok;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, repeat('b', 100), 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '최대 허용값 100자는 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_title_boundary_100_ok;

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
  'value too long for type character varying(100)',
  '최대 초과 101자는 실패해야 한다'
);

-- [불변 조건]
-- notes 테이블에 title 길이가 100자를 초과하는 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE length(title) > 100),
  0::bigint,
  'notes 테이블에 title 길이가 100자를 초과하는 행이 존재해서는 안 된다'
);

SELECT * FROM finish();
ROLLBACK;
