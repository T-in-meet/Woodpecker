-- =========================================
-- review_logs / FK
-- =========================================

BEGIN;

SELECT plan(41);

-- 테스트용 UUID 준비
SELECT set_config('test.note_fk_ref_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_user_b', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_note_b1', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_log_a1', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_bogus_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_ref_temp_note_id', gen_random_uuid()::text, true);

SELECT set_config('test.note_fk_cascade_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_note_1child', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_note_nchild', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_note_nchild2', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_note_0child', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_other_note', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_1a', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_n1', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_n2', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_n3', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_n4', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_log_other', gen_random_uuid()::text, true);
SELECT set_config('test.note_fk_cascade_insert_id', gen_random_uuid()::text, true);

SELECT set_config('test.user_fk_ref_user_a', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_user_b', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_note_a1', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_note_b1', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_log_a1', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_insert_id', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_ref_bogus_user_id', gen_random_uuid()::text, true);

SELECT set_config('test.user_fk_cascade_user_1child', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_user_nchild', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_user_nchild2', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_user_0child', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_user_other', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_1child', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_n1', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_n2', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_n3', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_n4', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_0child', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_note_other', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_1a', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_n1', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_n2', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_n3', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_n4', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_log_other', gen_random_uuid()::text, true);
SELECT set_config('test.user_fk_cascade_insert_id', gen_random_uuid()::text, true);

-- seed
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (current_setting('test.note_fk_ref_user_a')::uuid, 'test.note_fk_ref_user_a_' || current_setting('test.note_fk_ref_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.note_fk_ref_user_b')::uuid, 'test.note_fk_ref_user_b_' || current_setting('test.note_fk_ref_user_b') || '@example.com', '{}'::jsonb),
  (current_setting('test.note_fk_cascade_user_a')::uuid, 'test.note_fk_cascade_user_a_' || current_setting('test.note_fk_cascade_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_ref_user_a')::uuid, 'test.user_fk_ref_user_a_' || current_setting('test.user_fk_ref_user_a') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_ref_user_b')::uuid, 'test.user_fk_ref_user_b_' || current_setting('test.user_fk_ref_user_b') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_cascade_user_1child')::uuid, 'test.user_fk_cascade_user_1child_' || current_setting('test.user_fk_cascade_user_1child') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_cascade_user_nchild')::uuid, 'test.user_fk_cascade_user_nchild_' || current_setting('test.user_fk_cascade_user_nchild') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_cascade_user_nchild2')::uuid, 'test.user_fk_cascade_user_nchild2_' || current_setting('test.user_fk_cascade_user_nchild2') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_cascade_user_0child')::uuid, 'test.user_fk_cascade_user_0child_' || current_setting('test.user_fk_cascade_user_0child') || '@example.com', '{}'::jsonb),
  (current_setting('test.user_fk_cascade_user_other')::uuid, 'test.user_fk_cascade_user_other_' || current_setting('test.user_fk_cascade_user_other') || '@example.com', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
  (current_setting('test.note_fk_ref_note_a1')::uuid, current_setting('test.note_fk_ref_user_a')::uuid, 'note fk ref a1', 'content', 0),
  (current_setting('test.note_fk_ref_note_b1')::uuid, current_setting('test.note_fk_ref_user_b')::uuid, 'note fk ref b1', 'content', 0),
  (current_setting('test.note_fk_cascade_note_1child')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 'note fk cascade 1', 'content', 0),
  (current_setting('test.note_fk_cascade_note_nchild')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 'note fk cascade n', 'content', 0),
  (current_setting('test.note_fk_cascade_note_nchild2')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 'note fk cascade n2', 'content', 0),
  (current_setting('test.note_fk_cascade_note_0child')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 'note fk cascade 0', 'content', 0),
  (current_setting('test.note_fk_cascade_other_note')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 'note fk cascade other', 'content', 0),
  (current_setting('test.user_fk_ref_note_a1')::uuid, current_setting('test.user_fk_ref_user_a')::uuid, 'user fk ref a1', 'content', 0),
  (current_setting('test.user_fk_ref_note_b1')::uuid, current_setting('test.user_fk_ref_user_b')::uuid, 'user fk ref b1', 'content', 0),
  (current_setting('test.user_fk_cascade_note_1child')::uuid, current_setting('test.user_fk_cascade_user_1child')::uuid, 'user fk cascade 1', 'content', 0),
  (current_setting('test.user_fk_cascade_note_n1')::uuid, current_setting('test.user_fk_cascade_user_nchild')::uuid, 'user fk cascade n1', 'content', 0),
  (current_setting('test.user_fk_cascade_note_n2')::uuid, current_setting('test.user_fk_cascade_user_nchild')::uuid, 'user fk cascade n2', 'content', 0),
  (current_setting('test.user_fk_cascade_note_n3')::uuid, current_setting('test.user_fk_cascade_user_nchild2')::uuid, 'user fk cascade n3', 'content', 0),
  (current_setting('test.user_fk_cascade_note_n4')::uuid, current_setting('test.user_fk_cascade_user_nchild2')::uuid, 'user fk cascade n4', 'content', 0),
  (current_setting('test.user_fk_cascade_note_0child')::uuid, current_setting('test.user_fk_cascade_user_0child')::uuid, 'user fk cascade 0', 'content', 0),
  (current_setting('test.user_fk_cascade_note_other')::uuid, current_setting('test.user_fk_cascade_user_other')::uuid, 'user fk cascade other', 'content', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
VALUES
  (current_setting('test.note_fk_ref_log_a1')::uuid, current_setting('test.note_fk_ref_note_a1')::uuid, current_setting('test.note_fk_ref_user_a')::uuid, 1, now() + interval '1 day'),
  (current_setting('test.note_fk_cascade_log_1a')::uuid, current_setting('test.note_fk_cascade_note_1child')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 1, now() + interval '2 days'),
  (current_setting('test.note_fk_cascade_log_n1')::uuid, current_setting('test.note_fk_cascade_note_nchild')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 2, now() + interval '3 days'),
  (current_setting('test.note_fk_cascade_log_n2')::uuid, current_setting('test.note_fk_cascade_note_nchild')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 3, now() + interval '4 days'),
  (current_setting('test.note_fk_cascade_log_n3')::uuid, current_setting('test.note_fk_cascade_note_nchild2')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 2, now() + interval '5 days'),
  (current_setting('test.note_fk_cascade_log_n4')::uuid, current_setting('test.note_fk_cascade_note_nchild2')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 3, now() + interval '6 days'),
  (current_setting('test.note_fk_cascade_log_other')::uuid, current_setting('test.note_fk_cascade_other_note')::uuid, current_setting('test.note_fk_cascade_user_a')::uuid, 1, now() + interval '5 days'),
  (current_setting('test.user_fk_ref_log_a1')::uuid, current_setting('test.user_fk_ref_note_a1')::uuid, current_setting('test.user_fk_ref_user_a')::uuid, 1, now() + interval '6 days'),
  (current_setting('test.user_fk_cascade_log_1a')::uuid, current_setting('test.user_fk_cascade_note_1child')::uuid, current_setting('test.user_fk_cascade_user_1child')::uuid, 1, now() + interval '7 days'),
  (current_setting('test.user_fk_cascade_log_n1')::uuid, current_setting('test.user_fk_cascade_note_n1')::uuid, current_setting('test.user_fk_cascade_user_nchild')::uuid, 2, now() + interval '8 days'),
  (current_setting('test.user_fk_cascade_log_n2')::uuid, current_setting('test.user_fk_cascade_note_n2')::uuid, current_setting('test.user_fk_cascade_user_nchild')::uuid, 3, now() + interval '9 days'),
  (current_setting('test.user_fk_cascade_log_n3')::uuid, current_setting('test.user_fk_cascade_note_n3')::uuid, current_setting('test.user_fk_cascade_user_nchild2')::uuid, 2, now() + interval '10 days'),
  (current_setting('test.user_fk_cascade_log_n4')::uuid, current_setting('test.user_fk_cascade_note_n4')::uuid, current_setting('test.user_fk_cascade_user_nchild2')::uuid, 3, now() + interval '11 days'),
  (current_setting('test.user_fk_cascade_log_other')::uuid, current_setting('test.user_fk_cascade_note_other')::uuid, current_setting('test.user_fk_cascade_user_other')::uuid, 1, now() + interval '10 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 정책 1: FK — note_id 참조 무결성
-- =====================================================================

-- [정답 조건]
-- 존재하는 note_id를 참조하는 review_logs는 생성될 수 있어야 한다
SAVEPOINT note_fk_ref_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '11 days');
    $sql$,
    current_setting('test.note_fk_ref_insert_id'),
    current_setting('test.note_fk_ref_note_a1'),
    current_setting('test.note_fk_ref_user_a')
  ),
  $$존재하는 note_id를 참조하는 review_logs는 생성될 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_ref_insert_valid;

-- 존재하는 note_id를 유지한 상태에서 review_logs의 다른 유효 컬럼 변경은 허용되어야 한다
SAVEPOINT note_fk_ref_update_other_column;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = 2
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_fk_ref_log_a1')
  ),
  $$존재하는 note_id를 유지한 상태에서 review_logs의 다른 유효 컬럼 변경은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_ref_update_other_column;

-- [예외 조건]
-- 존재하지 않는 note_id를 참조하는 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '12 days');
    $sql$,
    current_setting('test.note_fk_ref_bogus_note_id'),
    current_setting('test.note_fk_ref_user_a')
  ),
  '23503',
  NULL,
  $$존재하지 않는 note_id를 참조하는 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 review_logs의 note_id를 존재하지 않는 값으로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET note_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_fk_ref_bogus_note_id'),
    current_setting('test.note_fk_ref_log_a1')
  ),
  '23503',
  NULL,
  $$기존 review_logs의 note_id를 존재하지 않는 값으로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 방금 생성한 note_id를 참조하는 review_logs INSERT는 성공해야 한다
