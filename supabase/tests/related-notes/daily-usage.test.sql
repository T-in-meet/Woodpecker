BEGIN;

SELECT plan(6);


-- ============================================================================
-- Test Fixtures
-- ============================================================================
--
-- Related Notes 일일 사용량 조회 RPC의 quota 계산 기준을 검증하기 위한
-- 사용자, Note, execution Claim을 준비합니다.
--
-- 주요 검증 대상:
--   - Claim이 없는 경우 사용량 0 반환
--   - running / succeeded Claim만 사용량에 포함
--   - failed / stale Claim은 사용량에서 제외
--   - stale 기준을 초과한 running Claim은 조회 전에 stale로 정리
--   - 사용자와 Note가 다른 Claim은 사용량에서 제외
--   - KST 기준 오늘 생성된 Claim만 사용량에 포함
--   - authenticated 사용자만 사용량 조회 RPC 실행 가능
--

SELECT set_config(
    'test.related_note_daily_usage_user_id',
    gen_random_uuid()::text,
    true
);
SELECT set_config(
    'test.related_note_daily_usage_other_user_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_daily_usage_empty_note_id',
    gen_random_uuid()::text,
    true
);
SELECT set_config(
    'test.related_note_daily_usage_note_id',
    gen_random_uuid()::text,
    true
);
SELECT set_config(
    'test.related_note_daily_usage_other_note_id',
    gen_random_uuid()::text,
    true
);
SELECT set_config(
    'test.related_note_daily_usage_other_user_note_id',
    gen_random_uuid()::text,
    true
);


-- ============================================================================
-- Users
-- ============================================================================
--
-- 현재 사용량을 조회할 사용자와 사용자 범위 분리를 검증할 다른 사용자를
-- 각각 준비합니다.
--

INSERT INTO auth.users (
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data
)
VALUES
    (
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        'related-note-daily-usage@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_daily_usage_other_user_id')::uuid,
        'related-note-daily-usage-other@example.com',
        now(),
        '{}'::jsonb
    );


-- ============================================================================
-- Notes
-- ============================================================================
--
-- 빈 사용량, Note 범위 분리, 사용자 범위 분리를 서로 독립적으로 검증할 수 있도록
-- 목적별 Note를 준비합니다.
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
        current_setting('test.related_note_daily_usage_empty_note_id')::uuid,
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        'Related Note Daily Usage Empty',
        'Related Note Daily Usage Empty Content',
        0
    ),
    (
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        'Related Note Daily Usage Source',
        'Related Note Daily Usage Source Content',
        0
    ),
    (
        current_setting('test.related_note_daily_usage_other_note_id')::uuid,
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        'Related Note Daily Usage Other Note',
        'Related Note Daily Usage Other Note Content',
        0
    ),
    (
        current_setting('test.related_note_daily_usage_other_user_note_id')::uuid,
        current_setting('test.related_note_daily_usage_other_user_id')::uuid,
        'Related Note Daily Usage Other User',
        'Related Note Daily Usage Other User Content',
        0
    );


-- ============================================================================
-- Empty usage
-- ============================================================================
--
-- 먼저 execution Claim이 하나도 없는 Note를 authenticated 사용자로 조회합니다.
-- 사용 이력이 없으면 일일 사용량은 0이어야 합니다.
--

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_daily_usage_user_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    public.get_related_note_recommendation_daily_usage(
        current_setting('test.related_note_daily_usage_empty_note_id')::uuid
    ),
    0,
    'daily usage should be zero when the note has no execution claims'
);


-- ============================================================================
-- Daily usage fixtures
-- ============================================================================
--
-- 이후 테스트에 필요한 Claim은 service_role로 직접 준비합니다.
--
-- 현재 quota 정책과 동일하게 running / succeeded만 사용량에 포함되어야 하며,
-- failed / stale은 같은 날 생성된 Claim이어도 제외되어야 합니다.
--
-- stale 기준을 초과한 running Claim도 함께 준비해 사용량 조회 RPC가
-- 집계 전에 해당 Claim을 stale로 정리하는지 검증합니다.
--

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

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
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        '2026-01-01T00:00:01Z'::timestamptz,
        'running',
        now(),
        NULL
    ),
    (
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        '2026-01-01T00:00:02Z'::timestamptz,
        'succeeded',
        now(),
        now()
    ),
    (
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        '2026-01-01T00:00:03Z'::timestamptz,
        'failed',
        now(),
        now()
    ),
    (
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        '2026-01-01T00:00:04Z'::timestamptz,
        'stale',
        now(),
        now()
    ),
    (
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_note_id')::uuid,
        '2026-01-01T00:00:08Z'::timestamptz,
        'running',
        now() - interval '4 minutes',
        NULL
    );


