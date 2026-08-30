BEGIN;

SELECT plan(25);


-- ============================================================================
-- Test Fixtures
-- ============================================================================
--
-- Related Notes execution claim의 주요 정책을 검증하기 위한 사용자, Note,
-- Claim 식별자를 테스트별로 분리해서 준비합니다.
--
-- 주요 검증 대상:
--   - 동일 Note version의 중복 실행 방지
--   - failed Claim 이후 재실행 허용
--   - succeeded Claim 이후 동일 version 재실행 차단
--   - 오래된 running Claim의 stale 처리
--   - 사용자별 Note 단위 일일 실행 제한
--   - ADMIN의 일일 실행 제한 우회
--   - 이메일 미인증 사용자 실행 차단
--

SELECT set_config('test.related_note_claims_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_admin_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_unverified_user_id', gen_random_uuid()::text, true);

SELECT set_config('test.related_note_claims_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_other_note_id', gen_random_uuid()::text, true);

-- 같은 사용자의 다른 Note가 일일 quota를 독립적으로 사용하는지 검증합니다.
SELECT set_config('test.related_note_claims_quota_other_note_id', gen_random_uuid()::text, true);

-- failed / stale Claim이 일일 quota를 소비하지 않는지 검증합니다.
SELECT set_config('test.related_note_claims_excluded_quota_note_id', gen_random_uuid()::text, true);

SELECT set_config('test.related_note_claims_admin_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_unverified_note_id', gen_random_uuid()::text, true);

-- 3분 미만의 running Claim은 실제 실행 중일 수 있으므로 유지되는지 검증합니다.
SELECT set_config('test.related_note_claims_recent_running_note_id', gen_random_uuid()::text, true);

-- 이전 Note version에 남은 3분 초과 running Claim의 stale 처리를 검증합니다.
SELECT set_config('test.related_note_claims_expired_running_note_id', gen_random_uuid()::text, true);

-- succeeded Claim은 오래되더라도 stale 처리되지 않는지 검증합니다.
SELECT set_config('test.related_note_claims_old_succeeded_note_id', gen_random_uuid()::text, true);

SELECT set_config('test.related_note_claims_recent_running_claim_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_expired_running_claim_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_old_succeeded_claim_id', gen_random_uuid()::text, true);


-- ============================================================================
-- Users
-- ============================================================================
--
-- 일반 사용자, 다른 사용자, ADMIN, 이메일 미인증 사용자를 준비합니다.
--

INSERT INTO auth.users (
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data
)
VALUES
    (
        current_setting('test.related_note_claims_user_id')::uuid,
        'related-note-claims@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_claims_other_user_id')::uuid,
        'related-note-claims-other@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_claims_admin_user_id')::uuid,
        'related-note-claims-admin@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_claims_unverified_user_id')::uuid,
        'related-note-claims-unverified@example.com',
        NULL,
        '{}'::jsonb
    );


-- ============================================================================
-- Notes
-- ============================================================================
--
-- 각 실행 정책이 서로 영향을 주지 않도록 검증 목적별 Note를 분리합니다.
--