SAVEPOINT note_fk_ref_insert_new_note;
INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES (
  current_setting('test.note_fk_ref_temp_note_id')::uuid,
  current_setting('test.note_fk_ref_user_a')::uuid,
  'note fk ref created',
  'content',
  0
);

SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '13 days');
    $sql$,
    current_setting('test.note_fk_ref_temp_note_id'),
    current_setting('test.note_fk_ref_user_a')
  ),
  $$방금 생성한 note_id를 참조하는 review_logs INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_ref_insert_new_note;

-- 부모 note 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 note_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다
SAVEPOINT note_fk_ref_insert_after_delete;
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_ref_note_a1')::uuid;

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '14 days');
    $sql$,
    current_setting('test.note_fk_ref_note_a1'),
    current_setting('test.note_fk_ref_user_a')
  ),
  '23503',
  NULL,
  $$부모 note 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 note_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_ref_insert_after_delete;

-- note_id 외 다른 컬럼만 변경하는 UPDATE는 note_id FK 자체 때문에 거부되면 안 된다
SAVEPOINT note_fk_ref_update_other_column_boundary;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET scheduled_at = now() + interval '30 days'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_fk_ref_log_a1')
  ),
  $$note_id 외 다른 컬럼만 변경하는 UPDATE는 note_id FK 자체 때문에 거부되면 안 된다$$
);
ROLLBACK TO SAVEPOINT note_fk_ref_update_other_column_boundary;

