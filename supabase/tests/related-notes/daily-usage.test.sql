BEGIN;

SELECT plan(18);

-- v2 전환이 끝난 최종 schema에는 legacy quota RPC가 존재하지 않아야 합니다.
SELECT hasnt_function(
    'public',
    'get_related_note_recommendation_daily_usage',
    ARRAY['uuid']::name[],
    'legacy recommendation daily usage RPC is removed'
);

-- Related Notes quota 조회 정책을 사용자와 Note가 분리된 fixture로 검증합니다.
-- ============================================================================
-- Test Fixtures
-- ============================================================================
--
-- Related Notes 일일 quota 조회 RPC의 Note 요청 가능 여부와 사용자 전체 사용량을
-- 사용자와 Note가 분리된 fixture로 검증합니다.
--
-- 주요 검증 대상:
--   - Claim이 없는 경우 현재 Note 요청 가능 / 사용자 전체 사용량 0
--   - running / succeeded Claim만 사용자 전체 사용량에 포함
--   - failed / stale Claim은 사용자 전체 사용량에서 제외
--   - 현재 Note의 running Claim은 Note별 quota를 소비
--   - 다른 Note의 만료 running Claim도 조회 전에 stale로 정리
--   - KST 기준 오늘 생성된 Claim만 사용자 전체 사용량에 포함
--   - 사용자 전체 10회 도달 시 사용하지 않은 Note도 요청 불가
--   - 현재 사용자가 소유하지 않은 Note의 quota 조회 차단
--   - authenticated 사용자만 quota 조회 RPC 실행 가능
--

SELECT set_config('test.related_note_quota_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_empty_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_other_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_expired_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_other_user_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_quota_expired_claim_id', gen_random_uuid()::text, true);

-- ============================================================================
-- Users
-- ============================================================================
--
-- 현재 quota를 조회할 사용자와 사용자 범위 분리를 검증할 다른 사용자를
-- 각각 준비합니다.
--

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
    (
        current_setting('test.related_note_quota_user_id')::uuid,
        'related-note-quota@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_quota_other_user_id')::uuid,
        'related-note-quota-other@example.com',
        now(),
        '{}'::jsonb
    );

-- ============================================================================
-- Notes
-- ============================================================================
--
-- 빈 quota, Note별 quota, 사용자 전체 quota, 만료 Claim 정리, 사용자 범위 분리를
-- 서로 독립적으로 검증할 수 있도록 목적별 Note를 준비합니다.
--

INSERT INTO public.notes (id, user_id, title, content, review_round)
VALUES
    (
        current_setting('test.related_note_quota_empty_note_id')::uuid,
        current_setting('test.related_note_quota_user_id')::uuid,
        'Related Note Quota Empty',
        'Related Note Quota Empty Content',
        0
    ),
    (
        current_setting('test.related_note_quota_note_id')::uuid,
        current_setting('test.related_note_quota_user_id')::uuid,
        'Related Note Quota Source',
        'Related Note Quota Source Content',
        0
    ),
    (
        current_setting('test.related_note_quota_other_note_id')::uuid,
        current_setting('test.related_note_quota_user_id')::uuid,
        'Related Note Quota Other',
        'Related Note Quota Other Content',
        0
    ),
    (
        current_setting('test.related_note_quota_expired_note_id')::uuid,
        current_setting('test.related_note_quota_user_id')::uuid,
        'Related Note Quota Expired',
        'Related Note Quota Expired Content',
        0
    ),
    (
        current_setting('test.related_note_quota_other_user_note_id')::uuid,
        current_setting('test.related_note_quota_other_user_id')::uuid,
        'Related Note Quota Other User',
        'Related Note Quota Other User Content',
        0
    );

-- ============================================================================
-- Empty quota
-- ============================================================================
--
-- 먼저 execution Claim이 하나도 없는 Note를 authenticated 사용자로 조회합니다.
-- 사용 이력이 없으면 현재 Note는 요청 가능해야 하고 사용자 전체 사용량은 0이어야 합니다.
--

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', current_setting('test.related_note_quota_user_id'),
        'role', 'authenticated'
    )::text,
    true
);

