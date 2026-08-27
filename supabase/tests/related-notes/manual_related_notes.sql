-- =========================================
-- related-notes / manual related notes
-- =========================================

BEGIN;

-- add_note_related_manual RPC의 핵심 계약만 검증합니다.
--
-- 1. 여러 Related Notes를 한 번에 추가할 수 있어야 합니다.
-- 2. 각 Related Note는 서로 다른 선택적 reason을 가질 수 있어야 합니다.
-- 3. 기존 AI 관계를 사용자가 직접 추가하면 manual + active로 전환해야 합니다.
-- 4. 자기 자신을 Related Note로 연결할 수 없어야 합니다.
-- 5. 잘못된 입력은 조건별 SQLSTATE로 구분해야 합니다.
-- 6. 다른 사용자의 Note를 Related Note로 연결할 수 없어야 합니다.
SELECT plan(20);


-- ============================================================================
-- Test fixtures
-- ============================================================================

SELECT set_config(
  'test.related_manual_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_other_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_source_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_reason_target_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_no_reason_target_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_ai_target_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_reverse_ai_target_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.related_manual_other_target_id',
  gen_random_uuid()::text,
  true
);


-- 테스트는 seed 데이터에 의존하지 않고 전용 사용자를 직접 생성합니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data
)
VALUES
  (
    current_setting('test.related_manual_user_id')::uuid,
    'related_manual_'
      || current_setting('test.related_manual_user_id')
      || '@example.com',
    now(),
    '{}'::jsonb
  ),
  (
    current_setting('test.related_manual_other_user_id')::uuid,
    'related_manual_other_'
      || current_setting('test.related_manual_other_user_id')
      || '@example.com',
    now(),
    '{}'::jsonb
  );


-- 기준 Note와 같은 사용자의 Related Note 후보를 준비합니다.
--
-- other target만 다른 사용자의 Note로 생성하여
-- RPC의 target 소유권 검증에 사용합니다.
INSERT INTO public.notes (
  id,
  user_id,
  title,
  content
)
VALUES
  (
    current_setting('test.related_manual_source_id')::uuid,
    current_setting('test.related_manual_user_id')::uuid,
    'Manual Related Source',
    'source content'
  ),
  (
    current_setting('test.related_manual_reason_target_id')::uuid,
    current_setting('test.related_manual_user_id')::uuid,
    'Manual Related With Reason',
    'target content'
  ),
  (
    current_setting('test.related_manual_no_reason_target_id')::uuid,
    current_setting('test.related_manual_user_id')::uuid,
    'Manual Related Without Reason',
    'target content'
  ),
  (
    current_setting('test.related_manual_ai_target_id')::uuid,
    current_setting('test.related_manual_user_id')::uuid,
    'Existing AI Related Note',
    'target content'
  ),
  (
    current_setting('test.related_manual_reverse_ai_target_id')::uuid,
    current_setting('test.related_manual_user_id')::uuid,
    'Existing Reverse AI Related Note',
    'target content'
  ),
  (
    current_setting('test.related_manual_other_target_id')::uuid,
    current_setting('test.related_manual_other_user_id')::uuid,
    'Other User Related Note',
    'other user content'
  );


-- AI 추천을 사용자가 직접 다시 연결하는 상황을 검증하기 위해
-- 기존 dismissed AI 관계를 하나 준비합니다.
INSERT INTO public.note_related_notes (
  note_id,
  related_note_id,
  origin,
  status,
  metadata
)
VALUES (
  current_setting('test.related_manual_source_id')::uuid,
  current_setting('test.related_manual_ai_target_id')::uuid,
  'ai',
  'dismissed',
  jsonb_build_object(
    'title',
    'Existing AI Related Note',
    'reason',
    'old ai reason'
  )
);

INSERT INTO public.note_related_notes (
  note_id,
  related_note_id,
  origin,
  status,
  metadata
)
VALUES (
  current_setting('test.related_manual_reverse_ai_target_id')::uuid,
  current_setting('test.related_manual_source_id')::uuid,
  'ai',
  'dismissed',
  jsonb_build_object(
    'title',
    'Manual Related Source',
    'reason',
    'old reverse ai reason'
  )
);