-- [불변 조건]
-- review_logs 테이블에는 public.notes에 대응 행이 없는 orphan note_id가 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*)
   FROM public.review_logs rl
   LEFT JOIN public.notes n ON n.id = rl.note_id
   WHERE n.id IS NULL),
  0::bigint,
  $$review_logs 테이블에는 public.notes에 대응 행이 없는 orphan note_id가 존재해서는 안 된다 (Status)$$
);

-- =====================================================================
-- 정책 2: FK — note_id 부모 삭제 시 cascade
-- =====================================================================

-- [정답 조건]
-- review_logs를 참조하는 부모 note를 삭제하면 그 note의 review_logs도 함께 삭제되어야 한다
SAVEPOINT note_fk_cascade_delete_parent;
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_1child')::uuid),
  0::bigint,
  $$review_logs를 참조하는 부모 note를 삭제하면 그 note의 review_logs도 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_delete_parent;

-- review_logs를 참조하지 않는 부모 note를 삭제해도 성공해야 한다
SAVEPOINT note_fk_cascade_delete_no_child;
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM public.notes WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_fk_cascade_note_0child')
  ),
  $$review_logs를 참조하지 않는 부모 note를 삭제해도 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_delete_no_child;

-- [예외 조건]
-- 없음 (이 정책은 잘못된 입력을 거부하는 정책이 아니라 부모 삭제 시 자식을 자동 삭제하는 정책이다)
SELECT ok(
  true,
  $$없음 (이 정책은 잘못된 입력을 거부하는 정책이 아니라 부모 삭제 시 자식을 자동 삭제하는 정책이다)$$
);

