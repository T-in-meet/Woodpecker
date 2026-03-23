-- =========================================
-- review_logs / RLS (refined)
-- 목적:
-- 1) 중복 검증 축 축소
-- 2) 성공 INSERT 불변을 "방금 넣은 행" 직접 검증으로 강화
-- 3) UPDATE / DELETE 정책 부재 검증을 0 rows affected 중심으로 정리
--
-- 참고:
-- - 이 파일은 RLS 축에 집중한다.
-- - note_id 비존재, FK 위반 같은 축은 별도 FK 테스트 파일에서 검증하는 것을 권장한다.
-- =========================================

BEGIN;

SELECT plan(32);

-- 테스트용 UUID 준비
SELECT set_config('test.user_a_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_b_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_c_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_a3_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_log_a1_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_log_a2_id', gen_random_uuid()::text, true);
SELECT set_config('test.review_log_b1_id', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_1', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_2', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_3', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_4', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_5', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_6', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_7', gen_random_uuid()::text, true);
SELECT set_config('test.insert_id_8', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.user_a_id')::uuid, 'user_a_' || current_setting('test.user_a_id') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_b_id')::uuid, 'user_b_' || current_setting('test.user_b_id') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_c_id')::uuid, 'user_c_' || current_setting('test.user_c_id') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.note_a1_id')::uuid, current_setting('test.user_a_id')::uuid, 'note a1', 'content a1', 0),
  (current_setting('test.note_a2_id')::uuid, current_setting('test.user_a_id')::uuid, 'note a2', 'content a2', 0),
  (current_setting('test.note_a3_id')::uuid, current_setting('test.user_a_id')::uuid, 'note a3', 'content a3', 0),
  (current_setting('test.note_b1_id')::uuid, current_setting('test.user_b_id')::uuid, 'note b1', 'content b1', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (current_setting('test.review_log_a1_id')::uuid, current_setting('test.note_a1_id')::uuid, current_setting('test.user_a_id')::uuid, 1, now() + interval '1 day'),
  (current_setting('test.review_log_a2_id')::uuid, current_setting('test.note_a2_id')::uuid, current_setting('test.user_a_id')::uuid, 2, now() + interval '2 days'),
  (current_setting('test.review_log_b1_id')::uuid, current_setting('test.note_b1_id')::uuid, current_setting('test.user_b_id')::uuid, 1, now() + interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 정책 1: RLS — SELECT own
-- =====================================================================

-- [정답 조건] user_a는 자신의 review_logs를 조회할 수 있어야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE id = current_setting('test.review_log_a1_id')::uuid),
  1::bigint,
  $$user_a는 자신의 review_log_a1를 조회할 수 있어야 한다$$
);

SELECT is(
  (SELECT count(*) FROM public.review_logs),
  2::bigint,
  $$user_a는 조건 없는 SELECT 시 자신의 review_logs 2개만 조회할 수 있어야 한다$$
);

-- user_b도 자신의 review_logs를 조회할 수 있어야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_b_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE id = current_setting('test.review_log_b1_id')::uuid),
  1::bigint,
  $$user_b는 자신의 review_log_b1를 조회할 수 있어야 한다$$
);

-- [예외 조건] 타인 row는 조회할 수 없어야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE id = current_setting('test.review_log_b1_id')::uuid),
  0::bigint,
  $$user_a는 user_b의 review_logs를 조회할 수 없어야 한다$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT is(
  (SELECT count(*) FROM public.review_logs),
  0::bigint,
  $$anon은 review_logs를 조회할 수 없어야 한다$$
);

-- [경계 조건] 0개 / 1개 사용자 분포
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_c_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs),
  0::bigint,
  $$review_logs가 0개인 사용자는 빈 집합을 받아야 한다$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_b_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs),
  1::bigint,
  $$review_logs가 1개인 사용자는 정확히 1개만 조회해야 한다$$
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.review_logs),
  2::bigint,
  $$review_logs가 N개인 사용자는 정확히 N개만 조회해야 한다$$
);

-- [불변 조건] 전체 결과에는 타인 row가 섞이면 안 된다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SELECT ok(
  (SELECT count(*) FROM public.review_logs) = 2
  AND (SELECT count(*) FROM public.review_logs WHERE user_id = auth.uid()) = 2
  AND (SELECT count(*) FROM public.review_logs WHERE user_id <> auth.uid()) = 0,
  $$SELECT 결과에는 user_a 본인 review_logs 2개만 존재하고 타인 row는 포함되면 안 된다$$
);

-- =====================================================================
-- 정책 2: RLS — INSERT own + own note only
-- =====================================================================

-- [정답 조건] user_a 정상 INSERT
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SAVEPOINT review_logs_insert_user_a;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '10 days');
    $sql$,
    current_setting('test.insert_id_1'),
    current_setting('test.note_a1_id'),
    current_setting('test.user_a_id')
  ),
  $$user_a는 자신의 note에 자신의 user_id로 INSERT할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT review_logs_insert_user_a;

