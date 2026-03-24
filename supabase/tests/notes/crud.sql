-- =========================================
-- notes / CRUD
-- =========================================

BEGIN;

SELECT plan(17);

-- 테스트용 UUID 준비
SELECT set_config('test.notes_crud_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_omit_insert_id', ''::text, true);
SELECT set_config('test.notes_crud_note_explicit_null_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_query_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_update_null_to_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_update_valid_to_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_update_null_to_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_invariant_null_to_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_invariant_valid_to_null_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_crud_note_many_omit_insert_id', ''::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.notes_crud_user_a_id')::uuid,
  'user_a_' || current_setting('test.notes_crud_user_a_id') || '@example.com',
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
    current_setting('test.notes_crud_note_query_null_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'query null seed',
    'query null content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_crud_note_update_null_to_valid_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'update null to valid seed',
    'update null to valid content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_crud_note_update_valid_to_null_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'update valid to null seed',
    'update valid to null content',
    0,
    'markdown'
  ),
  (
    current_setting('test.notes_crud_note_update_null_to_null_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'update null to null seed',
    'update null to null content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_crud_note_invariant_null_to_valid_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'invariant null to valid seed',
    'invariant null to valid content',
    0,
    NULL
  ),
  (
    current_setting('test.notes_crud_note_invariant_valid_to_null_id')::uuid,
    current_setting('test.notes_crud_user_a_id')::uuid,
    'invariant valid to null seed',
    'invariant valid to null content',
    0,
    'markdown'
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- language 컬럼을 생략하고 INSERT할 수 있어야 한다.
WITH inserted AS (
  INSERT INTO public.notes (user_id, title, content, review_round)
  VALUES (
    current_setting('test.notes_crud_user_a_id')::uuid,
    'omit language insert',
    'omit language content',
    0
  )
  RETURNING id
)
SELECT set_config('test.notes_crud_note_omit_insert_id', (SELECT id::text FROM inserted), true);
SELECT ok(
  current_setting('test.notes_crud_note_omit_insert_id') <> '',
  $$language 컬럼을 생략하고 INSERT할 수 있어야 한다.$$
);

-- language 컬럼을 생략하고 INSERT한 행의 language는 NULL이어야 한다.
SELECT is(
  (SELECT language FROM public.notes WHERE id = current_setting('test.notes_crud_note_omit_insert_id')::uuid),
  NULL::character varying,
  $$language 컬럼을 생략하고 INSERT한 행의 language는 NULL이어야 한다.$$
);

-- language에 명시적으로 NULL을 넣고 INSERT할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round, language)
      VALUES ('%s'::uuid, '%s'::uuid, 'explicit null insert', 'explicit null content', 0, NULL);
    $sql$,
    current_setting('test.notes_crud_note_explicit_null_insert_id'),
    current_setting('test.notes_crud_user_a_id')
  ),
  $$language에 명시적으로 NULL을 넣고 INSERT할 수 있어야 한다.$$
);

-- language가 NULL인 기존 행을 유효한 선택값(markdown 등)으로 UPDATE할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = 'markdown'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_crud_note_update_null_to_valid_id')
  ),
  $$language가 NULL인 기존 행을 유효한 선택값(markdown 등)으로 UPDATE할 수 있어야 한다.$$
);

-- language가 유효한 선택값인 기존 행을 NULL로 UPDATE할 수 있어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_crud_note_update_valid_to_null_id')
  ),
  $$language가 유효한 선택값인 기존 행을 NULL로 UPDATE할 수 있어야 한다.$$
);

-- language가 NULL인 행을 조회했을 때 NULL 상태가 그대로 유지되어야 한다.
SELECT is(
  (SELECT language FROM public.notes WHERE id = current_setting('test.notes_crud_note_query_null_id')::uuid),
  NULL::character varying,
  $$language가 NULL인 행을 조회했을 때 NULL 상태가 그대로 유지되어야 한다.$$
);

-- [예외 조건]
-- 없음 (이 CRUD 정책은 NULL 저장 가능 여부와 상태 전이를 검증하는 정책이며, 값 제한 자체는 constraints_check.sql에서 분리 검증한다)
SELECT ok(
  true,
  $$없음 (이 CRUD 정책은 NULL 저장 가능 여부와 상태 전이를 검증하는 정책이며, 값 제한 자체는 constraints_check.sql에서 분리 검증한다)$$
);

-- [경계 조건]
-- INSERT 시 language 생략과 language = NULL 명시 입력은 서로 다른 입력 방식이지만 모두 성공해야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id IN (
     current_setting('test.notes_crud_note_omit_insert_id')::uuid,
     current_setting('test.notes_crud_note_explicit_null_insert_id')::uuid
   )),
  2::bigint,
  $$INSERT 시 language 생략과 language = NULL 명시 입력은 서로 다른 입력 방식이지만 모두 성공해야 한다.$$
);

-- UPDATE 시 NULL → 유효값 전이는 성공해야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id = current_setting('test.notes_crud_note_update_null_to_valid_id')::uuid
     AND language = 'markdown'),
  1::bigint,
  $$UPDATE 시 NULL → 유효값 전이는 성공해야 한다.$$
);