-- ============================================================================
-- Function permissions
-- ============================================================================

/*
 * manual Related Note 추가 RPC는 로그인한 사용자의 요청에서 실행되어야 하므로
 * authenticated 역할에는 EXECUTE 권한이 있어야 합니다.
 *
 * 함수 내부에서는 SECURITY DEFINER와 auth.uid()를 사용하여
 * 실제 사용자와 source/target Note 소유권을 별도로 검증합니다.
 */
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.add_note_related_manual(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated should execute add_note_related_manual()'
);

/*
 * 인증되지 않은 사용자는 manual Related Note를 추가할 수 없으므로
 * anon 역할에는 RPC 실행 권한이 없어야 합니다.
 */
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.add_note_related_manual(uuid,jsonb)',
    'EXECUTE'
  ),
  'anon should not execute add_note_related_manual()'
);


-- ============================================================================
-- Authenticated user
-- ============================================================================

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('test.related_manual_user_id'),
    'role', 'authenticated'
  )::text,
  true
);


-- ============================================================================
-- 1. Add multiple manual related notes
-- ============================================================================

-- 여러 Related Notes를 한 번의 RPC 호출로 추가할 수 있어야 합니다.
--
-- 첫 번째 Note에는 reason을 전달하고,
-- 두 번째 Note에는 reason을 전달하지 않아
-- 각 Note별 optional reason 저장 계약도 함께 검증합니다.
SELECT lives_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s',
            'reason',
            '같이 참고하기 위해 연결합니다.'
          ),
          jsonb_build_object(
            'relatedNoteId',
            '%s'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_reason_target_id'),
    current_setting('test.related_manual_no_reason_target_id')
  ),
  'multiple manual related notes should be added'
);


-- reason이 있는 첫 번째 관계는 manual + active 상태여야 합니다.
SELECT ok(
  (
    SELECT
      origin = 'manual'
      AND status = 'active'
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_reason_target_id')::uuid
  ),
  'manual related note with reason should be stored as manual and active'
);


-- title은 metadata에 snapshot으로 저장하지 않고,
-- 해당 Note에 입력한 reason만 metadata에 저장해야 합니다.
SELECT is(
  (
    SELECT metadata
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_reason_target_id')::uuid
  ),
  jsonb_build_object(
    'reason',
    '같이 참고하기 위해 연결합니다.'
  ),
  'manual related note metadata should contain only its reason'
);


-- 같은 RPC에서 추가된 reason 없는 Note도 manual + active 상태여야 합니다.
SELECT ok(
  (
    SELECT
      origin = 'manual'
      AND status = 'active'
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_no_reason_target_id')::uuid
  ),
  'manual related note without reason should be stored as manual and active'
);


-- reason이 없는 Note의 metadata에는 title snapshot이나 null reason을 남기지 않고
-- 빈 JSON object만 저장해야 합니다.
SELECT is(
  (
    SELECT metadata
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_no_reason_target_id')::uuid
  ),
  '{}'::jsonb,
  'manual related note without reason should store empty metadata'
);


-- ============================================================================
-- 2. Existing AI relation -> manual active
-- ============================================================================

-- 동일한 관계가 이미 AI dismissed 상태로 존재하더라도
-- 사용자가 직접 연결하면 중복 row를 만들지 않고 manual 관계로 전환해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s',
            'reason',
            '직접 연결한 이유'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_ai_target_id')
  ),
  'existing AI relation should be convertible to manual relation'
);


SELECT ok(
  (
    SELECT
      count(*) = 1
      AND bool_and(origin = 'manual')
      AND bool_and(status = 'active')
      AND bool_and(
        metadata = jsonb_build_object(
          'reason',
          '직접 연결한 이유'
        )
      )
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_ai_target_id')::uuid
  ),
  'existing AI relation should become one active manual relation'
);


-- ============================================================================
-- 3. Existing reverse AI relation -> manual active
-- ============================================================================

