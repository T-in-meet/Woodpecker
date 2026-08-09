-- =========================================
-- review_gradings / RLS + 채점 선점 RPC
-- =========================================

BEGIN;

SELECT plan(14);

-- 테스트용 UUID 준비
SELECT set_config('test.rg_rls_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_note_a_id', gen_random_uuid()::text, true);
-- review_logs_one_pending_per_note_idx가 노트당 pending 로그를 1건으로 제한하므로
-- user_a의 두 번째 복습 로그는 별도 노트에 붙인다.
SELECT set_config('test.rg_rls_note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_note_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_log_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_log_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_rls_log_b_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    current_setting('test.rg_rls_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rg_user_a_' || current_setting('test.rg_rls_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.rg_rls_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rg_user_b_' || current_setting('test.rg_rls_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.rg_rls_note_a_id')::uuid,
    current_setting('test.rg_rls_user_a_id')::uuid,
    'note a',
    'content a',
    0
  ),
  (
    current_setting('test.rg_rls_note_a2_id')::uuid,
    current_setting('test.rg_rls_user_a_id')::uuid,
    'note a2',
    'content a2',
    0
  ),
  (
    current_setting('test.rg_rls_note_b_id')::uuid,
    current_setting('test.rg_rls_user_b_id')::uuid,
    'note b',
    'content b',
    0
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.rg_rls_log_a_id')::uuid,
    current_setting('test.rg_rls_note_a_id')::uuid,
    current_setting('test.rg_rls_user_a_id')::uuid,
    1,
    now()
  ),
  (
    current_setting('test.rg_rls_log_a2_id')::uuid,
    current_setting('test.rg_rls_note_a2_id')::uuid,
    current_setting('test.rg_rls_user_a_id')::uuid,
    2,
    now()
  ),
  (
    current_setting('test.rg_rls_log_b_id')::uuid,
    current_setting('test.rg_rls_note_b_id')::uuid,
    current_setting('test.rg_rls_user_b_id')::uuid,
    1,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- user_b 소유 채점 결과 (RLS 우회 상태에서 미리 넣어 둔다)
INSERT INTO public.review_gradings (review_log_id, note_id, user_id, round, user_answer, score, feedback)
VALUES (
  current_setting('test.rg_rls_log_b_id')::uuid,
  current_setting('test.rg_rls_note_b_id')::uuid,
  current_setting('test.rg_rls_user_b_id')::uuid,
  1,
  'answer b',
  70,
  '{"summary":"b","missedConcepts":[],"incorrectPoints":[]}'::jsonb
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.rg_rls_user_a_id'),
    'role', 'authenticated'
  )::text,
  true
);

-- [정답 조건]

-- 본인의 진행 중인 복습에 대해 채점을 선점할 수 있어야 한다
SELECT is(
  public.claim_review_grading(
    current_setting('test.rg_rls_log_a_id')::uuid,
    'answer a'
  ),
  'ok',
  $$본인의 진행 중인 복습에 대해 채점을 선점할 수 있어야 한다$$
);

-- 선점 직후 행은 score/feedback이 NULL인 진행 중 상태여야 한다
SELECT is(
  (
    SELECT count(*)
    FROM public.review_gradings
    WHERE review_log_id = current_setting('test.rg_rls_log_a_id')::uuid
      AND score IS NULL
      AND feedback IS NULL
  ),
  1::bigint,
  $$선점 직후 행은 score/feedback이 NULL인 진행 중 상태여야 한다$$
);

-- 선점이 유효한 동안 다시 선점하면 in_flight여야 한다 (Gemini 중복 호출 차단)
SELECT is(
  public.claim_review_grading(
    current_setting('test.rg_rls_log_a_id')::uuid,
    'answer a again'
  ),
  'in_flight',
  $$선점이 유효한 동안 다시 선점하면 in_flight여야 한다$$
);

-- 채점 결과를 확정할 수 있어야 한다
SELECT is(
  public.finalize_review_grading(
    current_setting('test.rg_rls_log_a_id')::uuid,
    85,
    '{"summary":"a","missedConcepts":["개념"],"incorrectPoints":[]}'::jsonb
  ),
  'ok',
  $$채점 결과를 확정할 수 있어야 한다$$
);

