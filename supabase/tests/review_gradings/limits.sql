-- =========================================
-- review_grading_generations / AI 채점 사용량 한도
--
-- 한도 값은 claim_review_grading 안의 상수다(일 30회 / 60초 10회).
-- 여기서는 "기록이 남는 경로와 남지 않는 경로"를 구분하는지, 그리고 한도를 넘기면
-- AI를 부르기 전에 막히는지를 본다.
-- =========================================

BEGIN;

SELECT plan(10);

SELECT set_config('test.rgl_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_note2_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_log2_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_other_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_other_log_id', gen_random_uuid()::text, true);
SELECT set_config('test.rgl_content_hash', repeat('c', 64), true);

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
    current_setting('test.rgl_user_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rgl_user_' || current_setting('test.rgl_user_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    current_setting('test.rgl_other_user_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rgl_other_' || current_setting('test.rgl_other_user_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

-- review_logs_one_pending_per_note_idx가 노트당 pending 로그를 1건으로 제한하므로
-- 두 번째 복습 로그는 별도 노트에 붙인다.
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (
    current_setting('test.rgl_note_id')::uuid,
    current_setting('test.rgl_user_id')::uuid,
    '한도 테스트 노트',
    '본문',
    0
  ),
  (
    current_setting('test.rgl_note2_id')::uuid,
    current_setting('test.rgl_user_id')::uuid,
    '한도 테스트 노트 2',
    '본문',
    0
  ),
  (
    current_setting('test.rgl_other_note_id')::uuid,
    current_setting('test.rgl_other_user_id')::uuid,
    '다른 사용자 노트',
    '본문',
    0
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (
    current_setting('test.rgl_log_id')::uuid,
    current_setting('test.rgl_note_id')::uuid,
    current_setting('test.rgl_user_id')::uuid,
    1,
    now()
  ),
  (
    current_setting('test.rgl_log2_id')::uuid,
    current_setting('test.rgl_note2_id')::uuid,
    current_setting('test.rgl_user_id')::uuid,
    1,
    now()
  ),
  (
    current_setting('test.rgl_other_log_id')::uuid,
    current_setting('test.rgl_other_note_id')::uuid,
    current_setting('test.rgl_other_user_id')::uuid,
    1,
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 1. AI를 부르는 경로만 사용량을 기록한다
-- =========================================

SELECT set_config(
  'test.rgl_claim',
  public.claim_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log_id')::uuid,
    'answer',
    current_setting('test.rgl_content_hash')
  )::text,
  true
);

SELECT is(
  (current_setting('test.rgl_claim')::jsonb) ->> 'status',
  'ok',
  $$첫 선점은 통과해야 한다$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_grading_generations
    WHERE user_id = current_setting('test.rgl_user_id')::uuid
  ),
  1::bigint,
  $$선점에 성공하면 사용 기록이 1건 남아야 한다$$
);

-- 진행 중인 선점을 다시 부르면 in_flight다. AI를 부르지 않으므로 사용량도 늘지 않는다.
SELECT is(
  public.claim_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log_id')::uuid,
    'answer again',
    current_setting('test.rgl_content_hash')
  ) ->> 'status',
  'in_flight',
  $$진행 중인 선점을 다시 부르면 in_flight여야 한다$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_grading_generations
    WHERE user_id = current_setting('test.rgl_user_id')::uuid
  ),
  1::bigint,
  $$in_flight는 사용량을 늘리지 않아야 한다$$
);

-- 확정된 채점을 다시 부르면 already_graded다. 저장된 결과를 읽을 뿐이라 사용량도 그대로다.
--
-- 결과를 버리는 bare SELECT로 두면 안 된다. 반환값 'ok'가 그대로 출력되고
-- prove가 그 줄을 TAP 결과로 읽어 테스트 번호가 어긋난다. 단언으로 감싼다.
SELECT is(
  public.finalize_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log_id')::uuid,
    ((current_setting('test.rgl_claim')::jsonb) ->> 'claimToken')::uuid,
    80,
    '{"summary":"s","missedConcepts":[],"incorrectPoints":[]}'::jsonb
  ),
  'ok',
  $$선점한 채점을 확정할 수 있어야 한다$$
);

SELECT is(
  public.claim_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log_id')::uuid,
    'answer once more',
    current_setting('test.rgl_content_hash')
  ) ->> 'status',
  'already_graded',
  $$확정된 채점을 다시 부르면 already_graded여야 한다$$
);

SELECT is(
  (
    SELECT count(*)
    FROM public.review_grading_generations
    WHERE user_id = current_setting('test.rgl_user_id')::uuid
  ),
  1::bigint,
  $$already_graded는 사용량을 늘리지 않아야 한다$$
);

-- =========================================
-- 2. 버스트·일일 한도
--
-- 노트를 대량으로 만들어 연속 호출하는 경로를 막는 것이 목적이다.
-- review_log 단위 유니크 제약은 "복습 1회당 1번"만 막을 뿐 사용자 총량을 막지 못한다.
-- =========================================

-- 60초 안에 10건을 채운 상태
INSERT INTO public.review_grading_generations (user_id, review_log_id)
SELECT current_setting('test.rgl_user_id')::uuid, NULL
FROM generate_series(1, 10);

SELECT is(
  public.claim_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log2_id')::uuid,
    'answer for log2',
    current_setting('test.rgl_content_hash')
  ) ->> 'status',
  'too_many_requests',
  $$60초 안에 10회를 채우면 too_many_requests를 반환해야 한다$$
);

-- 버스트 윈도우를 벗어난 기록이 30건이면 daily_exceeded여야 한다
UPDATE public.review_grading_generations
SET created_at = now() - interval '2 minutes'
WHERE user_id = current_setting('test.rgl_user_id')::uuid;

INSERT INTO public.review_grading_generations (user_id, review_log_id, created_at)
SELECT
  current_setting('test.rgl_user_id')::uuid,
  NULL,
  now() - interval '2 minutes'
FROM generate_series(1, 19);

SELECT is(
  public.claim_review_grading(
    current_setting('test.rgl_user_id')::uuid,
    current_setting('test.rgl_log2_id')::uuid,
    'answer for log2',
    current_setting('test.rgl_content_hash')
  ) ->> 'status',
  'daily_exceeded',
  $$하루 30회를 채우면 다른 복습 로그도 선점할 수 없어야 한다$$
);

-- 한도는 사용자 단위다. 한 사람이 다 썼다고 다른 사람까지 막으면 안 된다.
SELECT is(
  public.claim_review_grading(
    current_setting('test.rgl_other_user_id')::uuid,
    current_setting('test.rgl_other_log_id')::uuid,
    'answer from other user',
    current_setting('test.rgl_content_hash')
  ) ->> 'status',
  'ok',
  $$한도는 사용자별로 분리돼야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
