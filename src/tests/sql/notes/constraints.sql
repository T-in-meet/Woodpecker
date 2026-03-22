-- =========================================
-- notes / CONSTRAINTS
-- =========================================

BEGIN;

SELECT plan(26);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.seed_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.default_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.default_compare_omit_id', gen_random_uuid()::text, true);
SELECT set_config('test.default_compare_zero_id', gen_random_uuid()::text, true);
SELECT set_config('test.default_invariant_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.user_a_id')::uuid,
  'user_a_' || current_setting('test.user_a_id') || '@example.com',
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
  current_setting('test.seed_note_id')::uuid,
  current_setting('test.user_a_id')::uuid,
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
    current_setting('test.user_a_id')
  ),
  'review_round가 0이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_zero_insert;

-- review_round가 1, 2, 3이면 INSERT가 성공해야 한다
SAVEPOINT notes_review_round_123_insert;
WITH inserted AS (
  INSERT INTO public.notes (id, user_id, title, content, review_round)
  VALUES
    (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'rr1', 'content', 1),
    (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'rr2', 'content', 2),
    (gen_random_uuid(), current_setting('test.user_a_id')::uuid, 'rr3', 'content', 3)
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM inserted),
  3::bigint,
  'review_round가 1, 2, 3이면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_123_insert;

-- [예외 조건]
-- review_round가 -1이면 CHECK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'rr-1', 'content', -1);
    $sql$,
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
  ),
  '23514',
  'new row for relation "notes" violates check constraint "notes_review_round_check"',
  'review_round가 4이면 CHECK 위반으로 실패해야 한다'
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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
    current_setting('test.user_a_id')
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

-- [정답 조건]
-- title, content, review_round가 모두 값이 있으면 INSERT가 성공해야 한다
SAVEPOINT notes_not_null_all_present;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'nn title', 'nn content', 0);
    $sql$,
    current_setting('test.user_a_id')
  ),
  'title, content, review_round가 모두 값이 있으면 INSERT가 성공해야 한다'
);
ROLLBACK TO SAVEPOINT notes_not_null_all_present;

-- [예외 조건]
-- title이 NULL이면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, NULL, 'content', 0);
    $sql$,
    current_setting('test.user_a_id')
  ),
  '23502',
  'null value in column "title" of relation "notes" violates not-null constraint',
  'title이 NULL이면 NOT NULL 위반으로 실패해야 한다'
);

-- content가 NULL이면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', NULL, 0);
    $sql$,
    current_setting('test.user_a_id')
  ),
  '23502',
  'null value in column "content" of relation "notes" violates not-null constraint',
  'content가 NULL이면 NOT NULL 위반으로 실패해야 한다'
);

-- review_round가 NULL이면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', 'content', NULL);
    $sql$,
    current_setting('test.user_a_id')
  ),
  '23502',
  'null value in column "review_round" of relation "notes" violates not-null constraint',
  'review_round가 NULL이면 NOT NULL 위반으로 실패해야 한다'
);

-- [경계 조건]
-- title에 빈 문자열('')을 넣으면 NOT NULL은 통과해야 한다
-- (최소 길이 규칙은 별도 정책으로 결정)
SAVEPOINT notes_title_empty_string;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, '', 'content', 0);
    $sql$,
    current_setting('test.user_a_id')
  ),
   $$title에 빈 문자열('')을 넣으면 NOT NULL은 통과해야 한다$$
);
ROLLBACK TO SAVEPOINT notes_title_empty_string;

-- content에 빈 문자열('')을 넣으면 NOT NULL은 통과해야 한다
SAVEPOINT notes_content_empty_string;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', '', 0);
    $sql$,
    current_setting('test.user_a_id')
  ),
  $$content에 빈 문자열('')을 넣으면 NOT NULL은 통과해야 한다$$
);
ROLLBACK TO SAVEPOINT notes_content_empty_string;

-- [불변 조건]
-- notes 테이블에 title, content, review_round가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE title IS NULL OR content IS NULL OR review_round IS NULL),
  0::bigint,
  'notes 테이블에 title, content, review_round가 NULL인 행이 존재해서는 안 된다'
);

-- [정답 조건]
-- review_round를 명시하지 않고 INSERT하면 기본값 0으로 설정되어야 한다
SAVEPOINT notes_review_round_default;
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.default_note_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'default title',
  'default content'
);
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.default_note_id')::uuid),
  0,
  'review_round를 명시하지 않고 INSERT하면 기본값 0으로 설정되어야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_default;

-- [예외 조건]
-- 없음 (NULL 입력 실패는 규칙 3에서 검증)
SELECT ok(
  true,
  '없음 (NULL 입력 실패는 규칙 3에서 검증)'
);

-- [경계 조건]
-- review_round를 생략한 경우와 0으로 명시한 경우의 결과가 동일해야 한다
SAVEPOINT notes_review_round_default_boundary;
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.default_compare_omit_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'default omit',
  'default omit content'
);
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.default_compare_zero_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'default zero',
  'default zero content',
  0
);
SELECT ok(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.default_compare_omit_id')::uuid) = 0
  AND (SELECT review_round FROM public.notes WHERE id = current_setting('test.default_compare_zero_id')::uuid) = 0,
  'review_round를 생략한 경우와 0으로 명시한 경우의 결과가 동일해야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_default_boundary;

-- [불변 조건]
-- review_round를 생략하여 생성된 notes 행은 항상 review_round가 0이어야 한다
SAVEPOINT notes_review_round_default_invariant;
INSERT INTO public.notes (id, user_id, title, content)
VALUES (
  current_setting('test.default_invariant_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  'default invariant',
  'default invariant content'
);
SELECT is(
  (SELECT review_round FROM public.notes WHERE id = current_setting('test.default_invariant_id')::uuid),
  0,
  'review_round를 생략하여 생성된 notes 행은 항상 review_round가 0이어야 한다'
);
ROLLBACK TO SAVEPOINT notes_review_round_default_invariant;

SELECT * FROM finish();
ROLLBACK;
