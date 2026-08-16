-- =========================================
-- quiz_generations / claim_quiz_generation_v2 · finalize_quiz_generation_v2
--
-- v1(claim_quiz_generation)의 in-flight 검사는 "최근 10초 내 같은 요청"일 뿐 완료 여부를
-- 모른다. v2는 완료 상태(completed_at)를 도입해 "9초 만에 끝난 요청도 창이 닫힐 때까지
-- 재생성이 막히는" 문제와 "느린 응답 두 건이 순서 없이 저장을 덮어쓰는" 문제를 함께 푼다.
--
-- finalize_quiz_generation_v2는 completed_at 갱신과 quizzes 캐시 upsert를 같은 트랜잭션
-- 안에서 함께 처리한다(원래는 별도 왕복이었으나, 그 사이 다음 세대가 먼저 저장을 끝내고
-- 이전 세대가 뒤늦게 덮어쓰는 경합이 있어 하나로 합쳤다). 그래서 아래 테스트는 반환값뿐
-- 아니라 quizzes 테이블에 실제로 무엇이 쓰였는지도 함께 확인한다.
-- =========================================

BEGIN;

SELECT plan(22);

SELECT set_config('test.qgv2_user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.qgv2_note_b_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    current_setting('test.qgv2_user_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'qgv2_a_' || current_setting('test.qgv2_user_a_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.qgv2_user_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'qgv2_b_' || current_setting('test.qgv2_user_b_id') || '@example.com',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.qgv2_note_a_id')::uuid, current_setting('test.qgv2_user_a_id')::uuid, 'note a', 'content a', 0),
  (current_setting('test.qgv2_note_a2_id')::uuid, current_setting('test.qgv2_user_a_id')::uuid, 'note a2', 'content a2', 0),
  (current_setting('test.qgv2_note_b_id')::uuid, current_setting('test.qgv2_user_b_id')::uuid, 'note b', 'content b', 0)
ON CONFLICT (id) DO NOTHING;

-- =========================================
-- 1. 권한 잠금 — authenticated는 v2를 직접 호출할 수 없어야 한다
-- =========================================

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.qgv2_user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT throws_ok(
  format(
    $sql$
      SELECT public.claim_quiz_generation_v2('%s'::uuid, '%s'::uuid, 'ox');
    $sql$,
    current_setting('test.qgv2_user_a_id'),
    current_setting('test.qgv2_note_a_id')
  ),
  '42501',
  NULL,
  $$authenticated로 claim_quiz_generation_v2를 직접 호출하면 거부돼야 한다$$
);

RESET ROLE;

-- =========================================
-- 2. 정상 선점 → 완료(+캐시 저장) → 즉시 재선점
-- =========================================

SELECT set_config(
  'test.qgv2_claim1',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim1')::jsonb) ->> 'status',
  'ok',
  $$본인 노트에 대한 첫 선점은 ok를 반환해야 한다$$
);

-- 미완료 선점이 창 안에서는 in_flight를 반환해야 한다
SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  ) ->> 'status',
  'in_flight',
  $$미완료 선점이 창 안에 있으면 in_flight를 반환해야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim1')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"ox","question":"Q1","answer":true,"explanation":"E1"}]'::jsonb,
    '[["Q1"]]'::jsonb,
    'hash-a-ox-1'
  ),
  'ok',
  $$선점한 행을 완료로 확정할 수 있어야 한다$$
);

-- finalize가 completed_at 갱신과 같은 트랜잭션 안에서 quizzes 캐시도 저장해야 한다
SELECT is(
  (SELECT note_content_hash FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a_id')::uuid AND quiz_type = 'ox'),
  'hash-a-ox-1',
  $$finalize ok는 quizzes 캐시를 저장해야 한다$$
);

-- 완료 상태 도입의 핵심: 완료 표시 후에는 창이 남아 있어도 즉시 재선점된다
--
-- 반환값을 반드시 캡처해서 쓴다. 이 테스트 파일 전체가 트랜잭션 하나(BEGIN~ROLLBACK) 안에서
-- 돌아 now()가 트랜잭션 시작 시각으로 고정되므로, claim1·claim2의 created_at이 동일해진다.
-- 이후 "ORDER BY created_at DESC LIMIT 1"로 claim2를 다시 조회하면 동시각 tie 중 아무 행이나
-- 걸릴 수 있어(완료된 claim1을 집어올 수도 있다) 안전하지 않다.
SELECT set_config(
  'test.qgv2_claim2',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim2')::jsonb) ->> 'status',
  'ok',
  $$완료 표시 후에는 즉시 재선점돼야 한다$$
);

-- =========================================
-- 3. finalize 예외 조건
-- =========================================

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    gen_random_uuid(),
    '{}'::jsonb,
    '[]'::jsonb,
    'unused'
  ),
  'not_found',
  $$존재하지 않는 claim_token으로 확정하면 not_found여야 한다$$
);

