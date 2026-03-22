-- =========================================
-- notes / CONSTRAINTS_NOT_NULL
-- =========================================

BEGIN;

SELECT plan(12);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.seed_note_id', gen_random_uuid()::text, true);

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

-- 기존 유효한 행의 title을 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET title = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.seed_note_id')
  ),
  '23502',
  'null value in column "title" of relation "notes" violates not-null constraint',
  '기존 유효한 행의 title을 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다'
);

-- 기존 유효한 행의 content를 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET content = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.seed_note_id')
  ),
  '23502',
  'null value in column "content" of relation "notes" violates not-null constraint',
  '기존 유효한 행의 content를 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다'
);

-- 기존 유효한 행의 review_round를 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.seed_note_id')
  ),
  '23502',
  'null value in column "review_round" of relation "notes" violates not-null constraint',
  '기존 유효한 행의 review_round를 NULL로 UPDATE하면 NOT NULL 위반으로 실패해야 한다'
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
-- notes 테이블에 title이 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE title IS NULL),
  0::bigint,
  'notes 테이블에 title이 NULL인 행이 존재해서는 안 된다'
);

-- notes 테이블에 content가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE content IS NULL),
  0::bigint,
  'notes 테이블에 content가 NULL인 행이 존재해서는 안 된다'
);

-- notes 테이블에 review_round가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round IS NULL),
  0::bigint,
  'notes 테이블에 review_round가 NULL인 행이 존재해서는 안 된다'
);

SELECT * FROM finish();
ROLLBACK;