-- [경계 조건]
-- 자식 review_logs가 1개인 note 삭제 시 정확히 그 1개가 함께 삭제되어야 한다
SAVEPOINT note_fk_cascade_boundary_one;
SELECT set_config(
  'test.note_fk_cascade_one_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_1child')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_1child')::uuid),
  0::bigint,
  $$자식 review_logs가 1개인 note 삭제 시 정확히 그 1개가 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_boundary_one;

-- 자식 review_logs가 여러 개인 note 삭제 시 해당 자식들이 모두 함께 삭제되어야 한다
SAVEPOINT note_fk_cascade_boundary_many;
SELECT set_config(
  'test.note_fk_cascade_many_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_nchild')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_nchild')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_nchild')::uuid),
  0::bigint,
  $$자식 review_logs가 여러 개인 note 삭제 시 해당 자식들이 모두 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_boundary_many;

-- 자식 review_logs가 0개인 note 삭제 시 오류 없이 성공해야 한다
SAVEPOINT note_fk_cascade_boundary_zero;
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM public.notes WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.note_fk_cascade_note_0child')
  ),
  $$자식 review_logs가 0개인 note 삭제 시 오류 없이 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_boundary_zero;

-- 부모 note 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 note_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다
SAVEPOINT note_fk_cascade_boundary_insert_after_delete;
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '15 days');
    $sql$,
    current_setting('test.note_fk_cascade_insert_id'),
    current_setting('test.note_fk_cascade_note_1child'),
    current_setting('test.note_fk_cascade_user_a')
  ),
  '23503',
  NULL,
  $$부모 note 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 note_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_boundary_insert_after_delete;

-- 비교용 다른 note를 참조하는 review_logs는 부모 note 삭제의 영향 대상이 아니어야 한다
SAVEPOINT note_fk_cascade_boundary_other;
SELECT set_config(
  'test.note_fk_cascade_other_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_other_note')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_other_note')::uuid),
  current_setting('test.note_fk_cascade_other_before')::bigint,
  $$비교용 다른 note를 참조하는 review_logs는 부모 note 삭제의 영향 대상이 아니어야 한다$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_boundary_other;

-- [불변 조건]
-- 삭제 전 대상 note_id를 참조하는 review_logs 개수를 Snapshot으로 저장한 뒤, 부모 note 삭제 후 그 개수는 0이어야 한다 (Transition)
SAVEPOINT note_fk_cascade_invariant_snapshot;
SELECT set_config(
  'test.note_fk_cascade_snapshot_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_nchild2')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_nchild2')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_nchild2')::uuid),
  0::bigint,
  $$삭제 전 대상 note_id를 참조하는 review_logs 개수를 Snapshot으로 저장한 뒤, 부모 note 삭제 후 그 개수는 0이어야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_invariant_snapshot;

-- 삭제 전 0개였던 note_id는 부모 삭제 후에도 review_logs 0개 상태여야 한다 (Transition)
SAVEPOINT note_fk_cascade_invariant_zero;
SELECT set_config(
  'test.note_fk_cascade_zero_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_0child')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_0child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_0child')::uuid),
  0::bigint,
  $$삭제 전 0개였던 note_id는 부모 삭제 후에도 review_logs 0개 상태여야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_invariant_zero;

