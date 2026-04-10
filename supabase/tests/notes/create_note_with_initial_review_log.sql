-- =========================================
-- notes / create_note_with_initial_review_log RPC
-- =========================================

BEGIN;

SELECT plan(15);

SELECT set_config('test.notes_rpc_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rpc_atomic_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.notes_rpc_scheduled_at', '2026-01-02T00:00:00Z', true);
SELECT set_config('test.notes_rpc_language_scheduled_at', '2026-01-03T00:00:00Z', true);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    current_setting('test.notes_rpc_user_id')::uuid,
    'notes_rpc_user_' || current_setting('test.notes_rpc_user_id') || '@example.com',
    '{}'::jsonb
  ),
  (
    current_setting('test.notes_rpc_atomic_user_id')::uuid,
    'notes_rpc_atomic_user_' || current_setting('test.notes_rpc_atomic_user_id') || '@example.com',
    '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT set_config(
  'test.notes_rpc_note_id',
  public.create_note_with_initial_review_log(
    'rpc title',
    'rpc content',
    NULL,
    current_setting('test.notes_rpc_scheduled_at')::timestamptz
  )::text,
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  1::bigint,
  $$authenticated 사용자가 RPC를 호출하면 notes가 1건 생성되어야 한다$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_logs
    WHERE note_id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  1::bigint,
  $$같은 RPC 호출에서 review_logs가 1건 생성되어야 한다$$
);

SELECT is(
  (
    SELECT id::text
    FROM public.notes
    WHERE id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  current_setting('test.notes_rpc_note_id'),
  $$RPC 반환 uuid는 생성된 note.id와 같아야 한다$$
);

SELECT is(
  (
    SELECT note_id::text
    FROM public.review_logs
    WHERE note_id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  current_setting('test.notes_rpc_note_id'),
  $$review_logs.note_id는 생성된 note.id와 같아야 한다$$
);

SELECT ok(
  (
    SELECT n.user_id = auth.uid()
      AND rl.user_id = auth.uid()
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.note_id = n.id
    WHERE n.id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  $$notes.user_id와 review_logs.user_id는 auth.uid()와 같아야 한다$$
);

SELECT ok(
  (
    SELECT n.next_review_at = current_setting('test.notes_rpc_scheduled_at')::timestamptz
      AND rl.scheduled_at = current_setting('test.notes_rpc_scheduled_at')::timestamptz
    FROM public.notes n
    JOIN public.review_logs rl
      ON rl.note_id = n.id
    WHERE n.id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  $$notes.next_review_at과 review_logs.scheduled_at은 p_scheduled_at과 같아야 한다$$
);

SELECT is(
  (
    SELECT round
    FROM public.review_logs
    WHERE note_id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  1,
  $$초기 review_logs.round는 1이어야 한다$$
);

SELECT is(
  (
    SELECT review_round
    FROM public.notes
    WHERE id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  0,
  $$초기 notes.review_round는 기본값 0이어야 한다$$
);

SELECT is(
  (
    SELECT language
    FROM public.notes
    WHERE id = current_setting('test.notes_rpc_note_id')::uuid
  ),
  NULL::character varying,
  $$p_language = NULL 호출은 language를 NULL로 저장해야 한다$$
);

SELECT set_config(
  'test.notes_rpc_language_note_id',
  public.create_note_with_initial_review_log(
    'rpc language title',
    'rpc language content',
    'javascript',
    current_setting('test.notes_rpc_language_scheduled_at')::timestamptz
  )::text,
  true
);

SELECT is(
  (
    SELECT language::text
    FROM public.notes
    WHERE id = current_setting('test.notes_rpc_language_note_id')::uuid
  ),
  'javascript',
  $$허용된 language 값은 정상 저장되어야 한다$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_with_initial_review_log(
      'anon title',
      'anon content',
      NULL::text,
      '2026-01-04T00:00:00Z'::timestamptz
    );
  $sql$,
  '42501',
  NULL,
  $$anon 컨텍스트에서는 RPC 호출이 거부되어야 한다$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rpc_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_with_initial_review_log(
      'invalid language title',
      'invalid language content',
      'ruby',
      '2026-01-05T00:00:00Z'::timestamptz
    );
  $sql$,
  '23514',
  NULL,
  $$허용되지 않은 language 값은 기존 DB constraint로 거부되어야 한다$$
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_with_initial_review_log(
      'null schedule title',
      'null schedule content',
      NULL::text,
      NULL::timestamptz
    );
  $sql$,
  'P0001',
  NULL,
  $$p_scheduled_at = NULL 호출은 거부되어야 한다$$
);

RESET ROLE;

ALTER TABLE public.review_logs
ADD CONSTRAINT review_logs_test_future_limit
CHECK (scheduled_at < '2100-01-01T00:00:00Z'::timestamptz);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.notes_rpc_atomic_user_id'),
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.create_note_with_initial_review_log(
      'atomic failure marker',
      'content',
      NULL::text,
      '2200-01-01T00:00:00Z'::timestamptz
    );
  $sql$,
  '23514',
  NULL,
  $$review_logs INSERT가 실패하면 RPC 호출은 실패해야 한다$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.notes
    WHERE user_id = current_setting('test.notes_rpc_atomic_user_id')::uuid
      AND title = 'atomic failure marker'
  ),
  0::bigint,
  $$review_logs INSERT 실패 시 해당 호출의 notes 고아 row가 남지 않아야 한다$$
);

RESET ROLE;

ALTER TABLE public.review_logs
DROP CONSTRAINT review_logs_test_future_limit;

SELECT * FROM finish();
ROLLBACK;
