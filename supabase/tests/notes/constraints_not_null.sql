-- =========================================
-- notes / CONSTRAINTS_NOT_NULL
-- =========================================

BEGIN;

SELECT plan(22);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_not_null_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_not_null_seed_note_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_constraints_not_null_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_constraints_not_null_user_a_id') || '@example.com',
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
  current_setting('test.notes_constraints_not_null_seed_note_id')::uuid,
  current_setting('test.notes_constraints_not_null_user_a_id')::uuid,
  'seed title',
  'seed content',
  0
)
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- 모든 NOT NULL 컬럼에 유효한 값을 넣으면 INSERT는 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'nn title', 'nn content', 0, now(), now());
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  $$모든 NOT NULL 컬럼에 유효한 값을 넣으면 INSERT는 성공해야 한다$$
);

-- 기존 유효한 row에 대해 NULL이 아닌 값으로 UPDATE하면 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET user_id = '%s'::uuid,
          title = 'seed title updated',
          content = 'seed content updated',
          review_round = 1,
          created_at = created_at,
          updated_at = updated_at
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id'),
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  $$기존 유효한 row에 대해 NULL이 아닌 값으로 UPDATE하면 성공해야 한다$$
);

-- [예외 조건]
-- user_id에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  $$INSERT INTO public.notes (id, user_id, title, content, review_round)
    VALUES (gen_random_uuid(), NULL, 'title', 'content', 0)$$,
  '23502',
  NULL,
  $$user_id에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- title에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, NULL, 'content', 0);
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$title에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- content에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', NULL, 0);
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$content에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- review_round에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', 'content', NULL);
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$review_round에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- created_at에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', 'content', 0, NULL, now());
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$created_at에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- updated_at에 NULL을 넣으면 INSERT는 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', 'content', 0, now(), NULL);
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$updated_at에 NULL을 넣으면 INSERT는 실패해야 한다$$
);

-- 기존 row에서 user_id를 NULL로 UPDATE하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET user_id = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  '23502',
  NULL,
  $$기존 row에서 user_id를 NULL로 UPDATE하면 실패해야 한다$$
);

-- 기존 row에서 title을 NULL로 UPDATE하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET title = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  '23502',
  NULL,
  $$기존 row에서 title을 NULL로 UPDATE하면 실패해야 한다$$
);

-- 기존 row에서 content를 NULL로 UPDATE하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET content = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  '23502',
  NULL,
  $$기존 row에서 content를 NULL로 UPDATE하면 실패해야 한다$$
);

-- 기존 row에서 review_round를 NULL로 UPDATE하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET review_round = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  '23502',
  NULL,
  $$기존 row에서 review_round를 NULL로 UPDATE하면 실패해야 한다$$
);

-- 기존 row에서 created_at을 NULL로 UPDATE하면 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET created_at = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_not_null_seed_note_id')
  ),
  '23502',
  NULL,
  $$기존 row에서 created_at을 NULL로 UPDATE하면 실패해야 한다$$
);

-- [경계 조건]
-- 최소 유효 데이터(MVT)로 INSERT하면 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'a', 'b', 0, now(), now());
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  $$최소 유효 데이터(MVT)로 INSERT하면 성공해야 한다$$
);

-- NULL이 아닌 값의 최소 조건(빈 문자열이 아닌 값 등)을 넣으면 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'a', 'c', 0, now(), now());
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  $$NULL이 아닌 값의 최소 조건(빈 문자열이 아닌 값 등)을 넣으면 성공해야 한다$$
);

-- NULL을 넣는 경우는 항상 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, created_at, updated_at)
      VALUES (gen_random_uuid(), '%s'::uuid, 'title', 'content', 0, NULL, now());
    $sql$,
    current_setting('test.notes_constraints_not_null_user_a_id')
  ),
  '23502',
  NULL,
  $$NULL을 넣는 경우는 항상 실패해야 한다$$
);

-- [불변 조건]
-- notes 테이블에는 user_id가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id IS NULL),
  0::bigint,
  $$notes 테이블에는 user_id가 NULL인 행이 존재해서는 안 된다$$
);

-- notes 테이블에는 title이 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE title IS NULL),
  0::bigint,
  $$notes 테이블에는 title이 NULL인 행이 존재해서는 안 된다$$
);

-- notes 테이블에는 content가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE content IS NULL),
  0::bigint,
  $$notes 테이블에는 content가 NULL인 행이 존재해서는 안 된다$$
);

-- notes 테이블에는 review_round가 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE review_round IS NULL),
  0::bigint,
  $$notes 테이블에는 review_round가 NULL인 행이 존재해서는 안 된다$$
);

-- notes 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE created_at IS NULL),
  0::bigint,
  $$notes 테이블에는 created_at이 NULL인 행이 존재해서는 안 된다$$
);

-- notes 테이블에는 updated_at이 NULL인 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.notes WHERE updated_at IS NULL),
  0::bigint,
  $$notes 테이블에는 updated_at이 NULL인 행이 존재해서는 안 된다$$
);

SELECT * FROM finish();
ROLLBACK;
