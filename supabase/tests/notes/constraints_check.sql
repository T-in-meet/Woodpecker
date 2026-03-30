-- =========================================
-- notes / CONSTRAINTS_CHECK
-- =========================================

BEGIN;

SELECT plan(48);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_constraints_check_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_invalid_high_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_update_invalid_low_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_boundary_move_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_boundary_fail_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_invariant_status_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_invariant_other_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_update_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_update_invalid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_update_case_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_update_empty_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_boundary_update_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_constraints_check_note_language_invariant_other_id', gen_random_uuid()::text, true);

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
  review_round,
  language
)
VALUES
  (
    current_setting('test.notes_constraints_check_note_update_valid_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update valid seed',
    'update valid content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_update_invalid_high_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update invalid high seed',
    'update invalid high content',
    2,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_update_invalid_low_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'update invalid low seed',
    'update invalid low content',
    1,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_boundary_move_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'boundary move seed',
    'boundary move content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_boundary_fail_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'boundary fail seed',
    'boundary fail content',
    3,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_invariant_status_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'invariant status seed',
    'invariant status content',
    2,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_invariant_other_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'invariant other seed',
    'invariant other content',
    2,
    NULL
  ),
  (
    current_setting('test.notes_constraints_check_note_language_update_valid_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language update valid seed',
    'language update valid content',
    2,
    'markdown'
  ),
  (
    current_setting('test.notes_constraints_check_note_language_update_invalid_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language update invalid seed',
    'language update invalid content',
    2,
    'markdown'
  ),
  (
    current_setting('test.notes_constraints_check_note_language_update_case_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language update case seed',
    'language update case content',
    2,
    'markdown'
  ),
  (
    current_setting('test.notes_constraints_check_note_language_update_empty_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language update empty seed',
    'language update empty content',
    2,
    'markdown'
  ),
  (
    current_setting('test.notes_constraints_check_note_language_boundary_update_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language boundary update seed',
    'language boundary update content',
    2,
    'markdown'
  ),
  (
    current_setting('test.notes_constraints_check_note_language_invariant_other_id')::uuid,
    current_setting('test.notes_constraints_check_user_a_id')::uuid,
    'language invariant other seed',
    'language invariant other content',
    2,
    'markdown'
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

-- language에 markdown을 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language markdown', 'content', 0, 'markdown');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 markdown을 저장할 수 있어야 한다.$$
);

-- language에 javascript를 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language javascript', 'content', 0, 'javascript');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 javascript를 저장할 수 있어야 한다.$$
);

-- language에 typescript를 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language typescript', 'content', 0, 'typescript');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 typescript를 저장할 수 있어야 한다.$$
);

-- language에 python을 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language python', 'content', 0, 'python');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 python을 저장할 수 있어야 한다.$$
);

-- language에 rust를 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language rust', 'content', 0, 'rust');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 rust를 저장할 수 있어야 한다.$$
);

-- language에 go를 저장할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language go', 'content', 0, 'go');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$language에 go를 저장할 수 있어야 한다.$$
);

-- 기존 유효 값(markdown)에서 다른 유효 값(javascript 등)으로 UPDATE할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = 'javascript'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_language_update_valid_id')
  ),
  $$기존 유효 값(markdown)에서 다른 유효 값(javascript 등)으로 UPDATE할 수 있어야 한다.$$
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

-- 허용값 목록에 없는 문자열(java, cpp, text, md 등)은 저장할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language invalid list', 'content', 0, 'java');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$허용값 목록에 없는 문자열(java, cpp, text, md 등)은 저장할 수 없어야 한다.$$
);

-- 대문자 또는 혼합 대소문자(JavaScript, MARKDOWN 등)는 저장할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language invalid case', 'content', 0, 'JavaScript');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$대문자 또는 혼합 대소문자(JavaScript, MARKDOWN 등)는 저장할 수 없어야 한다.$$
);

-- 빈 문자열('')은 저장할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language invalid empty', 'content', 0, '');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$빈 문자열('')은 저장할 수 없어야 한다.$$
);

-- 기존 유효 값에서 비허용값으로 UPDATE할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = 'cpp'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_language_update_invalid_id')
  ),
  '23514',
  NULL,
  $$기존 유효 값에서 비허용값으로 UPDATE할 수 없어야 한다.$$
);