INSERT INTO public.notes (
    id,
    user_id,
    title,
    content,
    review_round
)
VALUES
    (
        current_setting('test.related_note_claims_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Source',
        'Related Note Claim Source Content',
        0
    ),
    (
        current_setting('test.related_note_claims_other_note_id')::uuid,
        current_setting('test.related_note_claims_other_user_id')::uuid,
        'Related Note Claim Other',
        'Related Note Claim Other Content',
        0
    ),
    (
        current_setting('test.related_note_claims_quota_other_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Quota Other',
        'Related Note Claim Quota Other Content',
        0
    ),
    (
        current_setting('test.related_note_claims_excluded_quota_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Excluded Quota Statuses',
        'Related Note Claim Excluded Quota Statuses Content',
        0
    ),
    (
        current_setting('test.related_note_claims_admin_note_id')::uuid,
        current_setting('test.related_note_claims_admin_user_id')::uuid,
        'Related Note Claim Admin',
        'Related Note Claim Admin Content',
        0
    ),
    (
        current_setting('test.related_note_claims_unverified_note_id')::uuid,
        current_setting('test.related_note_claims_unverified_user_id')::uuid,
        'Related Note Claim Unverified',
        'Related Note Claim Unverified Content',
        0
    ),
    (
        current_setting('test.related_note_claims_recent_running_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Recent Running',
        'Related Note Claim Recent Running Content',
        0
    ),
    (
        current_setting('test.related_note_claims_expired_running_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Expired Running',
        'Related Note Claim Expired Running Content',
        0
    ),
    (
        current_setting('test.related_note_claims_old_succeeded_note_id')::uuid,
        current_setting('test.related_note_claims_user_id')::uuid,
        'Related Note Claim Old Succeeded',
        'Related Note Claim Old Succeeded Content',
        0
    );

-- ADMIN 사용자는 일반 사용자와 달리 일일 실행 제한을 적용받지 않습니다.
UPDATE public.profiles
SET role = 'ADMIN'
WHERE id = current_setting('test.related_note_claims_admin_user_id')::uuid;


-- ============================================================================
-- Table and permissions
-- ============================================================================
--
-- execution claim 테이블이 생성되어 있는지와,
-- 클라이언트 authenticated 사용자가 Claim RPC를 직접 실행할 수 없는지 검증합니다.
--

SELECT has_table(
    'public',
    'related_note_recommendation_execution_claims',
    'execution claims table should exist'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_claims_user_id'),
        'role',
        'authenticated'
    )::text,
    true
);

-- Claim 생성은 서버의 service_role 경로를 통해서만 수행해야 합니다.
SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_execution(
            current_setting('test.related_note_claims_user_id')::uuid,
            current_setting('test.related_note_claims_note_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_claims_note_id')::uuid
            ),
            10
        );
    $sql$,
    '42501',
    NULL,
    'authenticated should not execute recommendation execution claim RPC'
);


-- ============================================================================
-- Claim behavior
-- ============================================================================
--
-- 여기부터 실제 서버 실행과 동일하게 service_role로 Claim RPC를 호출합니다.
--

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);


-- ----------------------------------------------------------------------------
-- 현재 Note version과 다른 source_updated_at 요청
-- ----------------------------------------------------------------------------
--
-- 실행을 시작하기 전에 전달받은 source_updated_at이 현재 Note의 updated_at과
-- 일치하는지 확인합니다.
--
-- 이미 Note가 수정된 오래된 요청이라면 Claim을 생성하지 않고 stale을 반환해야 합니다.
--

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    '2000-01-01T00:00:00Z'::timestamptz,
    10
)
\gset test_related_note_claims_stale_

SELECT is(
    :'test_related_note_claims_stale_status'::text,
    'stale',
    'stale source should return stale before inserting a claim'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.related_note_recommendation_execution_claims
        WHERE note_id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    0::bigint,
    'pre-claim stale should not insert an execution claim'
);


-- ----------------------------------------------------------------------------
-- 정상적인 첫 Claim
-- ----------------------------------------------------------------------------
--
-- 현재 Note의 updated_at을 사용한 첫 요청은 정상적으로 실행 권한을 획득하고
-- running Claim을 생성해야 합니다.
--

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_first_

SELECT is(
    :'test_related_note_claims_first_status'::text,
    'claimed',
    'fresh source should create an execution claim'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = :'test_related_note_claims_first_claim_id'::uuid
    ),
    'running',
    'new execution claim should be stored as running'
);


-- ----------------------------------------------------------------------------
-- 동일 Note version의 running Claim 중복 방지
-- ----------------------------------------------------------------------------
--
-- 같은 user + note + source_updated_at 조합에서 이미 running Claim이 있다면
-- 동일 Note version의 추천을 다시 시작하지 않고 duplicate를 반환해야 합니다.
--

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_duplicate_

SELECT is(
    :'test_related_note_claims_duplicate_status'::text,
    'duplicate',
    'running same note version should be treated as duplicate'
);


