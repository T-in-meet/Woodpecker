-- =========================================
-- notes / FK
-- =========================================
-- [전제 조건]
-- public.notes.user_id -> auth.users.id 외래 키 제약이 설정되어 있어야 한다.
-- 해당 외래 키에는 ON DELETE CASCADE가 설정되어 부모(auth.users) 삭제 시 자식(public.notes)이 자동 삭제되어야 한다.

BEGIN;

SELECT plan(9);

-- 테스트용 UUID 준비
SELECT set_config('test.user_bogus_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_valid_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_delete_cascade_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_update_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_stale_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_multi_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_zero_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_orphan_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_delete_cascade_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_update_seed_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_invalid_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_stale_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_multi_1_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_multi_2_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_orphan_target_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    current_setting('test.user_valid_id')::uuid,
    'user_valid_' || current_setting('test.user_valid_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_delete_cascade_id')::uuid,
    'user_delete_cascade_' || current_setting('test.user_delete_cascade_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_update_seed_id')::uuid,
    'user_update_seed_' || current_setting('test.user_update_seed_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_stale_id')::uuid,
    'user_stale_' || current_setting('test.user_stale_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_multi_id')::uuid,
    'user_multi_' || current_setting('test.user_multi_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_zero_id')::uuid,
    'user_zero_' || current_setting('test.user_zero_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.user_orphan_id')::uuid,
    'user_orphan_' || current_setting('test.user_orphan_id') || '@example.com',
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
    current_setting('test.note_delete_cascade_id')::uuid,
    current_setting('test.user_delete_cascade_id')::uuid,
    'cascade seed note',
    'cascade seed content',
    0
  ),
  (
    current_setting('test.note_update_seed_id')::uuid,
    current_setting('test.user_update_seed_id')::uuid,
    'update seed note',
    'update seed content',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- [정답 조건]
-- auth.users에 존재하는 user_id로 notes INSERT가 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'valid note', 'valid content', 0);
    $sql$,
    current_setting('test.note_insert_id'),
    current_setting('test.user_valid_id')
  ),
  'auth.users에 존재하는 user_id로 notes INSERT가 성공해야 한다'
);

-- auth.users에서 user_a를 삭제하면 user_a의 notes가 자동으로 삭제되어야 한다
DELETE FROM auth.users WHERE id = current_setting('test.user_delete_cascade_id')::uuid;
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.user_delete_cascade_id')::uuid),
  0::bigint,
  'auth.users에서 user_a를 삭제하면 user_a의 notes가 자동으로 삭제되어야 한다'
);

-- [예외 조건]
-- auth.users에 존재하지 않는 user_id로 notes INSERT를 시도하면 FK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'invalid note', 'invalid content', 0);
    $sql$,
    current_setting('test.note_invalid_insert_id'),
    current_setting('test.user_bogus_id')
  ),
  '23503',
  'insert or update on table "notes" violates foreign key constraint "notes_user_id_fkey"',
  'auth.users에 존재하지 않는 user_id로 notes INSERT를 시도하면 FK 위반으로 실패해야 한다'
);

-- 기존에 유효한 notes 행의 user_id를 auth.users에 존재하지 않는 값으로 UPDATE하면 FK 위반으로 실패해야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.notes
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_bogus_id'),
    current_setting('test.note_update_seed_id')
  ),
  '23503',
  'insert or update on table "notes" violates foreign key constraint "notes_user_id_fkey"',
  '기존에 유효한 notes 행의 user_id를 auth.users에 존재하지 않는 값으로 UPDATE하면 FK 위반으로 실패해야 한다'
);

-- [경계 조건]
-- user_a가 auth.users에서 삭제된 직후, 해당 user_id로 notes INSERT를 시도하면 실패해야 한다
-- (방금 삭제된 stale reference도 유효하지 않은 참조로 처리되는지 확인)
DELETE FROM auth.users WHERE id = current_setting('test.user_stale_id')::uuid;
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.notes (id, user_id, title, content, review_round)
      VALUES ('%s'::uuid, '%s'::uuid, 'stale note', 'stale content', 0);
    $sql$,
    current_setting('test.note_stale_insert_id'),
    current_setting('test.user_stale_id')
  ),
  '23503',
  'insert or update on table "notes" violates foreign key constraint "notes_user_id_fkey"',
  'user_a가 auth.users에서 삭제된 직후, 해당 user_id로 notes INSERT를 시도하면 실패해야 한다'
);

-- user_a의 notes가 여러 개일 때 user_a를 삭제하면 모든 notes가 남김없이 삭제되어야 한다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.note_multi_1_id')::uuid,
    current_setting('test.user_multi_id')::uuid,
    'multi note 1',
    'multi content 1',
    0
  ),
  (
    current_setting('test.note_multi_2_id')::uuid,
    current_setting('test.user_multi_id')::uuid,
    'multi note 2',
    'multi content 2',
    0
  )
ON CONFLICT (id) DO NOTHING;

DELETE FROM auth.users WHERE id = current_setting('test.user_multi_id')::uuid;
SELECT is(
  (SELECT count(*) FROM public.notes WHERE user_id = current_setting('test.user_multi_id')::uuid),
  0::bigint,
  'user_a의 notes가 여러 개일 때 user_a를 삭제하면 모든 notes가 남김없이 삭제되어야 한다'
);

-- user_a의 notes가 0개일 때 user_a를 삭제해도 오류 없이 성공해야 한다
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM auth.users WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_zero_id')
  ),
  'user_a의 notes가 0개일 때 user_a를 삭제해도 오류 없이 성공해야 한다'
);

-- [불변 조건]
-- notes 테이블에는 auth.users에 대응하는 행이 없는 orphan notes가 존재해서는 안 된다
SELECT is(
  (SELECT count(*)
   FROM public.notes n
   LEFT JOIN auth.users u ON u.id = n.user_id
   WHERE u.id IS NULL),
  0::bigint,
  'notes 테이블에는 auth.users에 대응하는 행이 없는 orphan notes가 존재해서는 안 된다'
);

-- 부모 삭제 직전 존재하던 특정 자식 notes 행은 부모 삭제 직후 남아 있어서는 안 된다
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.note_orphan_target_id')::uuid,
  current_setting('test.user_orphan_id')::uuid,
  'transition note',
  'transition content',
  0
)
ON CONFLICT (id) DO NOTHING;

DELETE FROM auth.users WHERE id = current_setting('test.user_orphan_id')::uuid;
SELECT is(
  (SELECT count(*) FROM public.notes WHERE id = current_setting('test.note_orphan_target_id')::uuid),
  0::bigint,
  '부모 삭제 직전 존재하던 특정 자식 notes 행은 부모 삭제 직후 남아 있어서는 안 된다'
);

SELECT * FROM finish();
ROLLBACK;
