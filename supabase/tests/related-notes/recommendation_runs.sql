BEGIN;

SELECT plan(17);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_note_runs_user_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_user_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_unverified_user_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_note_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_note_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_unverified_note_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_run_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_note_runs_run_b_id',
    gen_random_uuid()::text,
    true
);

INSERT INTO auth.users (
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data
)
VALUES
    (
        current_setting('test.related_note_runs_user_a_id')::uuid,
        'related-note-runs-a@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_runs_user_b_id')::uuid,
        'related-note-runs-b@example.com',
        now(),
        '{}'::jsonb
    ),
    (
        current_setting('test.related_note_runs_unverified_user_id')::uuid,
        'related-note-runs-unverified@example.com',
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
        current_setting('test.related_note_runs_note_a_id')::uuid,
        current_setting('test.related_note_runs_user_a_id')::uuid,
        'Related Note Run A',
        'Related Note Run A Content',
        0
    ),
    (
        current_setting('test.related_note_runs_note_b_id')::uuid,
        current_setting('test.related_note_runs_user_b_id')::uuid,
        'Related Note Run B',
        'Related Note Run B Content',
        0
    ),
    (
        current_setting('test.related_note_runs_unverified_note_id')::uuid,
        current_setting('test.related_note_runs_unverified_user_id')::uuid,
        'Related Note Run Unverified',
        'Related Note Run Unverified Content',
        0
    );

UPDATE public.profiles
SET role = 'USER'
WHERE id IN (
    current_setting('test.related_note_runs_user_a_id')::uuid,
    current_setting('test.related_note_runs_user_b_id')::uuid,
    current_setting('test.related_note_runs_unverified_user_id')::uuid
);


-- ============================================================================
-- 1. Table and constraints
-- ============================================================================

SELECT has_table(
    'public',
    'related_note_recommendation_runs',
    'related_note_recommendation_runs table should exist'
);

SELECT col_not_null(
    'public',
    'related_note_recommendation_runs',
    'recommendations',
    'recommendations snapshot should be NOT NULL'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.related_note_recommendation_runs'::regclass
          AND conname =
              'related_note_recommendation_runs_recommendations_array_check'
          AND contype = 'c'
    ),
    'recommendations JSON array check constraint should exist'
);


-- ============================================================================
-- 2. Service role write path
-- ============================================================================

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT lives_ok(
    format(
        $sql$
            INSERT INTO public.related_note_recommendation_runs (
                id,
                note_id,
                user_id,
                status,
                source_updated_at,
                expanded_query,
                matched_note_ids,
                recommendations,
                query_expansion_usage,
                query_expansion_cost_usd
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                '%s'::uuid,
                'running',
                now(),
                'expanded related note query',
                ARRAY['%s'::uuid],
                jsonb_build_array(
                    jsonb_build_object(
                        'noteId',
                        '%s',
                        'title',
                        'Related recommendation',
                        'reason',
                        'Shared context'
                    )
                ),
                '{"inputTokens":10,"outputTokens":5,"totalTokens":15}'::jsonb,
                0.00001
            );
        $sql$,
        current_setting('test.related_note_runs_run_a_id'),
        current_setting('test.related_note_runs_note_a_id'),
        current_setting('test.related_note_runs_user_a_id'),
        current_setting('test.related_note_runs_note_b_id'),
        current_setting('test.related_note_runs_note_b_id')
    ),
    'service_role should insert a related note recommendation run'
);

SELECT is(
    (
        SELECT total_cost_usd
        FROM public.related_note_recommendation_runs
        WHERE id = current_setting('test.related_note_runs_run_a_id')::uuid
    ),
    0.00001::numeric,
    'total_cost_usd should be generated from step costs'
);

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.related_note_recommendation_runs (
                note_id,
                user_id,
                recommendations
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                '{"noteId":"not-an-array"}'::jsonb
            );
        $sql$,
        current_setting('test.related_note_runs_note_a_id'),
        current_setting('test.related_note_runs_user_a_id')
    ),
    '23514',
    NULL,
    'recommendations should reject non-array JSON'
);

INSERT INTO public.related_note_recommendation_runs (
    id,
    note_id,
    user_id,
    status,
    recommendations
)
VALUES (
    current_setting('test.related_note_runs_run_b_id')::uuid,
    current_setting('test.related_note_runs_note_b_id')::uuid,
    current_setting('test.related_note_runs_user_b_id')::uuid,
    'running',
    '[]'::jsonb
);