-- user_b 정상 INSERT
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_b_id'), 'role', 'authenticated')::text,
  true
);

SAVEPOINT review_logs_insert_user_b;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '11 days');
    $sql$,
    current_setting('test.insert_id_2'),
    current_setting('test.note_b1_id'),
    current_setting('test.user_b_id')
  ),
  $$user_b는 자신의 note에 자신의 user_id로 INSERT할 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT review_logs_insert_user_b;

-- 첫 INSERT도 성공해야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SAVEPOINT review_logs_insert_first;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '12 days');
    $sql$,
    current_setting('test.insert_id_3'),
    current_setting('test.note_a3_id'),
    current_setting('test.user_a_id')
  ),
  $$본인 note에 대한 첫 review_log INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT review_logs_insert_first;

-- 여러 note에 대한 반복 INSERT도 각각 성공해야 한다
SAVEPOINT review_logs_insert_multiple;
WITH inserted AS (
  INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
  VALUES
    (current_setting('test.insert_id_4')::uuid, current_setting('test.note_a1_id')::uuid, current_setting('test.user_a_id')::uuid, 1, now() + interval '13 days'),
    (current_setting('test.insert_id_5')::uuid, current_setting('test.note_a2_id')::uuid, current_setting('test.user_a_id')::uuid, 2, now() + interval '14 days')
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM inserted),
  2::bigint,
  $$본인 여러 note에 대한 반복 INSERT는 각각 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT review_logs_insert_multiple;

-- [예외 조건] user_id 불일치
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '15 days');
    $sql$,
    current_setting('test.insert_id_6'),
    current_setting('test.note_a1_id'),
    current_setting('test.user_b_id')
  ),
  '42501',
  NULL,
  $$auth.uid()와 다른 user_id로 INSERT하면 실패해야 한다$$
);

-- 타인 note 참조 불가
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '16 days');
    $sql$,
    current_setting('test.insert_id_7'),
    current_setting('test.note_b1_id'),
    current_setting('test.user_a_id')
  ),
  '42501',
  NULL,
  $$타인 소유 note_id로 INSERT하면 실패해야 한다$$
);

-- user_id와 note_id가 둘 다 불일치하면 실패
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '17 days');
    $sql$,
    current_setting('test.insert_id_8'),
    current_setting('test.note_b1_id'),
    current_setting('test.user_b_id')
  ),
  '42501',
  NULL,
  $$user_id와 note_id가 모두 auth.uid() 소유 조건을 벗어나면 실패해야 한다$$
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '18 days');
    $sql$,
    current_setting('test.note_a1_id'),
    current_setting('test.user_a_id')
  ),
  '42501',
  NULL,
  $$anon은 review_logs를 INSERT할 수 없어야 한다$$
);

-- [불변 조건] 성공 INSERT 행은 "방금 넣은 행" 기준으로 직접 검증한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SAVEPOINT review_logs_insert_invariant_strict;

SELECT set_config('test.target_id', gen_random_uuid()::text, true);

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES (
  current_setting('test.target_id')::uuid,
  current_setting('test.note_a2_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  3,
  now() + interval '19 days'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.review_logs rl
    JOIN public.notes n
      ON n.id = rl.note_id
    WHERE rl.id = current_setting('test.target_id')::uuid
      AND rl.user_id = auth.uid()
      AND n.user_id = auth.uid()
  ),
  $$방금 INSERT한 특정 행(target_id)은 auth.uid() 소유 row이며, 참조 note도 auth.uid() 소유여야 한다 (Strict Status)$$
);

ROLLBACK TO SAVEPOINT review_logs_insert_invariant_strict;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

SAVEPOINT review_logs_insert_visible_set_invariant;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES (
  gen_random_uuid(),
  current_setting('test.note_a1_id')::uuid,
  current_setting('test.user_a_id')::uuid,
  3,
  now() + interval '19 days'
);

SELECT ok(
  (SELECT count(*) FROM public.review_logs WHERE user_id <> auth.uid()) = 0
  AND
  (SELECT count(*) FROM public.review_logs) =
  (
    SELECT count(*)
    FROM public.review_logs rl
    JOIN public.notes n
      ON n.id = rl.note_id
    WHERE n.user_id = auth.uid()
  ),
  $$성공 INSERT 이후 authenticated에게 보이는 review_logs 전체 집합은 auth.uid() 소유 row만 포함해야 하며, 모든 visible row는 auth.uid() 소유 note를 참조해야 한다$$
);

ROLLBACK TO SAVEPOINT review_logs_insert_visible_set_invariant;

-- [Transition] anon INSERT 시도 전후 count 불변
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT set_config('test.anon_count_before', (SELECT count(*)::text FROM public.review_logs), true);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '20 days');
    $sql$,
    current_setting('test.note_a1_id'),
    current_setting('test.user_a_id')
  ),
  '42501',
  NULL,
  $$anon INSERT 시도는 실패해야 한다$$
);