-- ============================================================================
-- Quota status filtering
-- ============================================================================
--
-- 같은 사용자와 Note에 오늘 생성된 Claim이 다섯 개 존재하지만,
-- stale 기준을 초과한 running Claim은 먼저 stale로 정리되어야 합니다.
--
-- 따라서 실제 quota에 포함되는 현재 running / succeeded 두 개만
-- 사용량으로 계산해야 합니다.
--

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_daily_usage_user_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    public.get_related_note_recommendation_daily_usage(
        current_setting('test.related_note_daily_usage_note_id')::uuid
    ),
    2,
    'daily usage should count running and succeeded claims but exclude failed, stale, and expired running claims'
);


-- ============================================================================
-- Expired running Claim cleanup
-- ============================================================================
--
-- 일일 사용량 조회 RPC는 집계 전에 stale 기준을 초과한 running Claim을
-- stale로 전환해야 합니다.
--

SELECT is(
    (
        SELECT claims.status
        FROM public.related_note_recommendation_execution_claims AS claims
        WHERE claims.user_id =
            current_setting('test.related_note_daily_usage_user_id')::uuid
          AND claims.note_id =
            current_setting('test.related_note_daily_usage_note_id')::uuid
          AND claims.source_updated_at =
            '2026-01-01T00:00:08Z'::timestamptz
    ),
    'stale',
    'daily usage should mark expired running claims as stale before counting usage'
);


-- ============================================================================
-- User and Note scope
-- ============================================================================
--
-- 일일 사용량은 현재 인증 사용자와 요청한 Note의 조합으로 계산해야 합니다.
--
-- 같은 사용자의 다른 Note와 다른 사용자의 Note에 오늘 succeeded Claim을
-- 각각 추가해도 현재 Note의 사용량에는 영향을 주지 않아야 합니다.
--

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

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
        current_setting('test.related_note_daily_usage_user_id')::uuid,
        current_setting('test.related_note_daily_usage_other_note_id')::uuid,
        '2026-01-01T00:00:05Z'::timestamptz,
        'succeeded',
        now(),
        now()
    ),
    (
        current_setting('test.related_note_daily_usage_other_user_id')::uuid,
        current_setting('test.related_note_daily_usage_other_user_note_id')::uuid,
        '2026-01-01T00:00:06Z'::timestamptz,
        'succeeded',
        now(),
        now()
    );

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_daily_usage_user_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    public.get_related_note_recommendation_daily_usage(
        current_setting('test.related_note_daily_usage_note_id')::uuid
    ),
    2,
    'daily usage should be scoped to the authenticated user and requested note'
);


-- ============================================================================
-- KST daily boundary
-- ============================================================================
--
-- Related Notes의 하루는 UTC가 아니라 Asia/Seoul 기준으로 계산합니다.
--
-- KST 기준 오늘 00:00 직전의 succeeded Claim은 이전 날짜의 사용량이므로
-- 현재 Note의 오늘 사용량에 포함되지 않아야 합니다.
--

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

INSERT INTO public.related_note_recommendation_execution_claims (
    user_id,
    note_id,
    source_updated_at,
    status,
    claimed_at,
    completed_at
)
VALUES (
    current_setting('test.related_note_daily_usage_user_id')::uuid,
    current_setting('test.related_note_daily_usage_note_id')::uuid,
    '2026-01-01T00:00:07Z'::timestamptz,
    'succeeded',
    (
        (
            (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date
        )::timestamp AT TIME ZONE 'Asia/Seoul'
    ) - interval '1 second',
    now()
);

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_daily_usage_user_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    public.get_related_note_recommendation_daily_usage(
        current_setting('test.related_note_daily_usage_note_id')::uuid
    ),
    2,
    'daily usage should exclude claims before the current KST day'
);


-- ============================================================================
-- RPC permissions
-- ============================================================================
--
-- 일일 사용량은 auth.uid()를 기준으로 조회하므로 authenticated 사용자에게만
-- RPC 실행 권한을 허용하고 anon 사용자의 직접 호출은 차단해야 합니다.
--

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
    $sql$
        SELECT public.get_related_note_recommendation_daily_usage(
            current_setting('test.related_note_daily_usage_note_id')::uuid
        );
    $sql$,
    '42501',
    NULL,
    'anon should not execute related note recommendation daily usage RPC'
);


SELECT * FROM finish();

ROLLBACK;