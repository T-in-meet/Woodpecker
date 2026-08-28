BEGIN;

SELECT plan(23);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config('test.related_note_claims_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_other_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_admin_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_unverified_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_other_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_admin_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_unverified_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_recent_running_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_expired_running_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_old_succeeded_note_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_recent_running_claim_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_expired_running_claim_id', gen_random_uuid()::text, true);
SELECT set_config('test.related_note_claims_old_succeeded_claim_id', gen_random_uuid()::text, true);

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

UPDATE public.profiles
SET role = 'ADMIN'
WHERE id = current_setting('test.related_note_claims_admin_user_id')::uuid;


-- ============================================================================
-- Table and permissions
-- ============================================================================

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

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

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

SELECT is(
    :'test_related_note_claims_expired_running_status'::text,
    'claimed',
    'expired running claim should allow a new execution claim'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_expired_running_claim_id')::uuid
    ),
    'stale',
    'expired running claim should be completed as stale'
);

SELECT ok(
    (
        SELECT completed_at IS NOT NULL
        FROM public.related_note_recommendation_execution_claims
        WHERE id = current_setting('test.related_note_claims_expired_running_claim_id')::uuid
    ),
    'expired running claim should receive completed_at'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_execution_claims
        WHERE id = :'test_related_note_claims_expired_running_claim_id'::uuid
    ),
    'running',
    'new claim after expiring stale running claim should be running'
);

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
    'daily limit should count running and succeeded execution claims'
);

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