-- 동일한 관계가 반대 방향 AI dismissed 상태로 존재하더라도
-- 사용자가 직접 연결하면 중복 row를 만들지 않고 기존 row를 전환해야 합니다.
SELECT lives_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s',
            'reason',
            '역방향 관계를 직접 연결'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_reverse_ai_target_id')
  ),
  'existing reverse AI relation should be convertible to manual relation'
);

SELECT ok(
  (
    SELECT
      count(*) = 1
      AND bool_and(origin = 'manual')
      AND bool_and(status = 'active')
      AND bool_and(
        metadata = jsonb_build_object(
          'reason',
          '역방향 관계를 직접 연결'
        )
      )
    FROM public.note_related_notes
    WHERE least(note_id, related_note_id) =
        least(
          current_setting('test.related_manual_source_id')::uuid,
          current_setting('test.related_manual_reverse_ai_target_id')::uuid
        )
      AND greatest(note_id, related_note_id) =
        greatest(
          current_setting('test.related_manual_source_id')::uuid,
          current_setting('test.related_manual_reverse_ai_target_id')::uuid
        )
  ),
  'existing reverse AI relation should become one active manual relation'
);


-- ============================================================================
-- 4. Self relation rejection
-- ============================================================================

-- 현재 Note 자신이 Related Notes 입력 배열에 포함되면
-- 전체 요청을 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_source_id')
  ),
  'WP007',
  NULL,
  'a note should not be related to itself'
);


-- 실패한 자기 참조 관계가 DB에 남아 있지 않아야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_source_id')::uuid
  ),
  0::bigint,
  'self relation rejection should not create a row'
);


-- ============================================================================
-- 5. Invalid manual input SQLSTATEs
-- ============================================================================

-- 빈 배열은 전용 SQLSTATE로 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        '[]'::jsonb
      );
    $sql$,
    current_setting('test.related_manual_source_id')
  ),
  'WP004',
  NULL,
  'empty related notes should use target required SQLSTATE'
);


-- relatedNoteId가 UUID 형식이 아니면 전용 SQLSTATE로 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            'not-a-uuid'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id')
  ),
  'WP005',
  NULL,
  'invalid related note id should use target invalid SQLSTATE'
);


-- 동일한 target이 한 요청에 중복되면 전용 SQLSTATE로 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s'
          ),
          jsonb_build_object(
            'relatedNoteId',
            '%s'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_reason_target_id'),
    current_setting('test.related_manual_reason_target_id')
  ),
  'WP006',
  NULL,
  'duplicated related note id should use duplicated SQLSTATE'
);


-- reason 길이가 500자를 초과하면 전용 SQLSTATE로 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s',
            'reason',
            repeat('a', 501)
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_reason_target_id')
  ),
  'WP008',
  NULL,
  'too long reason should use reason too long SQLSTATE'
);


-- 한 번에 10개를 초과하는 target은 RPC 레벨에서 전용 SQLSTATE로 거부해야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'relatedNoteId',
              '%s'
            )
          )
          FROM generate_series(1, 11)
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_reason_target_id')
  ),
  'WP009',
  NULL,
  'too many related notes should use target too many SQLSTATE'
);


-- ============================================================================
-- 6. Other user's target rejection
-- ============================================================================

-- 인증 사용자가 다른 사용자의 Note ID를 배열에 전달하더라도
-- Related Note 관계를 만들 수 없어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.add_note_related_manual(
        '%s'::uuid,
        jsonb_build_array(
          jsonb_build_object(
            'relatedNoteId',
            '%s'
          )
        )
      );
    $sql$,
    current_setting('test.related_manual_source_id'),
    current_setting('test.related_manual_other_target_id')
  ),
  'P0002',
  NULL,
  'another user note should not be accepted as a manual related note'
);


-- 소유권 검증 실패 후에도 관계 row가 생성되지 않아야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_other_target_id')::uuid
  ),
  0::bigint,
  'other user target rejection should not create a row'
);


SELECT * FROM finish();

ROLLBACK;