-- ============================================================================
-- 3. RLS
-- ============================================================================

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_runs_user_a_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    (
        SELECT count(*)
        FROM public.related_note_recommendation_runs
    ),
    1::bigint,
    'authenticated user should select only own related note recommendation runs'
);

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.related_note_recommendation_runs (
                note_id,
                user_id
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid
            );
        $sql$,
        current_setting('test.related_note_runs_note_a_id'),
        current_setting('test.related_note_runs_user_a_id')
    ),
    '42501',
    NULL,
    'authenticated user should not insert related note recommendation runs'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT throws_ok(
    $sql$
        SELECT count(*)
        FROM public.related_note_recommendation_runs;
    $sql$,
    '42501',
    NULL,
    'anon should not select related note recommendation runs'
);


-- ============================================================================
-- 4. Claim RPC
-- ============================================================================

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_note_runs_user_a_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_run(
            current_setting('test.related_note_runs_user_a_id')::uuid,
            current_setting('test.related_note_runs_note_a_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_runs_note_a_id')::uuid
            ),
            gen_random_uuid(),
            gen_random_uuid(),
            gen_random_uuid(),
            10
        );
    $sql$,
    '42501',
    NULL,
    'authenticated should not execute claim_related_note_recommendation_run'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}'::text, true);

SELECT *
FROM public.claim_related_note_recommendation_run(
    current_setting('test.related_note_runs_user_b_id')::uuid,
    current_setting('test.related_note_runs_note_b_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_runs_note_b_id')::uuid
    ),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    10
)
\gset test_related_note_runs_claim_

SELECT is(
    :'test_related_note_runs_claim_status'::text,
    'claimed',
    'claim RPC should create a running recommendation run'
);

SELECT is(
    (
        SELECT status
        FROM public.related_note_recommendation_runs
        WHERE id = :'test_related_note_runs_claim_run_id'::uuid
    ),
    'running',
    'claimed run should be stored as running'
);

SELECT *
FROM public.claim_related_note_recommendation_run(
    current_setting('test.related_note_runs_user_b_id')::uuid,
    current_setting('test.related_note_runs_note_b_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_runs_note_b_id')::uuid
    ),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    10
)
\gset test_related_note_runs_duplicate_

SELECT is(
    :'test_related_note_runs_duplicate_status'::text,
    'duplicate',
    'claim RPC should skip duplicate running same note version'
);

UPDATE public.notes
SET title = title || ' quota'
WHERE id = current_setting('test.related_note_runs_note_a_id')::uuid;

SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_run(
            current_setting('test.related_note_runs_user_a_id')::uuid,
            current_setting('test.related_note_runs_note_a_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_runs_note_a_id')::uuid
            ),
            gen_random_uuid(),
            gen_random_uuid(),
            gen_random_uuid(),
            1
        );
    $sql$,
    'WP003',
    'RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_EXCEEDED',
    'claim RPC should enforce daily limits for non-admin users'
);

RESET ROLE;

UPDATE public.profiles
SET role = 'ADMIN'
WHERE id = current_setting('test.related_note_runs_user_a_id')::uuid;

SET LOCAL ROLE service_role;

SELECT *
FROM public.claim_related_note_recommendation_run(
    current_setting('test.related_note_runs_user_a_id')::uuid,
    current_setting('test.related_note_runs_note_a_id')::uuid,
    (
        SELECT updated_at
        FROM public.notes
        WHERE id = current_setting('test.related_note_runs_note_a_id')::uuid
    ),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    1
)
\gset test_related_note_runs_admin_

SELECT is(
    :'test_related_note_runs_admin_status'::text,
    'claimed',
    'claim RPC should bypass daily limits for admin users'
);

SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_run(
            current_setting('test.related_note_runs_user_a_id')::uuid,
            current_setting('test.related_note_runs_note_b_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_runs_note_b_id')::uuid
            ),
            gen_random_uuid(),
            gen_random_uuid(),
            gen_random_uuid(),
            10
        );
    $sql$,
    'WP010',
    'recommendation source not found',
    'claim RPC should reject another user source note'
);

SELECT throws_ok(
    $sql$
        SELECT *
        FROM public.claim_related_note_recommendation_run(
            current_setting('test.related_note_runs_unverified_user_id')::uuid,
            current_setting('test.related_note_runs_unverified_note_id')::uuid,
            (
                SELECT updated_at
                FROM public.notes
                WHERE id = current_setting('test.related_note_runs_unverified_note_id')::uuid
            ),
            gen_random_uuid(),
            gen_random_uuid(),
            gen_random_uuid(),
            10
        );
    $sql$,
    'P0001',
    'email not confirmed',
    'claim RPC should reject unverified users'
);


SELECT * FROM finish();

ROLLBACK;