-- ----------------------------------------------------------------------------
-- failed Claim 이후 동일 Note version 재실행
-- ----------------------------------------------------------------------------
--
-- failed는 실행 성공 결과가 아니므로 동일 source version을 다시 실행할 수 있어야 합니다.
--

SELECT is(
    public.complete_related_note_recommendation_execution_claim(
        :'test_related_note_claims_first_claim_id'::uuid,
        'failed'
    ),
    :'test_related_note_claims_first_claim_id'::uuid,
    'execution claim should complete as failed'
);

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_after_failed_

SELECT is(
    :'test_related_note_claims_after_failed_status'::text,
    'claimed',
    'failed same source version should allow a new execution claim'
);


-- ----------------------------------------------------------------------------
-- succeeded Claim 이후 동일 Note version 중복 방지
-- ----------------------------------------------------------------------------
--
-- 성공한 추천 결과가 존재하는 동일 Note version은 다시 실행하지 않습니다.
--

SELECT is(
    public.complete_related_note_recommendation_execution_claim(
        :'test_related_note_claims_after_failed_claim_id'::uuid,
        'succeeded'
    ),
    :'test_related_note_claims_after_failed_claim_id'::uuid,
    'execution claim should complete as succeeded'
);

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_after_succeeded_

SELECT is(
    :'test_related_note_claims_after_succeeded_status'::text,
    'duplicate',
    'succeeded same note version should remain duplicate'
);


-- ============================================================================
-- Running claim timeout behavior
-- ============================================================================
--
-- running Claim의 stale 기준은 3분입니다.
--
-- 최근 Claim은 실제 실행 중일 수 있으므로 유지하고,
-- 기준을 초과한 오래된 Claim만 다음 Claim 요청 시 stale로 종료합니다.
--


-- ----------------------------------------------------------------------------
-- 3분 미만의 running Claim
-- ----------------------------------------------------------------------------
--
-- 2분 전에 시작된 Claim은 아직 정상 실행 중일 가능성이 있으므로
-- stale 처리하지 않고 동일 version 요청을 duplicate로 처리해야 합니다.
--

INSERT INTO public.related_note_recommendation_execution_claims (
    id,
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at
)
VALUES (
    current_setting('test.related_note_claims_recent_running_claim_id')::uuid,
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_recent_running_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_recent_running_note_id')::uuid
    ),
    'running',
    clock_timestamp() - interval '2 minutes'
);

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_recent_running_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_recent_running_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_recent_running_

SELECT is(
    :'test_related_note_claims_recent_running_status'::text,
    'duplicate',
    'recent running claim should still be treated as duplicate'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_recent_running_claim_id')::uuid
    ),
    'running',
    'recent running claim should remain running'
);


-- ----------------------------------------------------------------------------
-- 이전 Note version에 남은 3분 초과 running Claim
-- ----------------------------------------------------------------------------
--
-- 이번 migration에서 stale cleanup 범위를 동일 source version에서
-- 동일 Note 전체로 확장한 정책을 직접 검증합니다.
--
-- 1. 현재 Note version으로 running Claim을 생성합니다.
-- 2. Claim의 claimed_at은 4분 전으로 설정하여 stale 기준을 초과시킵니다.
-- 3. 그 뒤 Note를 수정하여 새로운 source_updated_at을 만듭니다.
-- 4. 새로운 Note version으로 Claim RPC를 호출합니다.
--
-- 이전 구현처럼 stale cleanup에 source_updated_at 조건이 남아 있다면
-- 4번 요청은 이전 version의 running Claim을 정리하지 못합니다.
--
-- 현재 정책에서는 같은 Note에 남은 오래된 running Claim을 version과 관계없이
-- stale로 종료한 뒤 새로운 version의 Claim을 정상적으로 생성해야 합니다.
--

INSERT INTO public.related_note_recommendation_execution_claims (
    id,
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at
)
VALUES (
    current_setting('test.related_note_claims_expired_running_claim_id')::uuid,
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_expired_running_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_expired_running_note_id')::uuid
    ),
    'running',
    clock_timestamp() - interval '4 minutes'
);