-- not_found로 끝난 시도는 캐시를 건드리지 않아야 한다 (여전히 claim1의 내용이어야 한다)
SELECT is(
  (SELECT note_content_hash FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a_id')::uuid AND quiz_type = 'ox'),
  'hash-a-ox-1',
  $$not_found로 끝난 finalize는 quizzes 캐시를 바꾸지 않아야 한다$$
);

-- 위에서 캡처해 둔 claim2(2번 claim)를 완료해 already_completed 경로를 만든다
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim2')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"ox","question":"Q2","answer":false,"explanation":"E2"}]'::jsonb,
    '[["Q2"],["Q1"]]'::jsonb,
    'hash-a-ox-2'
  ),
  'ok',
  $$두 번째 선점도 정상 확정돼야 한다$$
);

SELECT is(
  (SELECT note_content_hash FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a_id')::uuid AND quiz_type = 'ox'),
  'hash-a-ox-2',
  $$두 번째 선점의 finalize ok는 캐시를 최신 내용으로 덮어써야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a_id')::uuid,
    'ox',
    ((current_setting('test.qgv2_claim2')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"ox","question":"Q2","answer":false,"explanation":"E2"}]'::jsonb,
    '[["Q2"],["Q1"]]'::jsonb,
    'hash-a-ox-2'
  ),
  'already_completed',
  $$이미 완료된 최신 선점을 다시 확정하면 already_completed여야 한다$$
);

-- =========================================
-- 4. 선점 인계 — stale_claim의 핵심
--    A 선점 → A의 created_at을 in-flight 창 이전으로 이동 → B가 선점 인계
--    → A token으로 finalize = stale_claim → B는 여전히 미완료
--    → B token으로 finalize = ok
-- =========================================

-- 앞선 시나리오의 선점 기록이 새 일일 3회 한도에 간섭하지 않게 범위 밖으로 옮긴다.
UPDATE public.quiz_generations
SET created_at = now() - interval '2 days'
WHERE user_id = current_setting('test.qgv2_user_a_id')::uuid;

SELECT set_config(
  'test.qgv2_claim_a',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank'
  )::text,
  true
);

UPDATE public.quiz_generations
SET created_at = now() - interval '121 seconds'
WHERE claim_token = ((current_setting('test.qgv2_claim_a')::jsonb) ->> 'claimToken')::uuid;

SELECT set_config(
  'test.qgv2_claim_b',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank'
  )::text,
  true
);

SELECT is(
  (current_setting('test.qgv2_claim_b')::jsonb) ->> 'status',
  'ok',
  $$in-flight 창을 넘긴 미완료 선점은 새 요청이 이어받아야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank',
    ((current_setting('test.qgv2_claim_a')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"blank","question":"stale ____","answer":"stale","acceptedAnswers":[],"explanation":"E"}]'::jsonb,
    '[["stale"]]'::jsonb,
    'hash-stale-a2-blank'
  ),
  'stale_claim',
  $$인계당한 과거 토큰으로 확정하면 stale_claim이어야 한다$$
);

-- stale_claim으로 끝난 시도는 캐시에 아무것도 남기지 않아야 한다
SELECT is(
  (SELECT count(*) FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a2_id')::uuid AND quiz_type = 'blank'),
  0::bigint,
  $$stale_claim으로 끝난 finalize는 quizzes에 아무 행도 남기지 않아야 한다$$
);

SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'blank',
    ((current_setting('test.qgv2_claim_b')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"blank","question":"fresh ____","answer":"fresh","acceptedAnswers":[],"explanation":"E"}]'::jsonb,
    '[["fresh"]]'::jsonb,
    'hash-fresh-a2-blank'
  ),
  'ok',
  $$최신 선점 토큰으로는 정상 확정돼야 한다$$
);

