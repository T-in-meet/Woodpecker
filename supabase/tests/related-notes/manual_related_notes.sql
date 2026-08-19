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
-- 5. 다른 사용자의 Note를 Related Note로 연결할 수 없어야 합니다.
SELECT plan(13);


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


-- title은 Client 입력이 아니라 대상 Note의 현재 title snapshot을 사용하고,
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
    'title',
    'Manual Related With Reason',
    'reason',
    '같이 참고하기 위해 연결합니다.'
  ),
  'manual related note metadata should contain its target title and reason'
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


-- reason이 없는 Note의 metadata에는 불필요한 null reason을 남기지 않고
-- 화면 표시에 필요한 title snapshot만 저장해야 합니다.
SELECT is(
  (
    SELECT metadata
    FROM public.note_related_notes
    WHERE note_id =
      current_setting('test.related_manual_source_id')::uuid
      AND related_note_id =
        current_setting('test.related_manual_no_reason_target_id')::uuid
  ),
  jsonb_build_object(
    'title',
    'Manual Related Without Reason'
  ),
  'manual related note without reason should store only its target title'
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
          'title',
          'Existing AI Related Note',
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
-- 3. Self relation rejection
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
  '22023',
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
-- 4. Other user's target rejection
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