-- Note를 수정하여 위 Claim과 현재 Note의 source_updated_at을 다르게 만듭니다.
UPDATE public.notes
SET title = title || ' new version'
WHERE id = current_setting('test.related_note_claims_expired_running_note_id')::uuid;

-- 새로운 Note version으로 실행을 요청합니다.
SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_expired_running_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_expired_running_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_expired_running_

-- 이전 version의 오래된 running Claim이 정리되었으므로
-- 새로운 version은 정상적으로 실행 권한을 획득해야 합니다.
SELECT is(
    :'test_related_note_claims_expired_running_status'::text,
    'claimed',
    'expired running claim from a previous note version should allow a new execution claim'
);

-- 이전 version에 남아 있던 Claim은 stale로 전환되어야 합니다.
SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_expired_running_claim_id')::uuid
    ),
    'stale',
    'expired running claim from a previous note version should be completed as stale'
);

-- terminal 상태인 stale로 변경하면서 완료 시각도 기록되어야 합니다.
SELECT ok(
    (
        SELECT completed_at IS NOT NULL
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_expired_running_claim_id')::uuid
    ),
    'expired running claim from a previous note version should receive completed_at'
);

-- stale cleanup 이후 새로 생성된 현재 version Claim은 running이어야 합니다.
SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = :'test_related_note_claims_expired_running_claim_id'::uuid
    ),
    'running',
    'new claim after cleaning up the previous note version should be running'
);


-- ----------------------------------------------------------------------------
-- 오래된 succeeded Claim
-- ----------------------------------------------------------------------------
--
-- stale cleanup 대상은 오래된 running Claim뿐입니다.
-- succeeded는 이미 정상 완료된 결과이므로 시간이 오래 지났다는 이유로
-- stale로 변경되어서는 안 됩니다.
--

INSERT INTO public.related_note_recommendation_execution_claims (
    id,
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at,
    completed_at
)
VALUES (
    current_setting('test.related_note_claims_old_succeeded_claim_id')::uuid,
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_old_succeeded_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_old_succeeded_note_id')::uuid
    ),
    'succeeded',
    clock_timestamp() - interval '10 minutes',
    clock_timestamp() - interval '9 minutes'
);

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_old_succeeded_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_old_succeeded_note_id')::uuid
    ),
    10
)
\gset test_related_note_claims_old_succeeded_

SELECT is(
    :'test_related_note_claims_old_succeeded_status'::text,
    'duplicate',
    'old succeeded claim should remain duplicate regardless of age'
);

SELECT is(
    :'test_related_note_claims_old_succeeded_claim_id'::uuid,
    current_setting('test.related_note_claims_old_succeeded_claim_id')::uuid,
    'old succeeded duplicate should return the existing claim ID'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_old_succeeded_claim_id')::uuid
    ),
    'succeeded',
    'old succeeded claim should not be converted to stale'
);


-- ============================================================================
-- Daily quota behavior
-- ============================================================================
--
-- 일반 사용자의 일일 실행 제한은 사용자 전체가 아니라
-- user + note 단위로 계산합니다.
--
-- quota에는 running / succeeded Claim만 포함하고,
-- failed / stale Claim은 포함하지 않습니다.
--


-- ----------------------------------------------------------------------------
-- 같은 Note의 quota
-- ----------------------------------------------------------------------------
--
-- 앞에서 동일 Note에 succeeded Claim이 이미 하나 존재합니다.
-- Note를 수정해 새로운 version을 만든 뒤 limit=1로 실행을 요청하면,
-- duplicate가 아니라 Note의 일일 quota에 의해 차단되어야 합니다.
--

UPDATE public.notes
SET title = title || ' quota'
WHERE id = current_setting('test.related_note_claims_note_id')::uuid;

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_note_id')::uuid
    ),
    1
)
\gset test_related_note_claims_limit_

SELECT is(
    :'test_related_note_claims_limit_status'::text,
    'daily_limit_exceeded',
    'daily limit should count running and succeeded execution claims for the same note'
);