-- 하나의 note 삭제는 그 note_id를 참조하지 않던 다른 review_logs 행 개수에 영향을 주지 않아야 한다 (Transition)
SAVEPOINT note_fk_cascade_invariant_other;
SELECT set_config(
  'test.note_fk_cascade_other_count_before',
  (SELECT count(*)::text FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_other_note')::uuid),
  true
);
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_other_note')::uuid),
  current_setting('test.note_fk_cascade_other_count_before')::bigint,
  $$하나의 note 삭제는 그 note_id를 참조하지 않던 다른 review_logs 행 개수에 영향을 주지 않아야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_invariant_other;

-- 삭제된 notes.id를 참조하는 review_logs는 존재해서는 안 된다 (Status)
SAVEPOINT note_fk_cascade_invariant_status;
DELETE FROM public.notes WHERE id = current_setting('test.note_fk_cascade_note_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE note_id = current_setting('test.note_fk_cascade_note_1child')::uuid),
  0::bigint,
  $$삭제된 notes.id를 참조하는 review_logs는 존재해서는 안 된다 (Status)$$
);
ROLLBACK TO SAVEPOINT note_fk_cascade_invariant_status;

-- =====================================================================
-- 정책 3: FK — user_id 참조 무결성
-- =====================================================================

-- [정답 조건]
-- 존재하는 auth.users.id를 user_id로 사용하는 review_logs는 생성될 수 있어야 한다
SAVEPOINT user_fk_ref_insert_valid;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '16 days');
    $sql$,
    current_setting('test.user_fk_ref_insert_id'),
    current_setting('test.user_fk_ref_note_a1'),
    current_setting('test.user_fk_ref_user_a')
  ),
  $$존재하는 auth.users.id를 user_id로 사용하는 review_logs는 생성될 수 있어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_ref_insert_valid;

-- 존재하는 user_id를 유지한 상태에서 review_logs의 다른 유효 컬럼 변경은 허용되어야 한다
SAVEPOINT user_fk_ref_update_other_column;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET round = 2
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_fk_ref_log_a1')
  ),
  $$존재하는 user_id를 유지한 상태에서 review_logs의 다른 유효 컬럼 변경은 허용되어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_ref_update_other_column;

-- [예외 조건]
-- 존재하지 않는 user_id를 참조하는 review_logs는 생성될 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '17 days');
    $sql$,
    current_setting('test.user_fk_ref_note_a1'),
    current_setting('test.user_fk_ref_bogus_user_id')
  ),
  '23503',
  NULL,
  $$존재하지 않는 user_id를 참조하는 review_logs는 생성될 수 없어야 한다$$
);

-- 기존 review_logs의 user_id를 존재하지 않는 값으로 변경할 수 없어야 한다
SELECT throws_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET user_id = '%s'::uuid
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_fk_ref_bogus_user_id'),
    current_setting('test.user_fk_ref_log_a1')
  ),
  '23503',
  NULL,
  $$기존 review_logs의 user_id를 존재하지 않는 값으로 변경할 수 없어야 한다$$
);

-- [경계 조건]
-- 방금 생성한 user_id를 참조하는 review_logs INSERT는 성공해야 한다
SAVEPOINT user_fk_ref_insert_new_user;
SELECT set_config('test.user_fk_ref_temp_user_id', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.user_fk_ref_temp_user_id')::uuid,
  'test.user_fk_ref_temp_' || current_setting('test.user_fk_ref_temp_user_id') || '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
SELECT lives_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '18 days');
    $sql$,
    current_setting('test.user_fk_ref_note_a1'),
    current_setting('test.user_fk_ref_temp_user_id')
  ),
  $$방금 생성한 user_id를 참조하는 review_logs INSERT는 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_ref_insert_new_user;

-- 부모 user 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 user_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다
SAVEPOINT user_fk_ref_insert_after_delete;
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_ref_user_a')::uuid;
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES (gen_random_uuid(), '%s'::uuid, '%s'::uuid, 1, now() + interval '19 days');
    $sql$,
    current_setting('test.user_fk_ref_note_b1'),
    current_setting('test.user_fk_ref_user_a')
  ),
  '23503',
  NULL,
  $$부모 user 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 user_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_ref_insert_after_delete;