SELECT set_config('test.anon_count_after', (SELECT count(*)::text FROM public.review_logs), true);

SELECT is(
  current_setting('test.anon_count_after')::bigint,
  current_setting('test.anon_count_before')::bigint,
  $$anon INSERT 시도 전후 review_logs count는 변하지 않아야 한다$$
);

-- =====================================================================
-- 정책 3: RLS — UPDATE / DELETE 정책 부재 확인
-- =====================================================================
-- [정답 조건] 없음: 현재 review_logs에는 UPDATE / DELETE를 허용하는 정책이 없다.

-- [예외 조건] 본인 row도 UPDATE / DELETE 불가
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$authenticated는 자신의 review_log를 UPDATE할 수 없어야 한다$$
);

WITH deleted AS (
  DELETE FROM public.review_logs
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$authenticated는 자신의 review_log를 DELETE할 수 없어야 한다$$
);

-- 타인 row도 UPDATE 불가
WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE id = current_setting('test.review_log_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$authenticated는 타인 review_log도 UPDATE할 수 없어야 한다$$
);

-- 타인 row도 DELETE 불가
WITH deleted AS (
  DELETE FROM public.review_logs
  WHERE id = current_setting('test.review_log_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$authenticated는 타인 review_log도 DELETE할 수 없어야 한다$$
);

-- anon도 UPDATE / DELETE 불가
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
),
removed AS (
  DELETE FROM public.review_logs
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
)
SELECT ok(
  (SELECT count(*) FROM updated) = 0
  AND (SELECT count(*) FROM removed) = 0,
  $$anon은 review_logs를 UPDATE / DELETE할 수 없어야 한다$$
);

-- [경계 조건] 본인 row가 0개인 사용자도 UPDATE / DELETE 가능한 row는 0건이어야 한다
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_c_id'), 'role', 'authenticated')::text,
  true
);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE user_id = current_setting('test.user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$본인 review_logs가 0개인 사용자는 UPDATE 가능한 row가 0건이어야 한다$$
);

WITH deleted AS (
  DELETE FROM public.review_logs
  WHERE user_id = current_setting('test.user_c_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  $$본인 review_logs가 0개인 사용자는 DELETE 가능한 row가 0건이어야 한다$$
);

-- [경계 조건] 본인 row가 1개뿐이어도 UPDATE 불가
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_b_id'), 'role', 'authenticated')::text,
  true
);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE id = current_setting('test.review_log_b1_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$본인 review_logs가 1개뿐이어도 UPDATE는 허용되지 않아야 한다$$
);

-- 본인 row가 여러 개여도 UPDATE 불가
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 9
  WHERE id = current_setting('test.review_log_a2_id')::uuid
  RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  $$본인 review_logs가 여러 개여도 UPDATE는 허용되지 않아야 한다$$
);

-- [Transition] UPDATE 시도 전후 내용 불변
SELECT set_config(
  'test.update_before_round',
  (SELECT round::text
   FROM public.review_logs
   WHERE id = current_setting('test.review_log_a1_id')::uuid),
  true
);
SELECT set_config(
  'test.update_before_sched',
  (SELECT scheduled_at::text
   FROM public.review_logs
   WHERE id = current_setting('test.review_log_a1_id')::uuid),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

WITH updated AS (
  UPDATE public.review_logs
  SET round = 7
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
)
SELECT ok(
  (SELECT count(*) FROM updated) = 0
  AND (SELECT round::text
       FROM public.review_logs
       WHERE id = current_setting('test.review_log_a1_id')::uuid) = current_setting('test.update_before_round')
  AND (SELECT scheduled_at::text
       FROM public.review_logs
       WHERE id = current_setting('test.review_log_a1_id')::uuid) = current_setting('test.update_before_sched'),
  $$UPDATE 시도 전후 대상 row 내용은 변하지 않아야 한다$$
);

-- DELETE 시도 전후 대상 row 유지
SELECT set_config(
  'test.delete_before_count',
  (SELECT count(*)::text
   FROM public.review_logs
   WHERE id = current_setting('test.review_log_a1_id')::uuid),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a_id'), 'role', 'authenticated')::text,
  true
);

WITH deleted AS (
  DELETE FROM public.review_logs
  WHERE id = current_setting('test.review_log_a1_id')::uuid
  RETURNING 1
)
SELECT ok(
  (SELECT count(*) FROM deleted) = 0
  AND (SELECT count(*)::text
       FROM public.review_logs
       WHERE id = current_setting('test.review_log_a1_id')::uuid) = current_setting('test.delete_before_count'),
  $$DELETE 시도 전후 대상 row는 그대로 존재해야 한다$$
);

SELECT * FROM finish();
ROLLBACK;