-- ----------------------------------------------------------------------------
-- 같은 사용자의 다른 Note는 quota를 공유하지 않음
-- ----------------------------------------------------------------------------
--
-- 바로 위 Note는 이미 limit=1에 도달했지만,
-- quota는 user + note 단위이므로 같은 사용자의 다른 Note에는 영향을 주지 않아야 합니다.
--
-- 만약 quota가 다시 사용자 전체 단위로 변경된다면 이 테스트가 실패합니다.
--

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_quota_other_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_quota_other_note_id')::uuid
    ),
    1
)
\gset test_related_note_claims_quota_other_note_

SELECT is(
    :'test_related_note_claims_quota_other_note_status'::text,
    'claimed',
    'daily execution limit should be scoped independently per note'
);


-- ----------------------------------------------------------------------------
-- failed / stale Claim은 quota를 소비하지 않음
-- ----------------------------------------------------------------------------
--
-- 일일 실행 제한에는 running / succeeded Claim만 포함됩니다.
-- failed / stale Claim은 실행 제어 관점에서 종료된 실행이므로
-- 같은 날 생성되었더라도 quota를 소비하지 않아야 합니다.
--
-- 이 테스트는 failed / stale Claim만 존재하는 Note에 limit=1로 새 실행을 요청합니다.
-- quota 조건에 failed 또는 stale이 잘못 포함되면 daily_limit_exceeded가 반환되어
-- 회귀를 바로 감지할 수 있습니다.
--

INSERT INTO public.related_note_recommendation_execution_claims (
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at,
    completed_at
)
VALUES
    (
        current_setting('test.related_note_claims_user_id')::uuid,
        current_setting('test.related_note_claims_excluded_quota_note_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id = current_setting('test.related_note_claims_excluded_quota_note_id')::uuid
        ) - interval '2 seconds',
        'failed',
        now(),
        now()
    ),
    (
        current_setting('test.related_note_claims_user_id')::uuid,
        current_setting('test.related_note_claims_excluded_quota_note_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id = current_setting('test.related_note_claims_excluded_quota_note_id')::uuid
        ) - interval '1 second',
        'stale',
        now(),
        now()
    );

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_user_id')::uuid,
    current_setting('test.related_note_claims_excluded_quota_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_excluded_quota_note_id')::uuid
    ),
    1
)
\gset test_related_note_claims_excluded_quota_statuses_

SELECT is(
    :'test_related_note_claims_excluded_quota_statuses_status'::text,
    'claimed',
    'failed and stale claims should not count toward the daily execution limit'
);


-- ----------------------------------------------------------------------------
-- ADMIN quota 우회
-- ----------------------------------------------------------------------------
--
-- ADMIN은 Related Notes 일일 실행 제한을 적용받지 않습니다.
-- 기존 succeeded Claim이 limit만큼 존재해도 새 실행을 claim할 수 있어야 합니다.
--

INSERT INTO public.related_note_recommendation_execution_claims (
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at,
    completed_at
)
VALUES (
    current_setting('test.related_note_claims_admin_user_id')::uuid,
    current_setting('test.related_note_claims_admin_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_admin_note_id')::uuid
    ) - interval '1 second',
    'succeeded',
    now(),
    now()
);

SELECT *
FROM public.claim_related_note_recommendation_execution(
    current_setting('test.related_note_claims_admin_user_id')::uuid,
    current_setting('test.related_note_claims_admin_note_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_claims_admin_note_id')::uuid
    ),
    1
)
\gset test_related_note_claims_admin_

SELECT is(
    :'test_related_note_claims_admin_status'::text,
    'claimed',
    'admin should bypass daily execution claim limits'
);


-- ============================================================================
-- User validation
-- ============================================================================
--
-- 이메일 인증이 완료되지 않은 사용자는 Related Notes AI 추천 실행을
-- 시작할 수 없어야 합니다.
--

SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_execution(
            current_setting('test.related_note_claims_unverified_user_id')::uuid,
            current_setting('test.related_note_claims_unverified_note_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_claims_unverified_note_id')::uuid
            ),
            10
        );
    $sql$,
    'P0001',
    'email not confirmed',
    'unverified user should be rejected'
);


SELECT * FROM finish();

ROLLBACK;