-- user_id 외 다른 컬럼만 변경하는 UPDATE는 user_id FK 자체 때문에 거부되면 안 된다
SAVEPOINT user_fk_ref_update_other_column_boundary;
SELECT lives_ok(
  format(
    $sql$
      UPDATE public.review_logs
      SET scheduled_at = now() + interval '40 days'
      WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_fk_ref_log_a1')
  ),
  $$user_id 외 다른 컬럼만 변경하는 UPDATE는 user_id FK 자체 때문에 거부되면 안 된다$$
);
ROLLBACK TO SAVEPOINT user_fk_ref_update_other_column_boundary;

-- [불변 조건]
-- review_logs 테이블에는 auth.users에 대응 행이 없는 orphan user_id가 존재해서는 안 된다 (Status)
SELECT is(
  (SELECT count(*)
   FROM public.review_logs rl
   LEFT JOIN auth.users u ON u.id = rl.user_id
   WHERE u.id IS NULL),
  0::bigint,
  $$review_logs 테이블에는 auth.users에 대응 행이 없는 orphan user_id가 존재해서는 안 된다 (Status)$$
);

-- =====================================================================
-- 정책 4: FK — user_id 부모 삭제 시 cascade
-- =====================================================================

-- [정답 조건]
-- review_logs를 참조하는 부모 user를 삭제하면 그 user의 review_logs도 함께 삭제되어야 한다
SAVEPOINT user_fk_cascade_delete_parent;
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_1child')::uuid),
  0::bigint,
  $$review_logs를 참조하는 부모 user를 삭제하면 그 user의 review_logs도 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_delete_parent;

-- review_logs가 없는 부모 user를 삭제해도 성공해야 한다
SAVEPOINT user_fk_cascade_delete_no_child;
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM auth.users WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_fk_cascade_user_0child')
  ),
  $$review_logs가 없는 부모 user를 삭제해도 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_delete_no_child;

-- [예외 조건]
-- 없음 (이 정책은 잘못된 입력을 거부하는 정책이 아니라 부모 삭제 시 자식을 자동 삭제하는 정책이다)
SELECT ok(
  true,
  $$없음 (이 정책은 잘못된 입력을 거부하는 정책이 아니라 부모 삭제 시 자식을 자동 삭제하는 정책이다)$$
);

-- [경계 조건]
-- 자식 review_logs가 1개인 user 삭제 시 정확히 그 1개가 함께 삭제되어야 한다
SAVEPOINT user_fk_cascade_boundary_one;
SELECT set_config(
  'test.user_fk_cascade_one_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_1child')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_1child')::uuid),
  0::bigint,
  $$자식 review_logs가 1개인 user 삭제 시 정확히 그 1개가 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_boundary_one;

-- 자식 review_logs가 여러 개인 user 삭제 시 해당 자식들이 모두 함께 삭제되어야 한다
SAVEPOINT user_fk_cascade_boundary_many;
SELECT set_config(
  'test.user_fk_cascade_many_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_nchild')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_nchild')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_nchild')::uuid),
  0::bigint,
  $$자식 review_logs가 여러 개인 user 삭제 시 해당 자식들이 모두 함께 삭제되어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_boundary_many;

-- 자식 review_logs가 0개인 user 삭제 시 오류 없이 성공해야 한다
SAVEPOINT user_fk_cascade_boundary_zero;
SELECT lives_ok(
  format(
    $sql$
      DELETE FROM auth.users WHERE id = '%s'::uuid;
    $sql$,
    current_setting('test.user_fk_cascade_user_0child')
  ),
  $$자식 review_logs가 0개인 user 삭제 시 오류 없이 성공해야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_boundary_zero;

-- 부모 user 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 user_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다
SAVEPOINT user_fk_cascade_boundary_insert_after_delete;
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.review_logs (id, note_id, user_id, round, scheduled_at)
      VALUES ('%s'::uuid, '%s'::uuid, '%s'::uuid, 1, now() + interval '20 days');
    $sql$,
    current_setting('test.user_fk_cascade_insert_id'),
    current_setting('test.user_fk_cascade_note_other'),
    current_setting('test.user_fk_cascade_user_1child')
  ),
  '23503',
  NULL,
  $$부모 user 삭제 직후, 같은 실행 컨텍스트에서 그 삭제된 user_id를 참조하는 review_logs INSERT는 허용되지 않아야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_boundary_insert_after_delete;

