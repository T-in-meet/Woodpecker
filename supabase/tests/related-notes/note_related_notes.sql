BEGIN;

SELECT plan(12);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_notes_user_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_user_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_note_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_note_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_note_c_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_note_x_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_note_y_id',
    gen_random_uuid()::text,
    true
);

INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data
)
VALUES
    (
        current_setting('test.related_notes_user_a_id')::uuid,
        'related-notes-a@example.com',
        '{}'::jsonb
    ),
    (
        current_setting('test.related_notes_user_b_id')::uuid,
        'related-notes-b@example.com',
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
        current_setting('test.related_notes_note_a_id')::uuid,
        current_setting('test.related_notes_user_a_id')::uuid,
        'Note A',
        'Content A',
        0
    ),
    (
        current_setting('test.related_notes_note_b_id')::uuid,
        current_setting('test.related_notes_user_a_id')::uuid,
        'Note B',
        'Content B',
        0
    ),
    (
        current_setting('test.related_notes_note_c_id')::uuid,
        current_setting('test.related_notes_user_a_id')::uuid,
        'Note C',
        'Content C',
        0
    ),
    (
        current_setting('test.related_notes_note_x_id')::uuid,
        current_setting('test.related_notes_user_b_id')::uuid,
        'Note X',
        'Content X',
        0
    ),
    (
        current_setting('test.related_notes_note_y_id')::uuid,
        current_setting('test.related_notes_user_b_id')::uuid,
        'Note Y',
        'Content Y',
        0
    );


-- ============================================================================
-- 1. Table
-- ============================================================================

SELECT has_table(
    'public',
    'note_related_notes',
    'note_related_notes table should exist'
);


-- ============================================================================
-- 2. Valid relation
-- ============================================================================

SELECT lives_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin,
                metadata
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'ai',
                '{"reason":"related","rank":1}'::jsonb
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_b_id')
    ),
    'valid AI relationship should be insertable'
);


-- ============================================================================
-- 3. Duplicate relation
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'manual'
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_b_id')
    ),
    '23505',
    NULL,
    'duplicate relationship should be rejected'
);


-- ============================================================================
-- 4. Reverse duplicate relation
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'manual'
            );
        $sql$,
        current_setting('test.related_notes_note_b_id'),
        current_setting('test.related_notes_note_a_id')
    ),
    '23505',
    NULL,
    'reverse duplicate relationship should be rejected'
);

SELECT has_function(
    'public',
    'lock_note_related_note_pair',
    ARRAY['uuid', 'uuid'],
    'lock_note_related_note_pair helper should exist'
);

SELECT ok(
    has_function_privilege(
        'service_role',
        'public.lock_note_related_note_pair(uuid,uuid)',
        'EXECUTE'
    )
    AND NOT has_function_privilege(
        'authenticated',
        'public.lock_note_related_note_pair(uuid,uuid)',
        'EXECUTE'
    ),
    'pair lock helper should be callable by service_role but not directly by authenticated users'
);


-- ============================================================================
-- 5. Self relation
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'manual'
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_a_id')
    ),
    '23514',
    NULL,
    'self relationship should be rejected'
);


-- ============================================================================
-- 6. Invalid origin
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'invalid'
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_c_id')
    ),
    '23514',
    NULL,
    'invalid origin should be rejected'
);


-- ============================================================================
-- 7. manual + dismissed
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin,
                status
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'manual',
                'dismissed'
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_c_id')
    ),
    '23514',
    NULL,
    'manual relationship should not be dismissed'
);


-- ============================================================================
-- 8. Metadata must be an object
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            INSERT INTO public.note_related_notes (
                note_id,
                related_note_id,
                origin,
                metadata
            )
            VALUES (
                '%s'::uuid,
                '%s'::uuid,
                'ai',
                '[]'::jsonb
            );
        $sql$,
        current_setting('test.related_notes_note_a_id'),
        current_setting('test.related_notes_note_c_id')
    ),
    '23514',
    NULL,
    'metadata should reject non-object JSON'
);


-- ============================================================================
-- 9. RLS
-- ============================================================================

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin
)
VALUES (
    current_setting('test.related_notes_note_x_id')::uuid,
    current_setting('test.related_notes_note_y_id')::uuid,
    'manual'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_notes_user_a_id'),
        'role',
        'authenticated'
    )::text,
    true
);

SELECT is(
    (
        SELECT count(*)
        FROM public.note_related_notes
        WHERE note_id =
            current_setting('test.related_notes_note_x_id')::uuid
    ),
    0::bigint,
    'authenticated user should not read another users relationships'
);

RESET ROLE;


-- ============================================================================
-- 10. Cascade
-- ============================================================================

DELETE FROM public.notes
WHERE id = current_setting('test.related_notes_note_b_id')::uuid;

SELECT is(
    (
        SELECT count(*)
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_note_a_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_note_b_id')::uuid
    ),
    0::bigint,
    'deleting a related note should cascade delete the relationship'
);


SELECT * FROM finish();

ROLLBACK;
