-- =========================================
-- review_gradings / user_answer 길이 제약
--
-- 답안은 claim_review_grading을 통해서만 저장된다.
-- Zod(ANSWER_MAX_LENGTH)가 앱 경로를 막지만, 프롬프트 크기 상한은 DB에서도 보장한다.
-- =========================================

BEGIN;

SELECT plan(3);

SELECT set_config('test.rg_len_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_len_note_max_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_len_note_over_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_len_log_max_id', gen_random_uuid()::text, true);
SELECT set_config('test.rg_len_log_over_id', gen_random_uuid()::text, true);

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
VALUES (
  current_setting('test.rg_len_user_id')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'rg_len_' || current_setting('test.rg_len_user_id') || '@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- review_logs_one_pending_per_note_idx가 노트당 pending 로그를 1건으로 제한하므로
-- 성공 케이스와 실패 케이스는 서로 다른 노트를 쓴다.
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.rg_len_note_max_id')::uuid,
    current_setting('test.rg_len_user_id')::uuid,
    'len max',
    'content',
    0
  ),
  (
    current_setting('test.rg_len_note_over_id')::uuid,
    current_setting('test.rg_len_user_id')::uuid,
    'len over',
    'content',
    0
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.rg_len_log_max_id')::uuid,
    current_setting('test.rg_len_note_max_id')::uuid,
    current_setting('test.rg_len_user_id')::uuid,
    1,
    now()
  ),
  (
    current_setting('test.rg_len_log_over_id')::uuid,
    current_setting('test.rg_len_note_over_id')::uuid,
    current_setting('test.rg_len_user_id')::uuid,
    1,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- [경계 조건]
-- 50000자 답안은 선점에 성공해야 한다 (최대값)
SELECT is(
  public.claim_review_grading(
    current_setting('test.rg_len_user_id')::uuid,
    current_setting('test.rg_len_log_max_id')::uuid,
    repeat('a', 50000)
  ) ->> 'status',
  'ok',
  $$50000자 답안은 선점에 성공해야 한다 (최대값)$$
);

-- [예외 조건]
-- 50001자 답안은 CHECK 제약 위반으로 실패해야 한다 (최대값 바로 위)
SELECT throws_ok(
  format(
    $sql$
      SELECT public.claim_review_grading('%s'::uuid, '%s'::uuid, repeat('a', 50001));
    $sql$,
    current_setting('test.rg_len_user_id'),
    current_setting('test.rg_len_log_over_id')
  ),
  '23514',
  NULL,
  $$50001자 답안은 CHECK 제약 위반으로 실패해야 한다 (최대값 바로 위)$$
);

-- [불변 조건]
-- review_gradings에 user_answer 길이가 50000자를 초과하는 행이 존재해서는 안 된다
SELECT is(
  (SELECT count(*) FROM public.review_gradings WHERE char_length(user_answer) > 50000),
  0::bigint,
  $$review_gradings에 user_answer 길이가 50000자를 초과하는 행이 존재해서는 안 된다$$
);

SELECT * FROM finish();
ROLLBACK;