-- 비교용 다른 user의 review_logs는 부모 user 삭제의 영향 대상이 아니어야 한다
SAVEPOINT user_fk_cascade_boundary_other;
SELECT set_config(
  'test.user_fk_cascade_other_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_other')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_other')::uuid),
  current_setting('test.user_fk_cascade_other_before')::bigint,
  $$비교용 다른 user의 review_logs는 부모 user 삭제의 영향 대상이 아니어야 한다$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_boundary_other;

-- [불변 조건]
-- 삭제 전 대상 user_id를 참조하는 review_logs 개수를 Snapshot으로 저장한 뒤, 부모 user 삭제 후 그 개수는 0이어야 한다 (Transition)
SAVEPOINT user_fk_cascade_invariant_snapshot;
SELECT set_config(
  'test.user_fk_cascade_snapshot_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_nchild2')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_nchild2')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_nchild2')::uuid),
  0::bigint,
  $$삭제 전 대상 user_id를 참조하는 review_logs 개수를 Snapshot으로 저장한 뒤, 부모 user 삭제 후 그 개수는 0이어야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_invariant_snapshot;

-- 삭제 전 0개였던 user_id는 부모 삭제 후에도 review_logs 0개 상태여야 한다 (Transition)
SAVEPOINT user_fk_cascade_invariant_zero;
SELECT set_config(
  'test.user_fk_cascade_zero_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_0child')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_0child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_0child')::uuid),
  0::bigint,
  $$삭제 전 0개였던 user_id는 부모 삭제 후에도 review_logs 0개 상태여야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_invariant_zero;

-- 하나의 user 삭제는 다른 user_id를 참조하던 review_logs 행 개수에 영향을 주지 않아야 한다 (Transition)
SAVEPOINT user_fk_cascade_invariant_other;
SELECT set_config(
  'test.user_fk_cascade_other_count_before',
  (SELECT count(*)::text FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_other')::uuid),
  true
);
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_other')::uuid),
  current_setting('test.user_fk_cascade_other_count_before')::bigint,
  $$하나의 user 삭제는 다른 user_id를 참조하던 review_logs 행 개수에 영향을 주지 않아야 한다 (Transition)$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_invariant_other;

-- 삭제된 auth.users.id를 참조하는 review_logs는 존재해서는 안 된다 (Status)
SAVEPOINT user_fk_cascade_invariant_status;
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*) FROM public.review_logs WHERE user_id = current_setting('test.user_fk_cascade_user_1child')::uuid),
  0::bigint,
  $$삭제된 auth.users.id를 참조하는 review_logs는 존재해서는 안 된다 (Status)$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_invariant_status;

-- 부모 user 삭제 이후에도 review_logs에는 부모 user나 중간 부모 note가 없는 고아 행이 존재해서는 안 된다 (Deep Status)
SAVEPOINT user_fk_cascade_invariant_deep_status;
DELETE FROM auth.users WHERE id = current_setting('test.user_fk_cascade_user_1child')::uuid;
SELECT is(
  (SELECT count(*)
   FROM public.review_logs rl
   WHERE NOT EXISTS (
           SELECT 1
           FROM auth.users u
           WHERE u.id = rl.user_id
         )
      OR NOT EXISTS (
           SELECT 1
           FROM public.notes n
           WHERE n.id = rl.note_id
         )),
  0::bigint,
  $$부모 user 삭제 이후에도 review_logs에는 부모 user나 중간 부모 note가 없는 고아 행이 존재해서는 안 된다 (Deep Status)$$
);
ROLLBACK TO SAVEPOINT user_fk_cascade_invariant_deep_status;

SELECT * FROM finish();
ROLLBACK;