-- UPDATE 시 유효값 → NULL 전이는 성공해야 한다.
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id = current_setting('test.notes_crud_note_update_valid_to_null_id')::uuid
     AND language IS NULL),
  1::bigint,
  $$UPDATE 시 유효값 → NULL 전이는 성공해야 한다.$$
);

-- UPDATE 시 NULL → NULL(동일 값 재지정)은 성공해야 하며 language는 계속 NULL이어야 한다.
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.notes
      SET language = NULL
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.notes_crud_note_update_null_to_null_id')
  ),
  $$UPDATE 시 NULL → NULL(동일 값 재지정)은 성공해야 하며 language는 계속 NULL이어야 한다.$$
);

-- 여러 행이 존재하더라도 language를 생략한 신규 행은 항상 NULL로 저장되어야 한다.
WITH inserted AS (
  INSERT INTO public.notes (user_id, title, content, review_round)
  VALUES (
    current_setting('test.notes_crud_user_a_id')::uuid,
    'many rows omit language insert',
    'many rows omit language content',
    0
  )
  RETURNING id
)
SELECT set_config('test.notes_crud_note_many_omit_insert_id', (SELECT id::text FROM inserted), true);
SELECT ok(
  (SELECT language IS NULL
   FROM public.notes
   WHERE id = current_setting('test.notes_crud_note_many_omit_insert_id')::uuid),
  $$여러 행이 존재하더라도 language를 생략한 신규 행은 항상 NULL로 저장되어야 한다.$$
);

-- [불변 조건]
-- language를 생략하고 생성한 notes 행의 language는 항상 NULL이어야 한다. (Status)
SELECT is(
  (SELECT language FROM public.notes WHERE id = current_setting('test.notes_crud_note_omit_insert_id')::uuid),
  NULL::character varying,
  $$language를 생략하고 생성한 notes 행의 language는 항상 NULL이어야 한다. (Status)$$
);

-- language에 명시적으로 NULL을 저장한 notes 행의 language는 항상 NULL이어야 한다. (Status)
SELECT is(
  (SELECT language FROM public.notes WHERE id = current_setting('test.notes_crud_note_explicit_null_insert_id')::uuid),
  NULL::character varying,
  $$language에 명시적으로 NULL을 저장한 notes 행의 language는 항상 NULL이어야 한다. (Status)$$
);

-- language가 NULL인 행을 유효값으로 UPDATE한 뒤에는 해당 행의 language만 변경되고 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)
SELECT set_config(
  'test.notes_crud_null_to_valid_before_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_crud_note_invariant_null_to_valid_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_crud_null_to_valid_before_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.notes_crud_note_invariant_null_to_valid_id')::uuid),
  true
);
UPDATE public.notes
SET language = 'markdown'
WHERE id = current_setting('test.notes_crud_note_invariant_null_to_valid_id')::uuid;
SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE id = current_setting('test.notes_crud_note_invariant_null_to_valid_id')::uuid
      AND language = 'markdown'
      AND user_id::text = current_setting('test.notes_crud_null_to_valid_before_user_id')
      AND created_at::text = current_setting('test.notes_crud_null_to_valid_before_created_at')
  ),
  1::bigint,
  $$language가 NULL인 행을 유효값으로 UPDATE한 뒤에는 해당 행의 language만 변경되고 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)$$
);

-- language가 유효값인 행을 NULL로 UPDATE한 뒤에는 해당 행의 language만 NULL로 변경되고 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)
SELECT set_config(
  'test.notes_crud_valid_to_null_before_user_id',
  (SELECT user_id::text FROM public.notes WHERE id = current_setting('test.notes_crud_note_invariant_valid_to_null_id')::uuid),
  true
);
SELECT set_config(
  'test.notes_crud_valid_to_null_before_created_at',
  (SELECT created_at::text FROM public.notes WHERE id = current_setting('test.notes_crud_note_invariant_valid_to_null_id')::uuid),
  true
);
UPDATE public.notes
SET language = NULL
WHERE id = current_setting('test.notes_crud_note_invariant_valid_to_null_id')::uuid;
SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE id = current_setting('test.notes_crud_note_invariant_valid_to_null_id')::uuid
      AND language IS NULL
      AND user_id::text = current_setting('test.notes_crud_valid_to_null_before_user_id')
      AND created_at::text = current_setting('test.notes_crud_valid_to_null_before_created_at')
  ),
  1::bigint,
  $$language가 유효값인 행을 NULL로 UPDATE한 뒤에는 해당 행의 language만 NULL로 변경되고 수정 대상 외 컬럼(id, user_id, created_at 등)은 변하지 않아야 한다. (Transition)$$
);

-- language 컬럼의 NULL 상태는 INSERT 방식(생략 / 명시적 NULL)과 무관하게 동일하게 관찰되어야 한다. (Status)
SELECT is(
  (SELECT count(*)
   FROM public.notes
   WHERE id IN (
     current_setting('test.notes_crud_note_omit_insert_id')::uuid,
     current_setting('test.notes_crud_note_explicit_null_insert_id')::uuid
   )
   AND language IS NULL),
  2::bigint,
  $$language 컬럼의 NULL 상태는 INSERT 방식(생략 / 명시적 NULL)과 무관하게 동일하게 관찰되어야 한다. (Status)$$
);

SELECT * FROM finish();
ROLLBACK;