-- 확정 후 다시 선점하면 already_graded여야 한다 (복습 1회당 채점 1회)
SELECT is(
  public.claim_review_grading(
    current_setting('test.rg_rls_log_a_id')::uuid,
    'answer a third'
  ),
  'already_graded',
  $$확정 후 다시 선점하면 already_graded여야 한다$$
);

-- 확정 후 다시 확정하면 already_graded여야 한다 (점수 덮어쓰기 차단)
SELECT is(
  public.finalize_review_grading(
    current_setting('test.rg_rls_log_a_id')::uuid,
    100,
    '{"summary":"overwrite","missedConcepts":[],"incorrectPoints":[]}'::jsonb
  ),
  'already_graded',
  $$확정 후 다시 확정하면 already_graded여야 한다$$
);

-- [예외 조건]

-- user_a로 인증 후 user_b의 복습 로그를 선점할 수 없어야 한다
SELECT is(
  public.claim_review_grading(
    current_setting('test.rg_rls_log_b_id')::uuid,
    'hijack'
  ),
  'not_found',
  $$user_a로 인증 후 user_b의 복습 로그를 선점할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 채점 결과를 확정할 수 없어야 한다
SELECT is(
  public.finalize_review_grading(
    current_setting('test.rg_rls_log_b_id')::uuid,
    0,
    '{"summary":"hijack","missedConcepts":[],"incorrectPoints":[]}'::jsonb
  ),
  'not_found',
  $$user_a로 인증 후 user_b의 채점 결과를 확정할 수 없어야 한다$$
);

-- 필수 키가 없는 feedback으로는 확정할 수 없어야 한다
-- (키가 없으면 jsonb_typeof가 NULL을 반환해 조건이 NULL로 떨어지는 것을 IS NOT TRUE로 잡는다)
SELECT throws_ok(
  format(
    $sql$SELECT public.finalize_review_grading('%s'::uuid, 50, '{}'::jsonb);$sql$,
    current_setting('test.rg_rls_log_a_id')
  ),
  '22023',
  NULL,
  $$필수 키가 없는 feedback으로는 확정할 수 없어야 한다$$
);

-- summary 타입이 틀린 feedback으로는 확정할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      SELECT public.finalize_review_grading(
        '%s'::uuid,
        50,
        '{"summary":1,"missedConcepts":[],"incorrectPoints":[]}'::jsonb
      );
    $sql$,
    current_setting('test.rg_rls_log_a_id')
  ),
  '22023',
  NULL,
  $$summary 타입이 틀린 feedback으로는 확정할 수 없어야 한다$$
);

-- 배열 원소가 문자열이 아닌 feedback으로는 확정할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      SELECT public.finalize_review_grading(
        '%s'::uuid,
        50,
        '{"summary":"s","missedConcepts":[1],"incorrectPoints":[]}'::jsonb
      );
    $sql$,
    current_setting('test.rg_rls_log_a_id')
  ),
  '22023',
  NULL,
  $$배열 원소가 문자열이 아닌 feedback으로는 확정할 수 없어야 한다$$
);

-- 채점 결과를 클라이언트가 직접 INSERT할 수 없어야 한다 (INSERT 정책 없음)
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_gradings (review_log_id, note_id, user_id, round, user_answer, score, feedback)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 2, 'direct', 100, '{"summary":"s","missedConcepts":[],"incorrectPoints":[]}'::jsonb);
    $sql$,
    current_setting('test.rg_rls_log_a2_id'),
    current_setting('test.rg_rls_note_a2_id'),
    current_setting('test.rg_rls_user_a_id')
  ),
  '42501',
  NULL,
  $$채점 결과를 클라이언트가 직접 INSERT할 수 없어야 한다$$
);

-- 본인 채점 결과라도 DELETE할 수 없어야 한다 (삭제 후 재채점 반복 차단)
WITH deleted AS (
  DELETE FROM public.review_gradings
  WHERE review_log_id = current_setting('test.rg_rls_log_a_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$본인 채점 결과라도 DELETE할 수 없어야 한다$$
);

-- user_a로 인증 후 user_b의 채점 결과를 SELECT해도 반환되면 안 된다
SELECT is(
  (
    SELECT count(*)
    FROM public.review_gradings
    WHERE review_log_id = current_setting('test.rg_rls_log_b_id')::uuid
  ),
  0::bigint,
  $$user_a로 인증 후 user_b의 채점 결과를 SELECT해도 반환되면 안 된다$$
);

SELECT * FROM finish();
ROLLBACK;