SELECT is(
  (SELECT note_content_hash FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a2_id')::uuid AND quiz_type = 'blank'),
  'hash-fresh-a2-blank',
  $$최신 선점의 finalize ok는 캐시를 저장해야 한다$$
);

-- =========================================
-- 5. 판정 순서 고정 — 완료된 과거 claim보다 새 claim이 있으면
--    과거 token은 already_completed가 아니라 stale_claim이어야 한다
-- =========================================

-- 선점 인계 시나리오의 기록도 일일 범위 밖으로 옮겨 판정 순서만 격리해 검증한다.
UPDATE public.quiz_generations
SET created_at = now() - interval '2 days'
WHERE user_id = current_setting('test.qgv2_user_a_id')::uuid;

SELECT set_config(
  'test.qgv2_claim_c',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice'
  )::text,
  true
);

-- C를 먼저 완료시킨다 (completed_at이 채워진 과거 행이 된다)
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice',
    ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"choice","question":"C","options":["1","2","3","4"],"answer":0,"explanation":"E"}]'::jsonb,
    '[["C"]]'::jsonb,
    'hash-c-a2-choice'
  ),
  'ok',
  $$C 선점을 먼저 완료시킨다$$
);

UPDATE public.quiz_generations
SET created_at = now() - interval '121 seconds'
WHERE claim_token = ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid;

SELECT set_config(
  'test.qgv2_claim_d',
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice'
  )::text,
  true
);

-- D가 새로 선점됐으므로, 완료됐던 C 토큰도 already_completed가 아니라 stale_claim이어야 한다.
-- C와 다른 내용을 넘겨서, 실제로 캐시가 안 바뀌는지까지 함께 검증한다.
SELECT is(
  public.finalize_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'choice',
    ((current_setting('test.qgv2_claim_c')::jsonb) ->> 'claimToken')::uuid,
    '[{"type":"choice","question":"stale C","options":["1","2","3","4"],"answer":1,"explanation":"E"}]'::jsonb,
    '[["stale C"]]'::jsonb,
    'hash-stale-c-a2-choice'
  ),
  'stale_claim',
  $$완료된 과거 claim보다 새 claim이 있으면 stale_claim이 already_completed보다 우선해야 한다$$
);

SELECT is(
  (SELECT note_content_hash FROM public.quizzes
   WHERE note_id = current_setting('test.qgv2_note_a2_id')::uuid AND quiz_type = 'choice'),
  'hash-c-a2-choice',
  $$stale_claim이 된 재시도는 이미 저장된 C의 캐시를 덮어쓰지 않아야 한다$$
);

-- =========================================
-- 6. 노트 소유권 재검증 — v2는 service_role로 불려 RLS를 우회하므로 자체 재검증한다
-- =========================================

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_b_id')::uuid,
    'ox'
  ) ->> 'status',
  'not_found',
  $$v2 claim이 p_user_id 소유가 아닌 노트를 선점하면 not_found여야 한다$$
);

-- =========================================
-- 7. 완료 행도 버스트·일일 카운트에 잡힌다 (완료 표시가 한도 우회 수단이 되면 안 된다)
-- =========================================

UPDATE public.quiz_generations
SET created_at = now() - interval '2 days'
WHERE user_id = current_setting('test.qgv2_user_a_id')::uuid;

INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, completed_at)
SELECT
  current_setting('test.qgv2_user_a_id')::uuid,
  current_setting('test.qgv2_note_a2_id')::uuid,
  'burst_' || i,
  now()
FROM generate_series(1, 5) AS i;

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'burst_probe'
  ) ->> 'status',
  'too_many_requests',
  $$완료된 행 5건도 60초 버스트 한도에 포함돼야 한다$$
);

UPDATE public.quiz_generations
SET created_at = now() - interval '2 days'
WHERE user_id = current_setting('test.qgv2_user_a_id')::uuid;

INSERT INTO public.quiz_generations (user_id, note_id, quiz_type, completed_at, created_at)
SELECT
  current_setting('test.qgv2_user_a_id')::uuid,
  current_setting('test.qgv2_note_a2_id')::uuid,
  'daily_' || i,
  now() - interval '2 minutes',
  now() - interval '2 minutes'
FROM generate_series(1, 3) AS i;

SELECT is(
  public.claim_quiz_generation_v2(
    current_setting('test.qgv2_user_a_id')::uuid,
    current_setting('test.qgv2_note_a2_id')::uuid,
    'daily_probe'
  ) ->> 'status',
  'daily_exceeded',
  $$완료된 행 3건도 일일 한도에 포함돼야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