-- 기존 유효 값에서 대문자/혼합 대소문자 값으로 UPDATE할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = 'MARKDOWN'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_language_update_case_id')
  ),
  '23514',
  NULL,
  $$기존 유효 값에서 대문자/혼합 대소문자 값으로 UPDATE할 수 없어야 한다.$$
);

-- 기존 유효 값에서 빈 문자열로 UPDATE할 수 없어야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = ''
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_language_update_empty_id')
  ),
  '23514',
  NULL,
  $$기존 유효 값에서 빈 문자열로 UPDATE할 수 없어야 한다.$$
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

-- 허용값 집합의 최소 단위 경계로서 가장 짧은 허용값(go)은 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language boundary go', 'content', 0, 'go');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$허용값 집합의 최소 단위 경계로서 가장 짧은 허용값(go)은 성공해야 한다.$$
);

-- 허용값 집합의 최대 단위 경계로서 가장 긴 허용값(typescript)은 성공해야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language boundary typescript', 'content', 0, 'typescript');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  $$허용값 집합의 최대 단위 경계로서 가장 긴 허용값(typescript)은 성공해야 한다.$$
);

-- 허용값과 유사하지만 집합 밖 값(md, ts, js, golang)은 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language boundary similar', 'content', 0, 'md');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$허용값과 유사하지만 집합 밖 값(md, ts, js, golang)은 실패해야 한다.$$
);

-- 허용값과 철자만 유사한 값(markdowns, python3)은 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language boundary spelling', 'content', 0, 'markdowns');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$허용값과 철자만 유사한 값(markdowns, python3)은 실패해야 한다.$$
);

-- 허용값 앞뒤 공백이 포함된 값(' markdown', 'python ')은 실패해야 한다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES (gen_random_uuid(), '%s'::uuid, 'language boundary spaces', 'content', 0, ' markdown');
    $sql$,
    current_setting('test.notes_constraints_check_user_a_id')
  ),
  '23514',
  NULL,
  $$허용값 앞뒤 공백이 포함된 값(' markdown', 'python ')은 실패해야 한다.$$
);

-- 기존 행 UPDATE에서도 동일한 경계가 유지되어야 한다.
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = 'golang'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_constraints_check_note_language_boundary_update_id')
  ),
  '23514',
  NULL,
  $$기존 행 UPDATE에서도 동일한 경계가 유지되어야 한다.$$
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

-- language가 NULL이 아닌 notes 행의 language 값은 항상 허용값 6개 중 하나여야 한다. (Status)
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE language IS NOT NULL
     AND language NOT IN ('markdown', 'javascript', 'typescript', 'python', 'rust', 'go')),
  0::bigint,
  $$language가 NULL이 아닌 notes 행의 language 값은 항상 허용값 6개 중 하나여야 한다. (Status)$$
);

-- language가 NULL이 아닌 notes 행 중 대문자 또는 혼합 대소문자를 포함한 값은 존재해서는 안 된다. (Status)
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE language IS NOT NULL
     AND language <> lower(language)),
  0::bigint,
  $$language가 NULL이 아닌 notes 행 중 대문자 또는 혼합 대소문자를 포함한 값은 존재해서는 안 된다. (Status)$$
);

-- language가 NULL이 아닌 notes 행 중 빈 문자열은 존재해서는 안 된다. (Status)
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE language IS NOT NULL
     AND language = ''),
  0::bigint,
  $$language가 NULL이 아닌 notes 행 중 빈 문자열은 존재해서는 안 된다. (Status)$$
);

-- language UPDATE 성공 후에도 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)
SELECT set_config(
  'test.notes_constraints_check_language_other_before_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_constraints_check_note_language_invariant_other_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_constraints_check_language_other_before_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.notes_constraints_check_note_language_invariant_other_id')::uuid),
  true
);
UPDATE public.notes
SET language = 'python'
WHERE id = current_setting('test.notes_constraints_check_note_language_invariant_other_id')::uuid;
SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE id = current_setting('test.notes_constraints_check_note_language_invariant_other_id')::uuid
      AND language = 'python'
      AND user_id::text = current_setting('test.notes_constraints_check_language_other_before_user_id')
      AND created_at::text = current_setting('test.notes_constraints_check_language_other_before_created_at')
  ),
  1::bigint,
  $$language UPDATE 성공 후에도 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)$$
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