-- Claim이 없으면 현재 Note는 오늘 추천을 요청할 수 있어야 합니다.
SELECT is(
    (
        SELECT quota.can_request_for_note
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    true,
    'empty quota should allow a recommendation request for the note'
);

-- Claim이 없으면 사용자 전체 오늘 사용량은 0이어야 합니다.
SELECT is(
    (
        SELECT quota.user_used
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    0,
    'empty quota should return zero user-wide usage'
);

-- quota RPC는 TypeScript에서 주입한 Note 한도를 그대로 반환해야 합니다.
SELECT is(
    (
        SELECT quota.note_limit
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            2,
            3
        ) AS quota
    ),
    2,
    'quota lookup should return the injected note limit'
);

-- quota RPC는 TypeScript에서 주입한 사용자 한도를 그대로 반환해야 합니다.
SELECT is(
    (
        SELECT quota.user_limit
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            2,
            3
        ) AS quota
    ),
    3,
    'quota lookup should return the injected user limit'
);

-- ============================================================================
-- Quota status fixtures
-- ============================================================================
--
-- 이후 quota 상태 필터와 사용자 전체 stale cleanup 검증에 필요한 Claim을
-- service_role로 직접 준비합니다.
--
-- running / succeeded만 사용자 전체 사용량에 포함되어야 하며 failed / stale은
-- 같은 날 생성된 Claim이어도 제외되어야 합니다.
--
-- 다른 Note에 stale 기준을 초과한 running Claim도 준비해 quota 조회 RPC가
-- 사용자 전체 범위에서 해당 Claim을 stale로 정리하는지 검증합니다.
--

-- 상태 필터와 사용자 전체 stale cleanup을 검증할 Claim을 준비합니다.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

INSERT INTO public.related_note_recommendation_execution_claims (
    id, user_id, note_id, source_updated_at, status, claimed_at, completed_at
)
VALUES
    (
        gen_random_uuid(),
        current_setting('test.related_note_quota_user_id')::uuid,
        current_setting('test.related_note_quota_note_id')::uuid,
        '2026-01-01T00:00:01Z'::timestamptz,
        'running',
        clock_timestamp(),
        NULL
    ),
    (
        gen_random_uuid(),
        current_setting('test.related_note_quota_user_id')::uuid,
        current_setting('test.related_note_quota_other_note_id')::uuid,
        '2026-01-01T00:00:02Z'::timestamptz,
        'succeeded',
        clock_timestamp(),
        clock_timestamp()
    ),
    (
        gen_random_uuid(),
        current_setting('test.related_note_quota_user_id')::uuid,
        current_setting('test.related_note_quota_note_id')::uuid,
        '2026-01-01T00:00:03Z'::timestamptz,
        'failed',
        clock_timestamp(),
        clock_timestamp()
    ),
    (
        gen_random_uuid(),
        current_setting('test.related_note_quota_user_id')::uuid,
        current_setting('test.related_note_quota_note_id')::uuid,
        '2026-01-01T00:00:04Z'::timestamptz,
        'stale',
        clock_timestamp(),
        clock_timestamp()
    ),
    (
        current_setting('test.related_note_quota_expired_claim_id')::uuid,
        current_setting('test.related_note_quota_user_id')::uuid,
        current_setting('test.related_note_quota_expired_note_id')::uuid,
        '2026-01-01T00:00:05Z'::timestamptz,
        'running',
        clock_timestamp() - interval '4 minutes',
        NULL
    ),
    (
        gen_random_uuid(),
        current_setting('test.related_note_quota_other_user_id')::uuid,
        current_setting('test.related_note_quota_other_user_note_id')::uuid,
        '2026-01-01T00:00:06Z'::timestamptz,
        'succeeded',
        clock_timestamp(),
        clock_timestamp()
    );

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', current_setting('test.related_note_quota_user_id'),
        'role', 'authenticated'
    )::text,
    true
);

