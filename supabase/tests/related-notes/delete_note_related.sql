BEGIN;

SELECT plan(3);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_notes_delete_user_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_delete_user_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_delete_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_delete_manual_target_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_delete_ai_target_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_delete_foreign_target_id',
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
        current_setting('test.related_notes_delete_user_a_id')::uuid,
        'related-notes-delete-a@example.com',
        '{}'::jsonb
    ),
    (
        current_setting('test.related_notes_delete_user_b_id')::uuid,
        'related-notes-delete-b@example.com',
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
        current_setting('test.related_notes_delete_source_id')::uuid,
        current_setting('test.related_notes_delete_user_a_id')::uuid,
        'Delete Source',
        'Delete Source Content',
        0
    ),
    (
        current_setting('test.related_notes_delete_manual_target_id')::uuid,
        current_setting('test.related_notes_delete_user_a_id')::uuid,
        'Manual Target',
        'Manual Target Content',
        0
    ),
    (
        current_setting('test.related_notes_delete_ai_target_id')::uuid,
        current_setting('test.related_notes_delete_user_a_id')::uuid,
        'AI Target',
        'AI Target Content',
        0
    ),
    (
        current_setting('test.related_notes_delete_foreign_target_id')::uuid,
        current_setting('test.related_notes_delete_user_b_id')::uuid,
        'Foreign Target',
        'Foreign Target Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status,
    metadata
)
VALUES
    (
        current_setting('test.related_notes_delete_source_id')::uuid,
        current_setting('test.related_notes_delete_manual_target_id')::uuid,
        'manual',
        'active',
        '{"title":"Manual Target"}'::jsonb
    ),
    (
        current_setting('test.related_notes_delete_source_id')::uuid,
        current_setting('test.related_notes_delete_ai_target_id')::uuid,
        'ai',
        'active',
        '{"title":"AI Target","reason":"AI 추천 이유"}'::jsonb
    ),
    (
        current_setting('test.related_notes_delete_source_id')::uuid,
        current_setting('test.related_notes_delete_foreign_target_id')::uuid,
        'manual',
        'active',
        '{"title":"Foreign Target"}'::jsonb
    );

SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_notes_delete_user_a_id'),
        'role',
        'authenticated'
    )::text,
    true
);


-- ============================================================================
-- 1. Manual Relation Delete
-- ============================================================================

SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_source_id')::uuid,
    current_setting('test.related_notes_delete_manual_target_id')::uuid
);

SELECT is(
    (
        SELECT count(*)
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_manual_target_id')::uuid
    ),
    0::bigint,
    'manual relationship should be deleted'
);


-- ============================================================================
-- 2. AI Relation Dismiss
-- ============================================================================

SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_source_id')::uuid,
    current_setting('test.related_notes_delete_ai_target_id')::uuid
);

SELECT is(
    (
        SELECT status
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_ai_target_id')::uuid
    ),
    'dismissed',
    'AI relationship should be preserved as dismissed'
);


-- ============================================================================
-- 3. Target Ownership
-- ============================================================================

SELECT throws_ok(
    format(
        $sql$
            SELECT public.delete_note_related(
                '%s'::uuid,
                '%s'::uuid
            );
        $sql$,
        current_setting('test.related_notes_delete_source_id'),
        current_setting('test.related_notes_delete_foreign_target_id')
    ),
    'P0002',
    'RELATED_NOTE_TARGET_NOT_FOUND',
    'relationship targeting another users note should not be deletable'
);


RESET ROLE;

SELECT * FROM finish();

ROLLBACK;