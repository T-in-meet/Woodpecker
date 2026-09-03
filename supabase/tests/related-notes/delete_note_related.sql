BEGIN;

SELECT plan(5);


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

-- relation ID로 manual 관계 row를 삭제할 수 있어야 합니다.
SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_source_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_manual_target_id')::uuid
    )
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
-- 2. Manual Relation Delete From Reverse View
-- ============================================================================

RESET ROLE;

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status,
    metadata
)
VALUES (
    current_setting('test.related_notes_delete_source_id')::uuid,
    current_setting('test.related_notes_delete_manual_target_id')::uuid,
    'manual',
    'active',
    '{"title":"Manual Target"}'::jsonb
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

-- relation ID와 화면 기준 Note 조합이면 역방향 화면에서도 같은 row를 삭제해야 합니다.
SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_manual_target_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_manual_target_id')::uuid
    )
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
    'manual relationship should be deleted from reverse view'
);


-- ============================================================================
-- 3. AI Relation Dismiss
-- ============================================================================

-- relation ID로 AI 관계를 dismissed 상태로 전환해야 합니다.
SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_source_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_ai_target_id')::uuid
    )
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
-- 4. AI Relation Dismiss From Reverse View
-- ============================================================================

RESET ROLE;

UPDATE public.note_related_notes
SET status = 'active'
WHERE note_id =
        current_setting('test.related_notes_delete_source_id')::uuid
  AND related_note_id =
        current_setting('test.related_notes_delete_ai_target_id')::uuid;

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

-- relation ID와 화면 기준 Note 조합이면 역방향 화면에서도 AI 관계를 숨겨야 합니다.
SELECT public.delete_note_related(
    current_setting('test.related_notes_delete_ai_target_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_delete_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_delete_ai_target_id')::uuid
    )
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
    'AI relationship should be dismissed from reverse view'
);


-- ============================================================================
-- 5. Target Ownership
-- ============================================================================

-- relation ID가 다른 사용자의 target Note를 포함하면 삭제할 수 없어야 합니다.
SELECT throws_ok(
    format(
        $sql$
            SELECT public.delete_note_related(
                '%s'::uuid,
                '%s'::uuid
            );
        $sql$,
        current_setting('test.related_notes_delete_source_id'),
        (
            SELECT id::text
            FROM public.note_related_notes
            WHERE note_id =
                    current_setting('test.related_notes_delete_source_id')::uuid
              AND related_note_id =
                    current_setting('test.related_notes_delete_foreign_target_id')::uuid
        )
    ),
    'P0002',
    'RELATED_NOTE_TARGET_NOT_FOUND',
    'relationship targeting another users note should not be deletable'
);


RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