-- ============================================================================
-- Note quota and user-wide usage
-- ============================================================================
--
-- 현재 Note의 running Claim은 Note별 quota를 소비해 추가 요청을 막아야 합니다.
-- 사용자 전체 사용량은 같은 사용자의 모든 Note에서 running / succeeded만 합산하고,
-- failed / stale 및 다른 사용자의 Claim은 제외해야 합니다.
--

-- 현재 Note의 running Claim이 노트별 quota를 소비하면 요청할 수 없어야 합니다.
SELECT is(
    (
        SELECT quota.can_request_for_note
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    false,
    'a running claim for the note should prevent another request today'
);

-- Note 한도 도달 여부는 주입된 Note 한도를 기준으로 명시적으로 반환해야 합니다.
SELECT is(
    (
        SELECT quota.is_note_limit_reached
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    true,
    'quota lookup should identify the reached note limit'
);

-- 사용자 전체 사용량은 모든 Note의 running과 succeeded만 포함해야 합니다.
SELECT is(
    (
        SELECT quota.user_used
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    2,
    'user-wide usage should count running and succeeded across notes only'
);

-- 비기본 Note 2회/User 3회 한도에서는 현재 사용량 1회/2회인 Note를 허용해야 합니다.
SELECT is(
    (
        SELECT quota.can_request_for_note
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_note_id')::uuid,
            2,
            3
        ) AS quota
    ),
    true,
    'v2 quota should enforce injected non-default limits'
);

-- ============================================================================
-- Expired running Claim cleanup
-- ============================================================================
--
-- quota 조회 RPC는 사용자 전체 사용량 집계 전에 현재 사용자의 모든 Note를 대상으로
-- stale 기준을 초과한 running Claim을 stale로 전환하고 완료 시각을 기록해야 합니다.
--

-- 다른 Note의 만료 running Claim도 quota 집계 전에 stale로 정리되어야 합니다.
SELECT is(
    (
        SELECT claims.status
        FROM public.related_note_recommendation_execution_claims AS claims
        WHERE claims.id = current_setting(
            'test.related_note_quota_expired_claim_id'
        )::uuid
    ),
    'stale',
    'quota lookup should stale an expired running claim from another note'
);

-- stale로 정리한 다른 Note의 Claim에는 완료 시각을 기록해야 합니다.
SELECT ok(
    (
        SELECT claims.completed_at IS NOT NULL
        FROM public.related_note_recommendation_execution_claims AS claims
        WHERE claims.id = current_setting(
            'test.related_note_quota_expired_claim_id'
        )::uuid
    ),
    'quota lookup should complete an expired running claim from another note'
);

-- ============================================================================
-- KST daily boundary
-- ============================================================================
--
-- Related Notes의 하루는 UTC가 아니라 Asia/Seoul 기준으로 계산합니다.
--
-- KST 기준 오늘 00:00 직전의 succeeded Claim은 이전 날짜의 사용량이므로
-- 오늘 사용자 전체 사용량에 포함되지 않아야 합니다.
--

-- KST 오늘 시작 직전의 성공 Claim은 오늘 사용자 사용량에서 제외해야 합니다.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

INSERT INTO public.related_note_recommendation_execution_claims (
    user_id, note_id, source_updated_at, status, claimed_at, completed_at
)
VALUES (
    current_setting('test.related_note_quota_user_id')::uuid,
    current_setting('test.related_note_quota_note_id')::uuid,
    '2026-01-01T00:00:07Z'::timestamptz,
    'succeeded',
    (
        (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date::timestamp
        AT TIME ZONE 'Asia/Seoul'
    ) - interval '1 second',
    clock_timestamp()
);

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', current_setting('test.related_note_quota_user_id'),
        'role', 'authenticated'
    )::text,
    true
);

-- KST 이전 날짜 Claim을 추가해도 오늘 사용자 전체 사용량은 유지되어야 합니다.
SELECT is(
    (
        SELECT quota.user_used
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    2,
    'user-wide usage should exclude claims before the current KST day'
);

-- ============================================================================
-- User-wide daily quota
-- ============================================================================
--
-- 사용자 전체 오늘 사용량을 10회까지 채워, 현재 Note 자체의 quota가 비어 있어도
-- 사용자별 일일 한도에 도달하면 새 요청이 차단되는지 검증합니다.
--

-- 사용자 전체 오늘 10회를 채울 서로 다른 Note와 성공 Claim을 준비합니다.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

INSERT INTO public.notes (user_id, title, content, review_round)
SELECT
    current_setting('test.related_note_quota_user_id')::uuid,
    format('Related Note Quota Limit %s', series),
    format('Related Note Quota Limit Content %s', series),
    0
FROM generate_series(1, 8) AS series;

INSERT INTO public.related_note_recommendation_execution_claims (
    user_id, note_id, source_updated_at, status, claimed_at, completed_at
)
SELECT
    current_setting('test.related_note_quota_user_id')::uuid,
    notes.id,
    notes.updated_at,
    'succeeded',
    clock_timestamp(),
    clock_timestamp()
FROM public.notes AS notes
WHERE notes.user_id = current_setting('test.related_note_quota_user_id')::uuid
  AND notes.title LIKE 'Related Note Quota Limit %';

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', current_setting('test.related_note_quota_user_id'),
        'role', 'authenticated'
    )::text,
    true
);

-- 현재 Note quota가 비어 있어도 사용자 전체 10회에 도달하면 요청할 수 없어야 합니다.
SELECT is(
    (
        SELECT quota.can_request_for_note
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    false,
    'user-wide daily limit should prevent a request for an unused note'
);

-- 사용자 한도 도달 여부는 주입된 사용자 한도를 기준으로 명시적으로 반환해야 합니다.
SELECT is(
    (
        SELECT quota.is_user_limit_reached
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    true,
    'quota lookup should identify the reached user limit'
);

-- 사용자 전체 한도에 도달한 조회는 오늘 총 사용량 10회를 반환해야 합니다.
SELECT is(
    (
        SELECT quota.user_used
        FROM public.get_related_note_recommendation_daily_usage_v2(
            current_setting('test.related_note_quota_empty_note_id')::uuid,
            1,
            10
        ) AS quota
    ),
    10,
    'user-wide quota should return ten uses at the daily limit'
);

-- ============================================================================
-- Note ownership
-- ============================================================================
--
-- quota 조회는 auth.uid()가 소유한 Note에 대해서만 허용되어야 합니다.
--

-- 현재 사용자가 소유하지 않은 Note의 quota 조회는 거부해야 합니다.
SELECT throws_ok(
    format(
        $sql$
            SELECT *
            FROM public.get_related_note_recommendation_daily_usage_v2(%L::uuid, 1, 10);
        $sql$,
        current_setting('test.related_note_quota_other_user_note_id')
    ),
    'P0001',
    'note not found',
    'quota lookup should reject a note owned by another user'
);

-- ============================================================================
-- RPC permissions
-- ============================================================================
--
-- quota 조회 RPC는 auth.uid()를 기준으로 동작하므로 authenticated 사용자에게만
-- 실행 권한을 허용하고 anon 사용자의 직접 호출은 차단해야 합니다.
--

-- authenticated 사용자는 v2 quota RPC를 실행할 수 있어야 합니다.
SELECT ok(
    has_function_privilege(
        'authenticated',
        'public.get_related_note_recommendation_daily_usage_v2(uuid, integer, integer)',
        'EXECUTE'
    ),
    'authenticated should execute the v2 quota RPC'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

-- 익명 사용자는 Related Notes quota RPC를 실행할 수 없어야 합니다.
SELECT throws_ok(
    format(
        $sql$
            SELECT *
            FROM public.get_related_note_recommendation_daily_usage_v2(%L::uuid, 1, 10);
        $sql$,
        current_setting('test.related_note_quota_note_id')
    ),
    '42501',
    NULL,
    'anon should not execute related note recommendation quota RPC'
);

SELECT * FROM finish();

ROLLBACK;
