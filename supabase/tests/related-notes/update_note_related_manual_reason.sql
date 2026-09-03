BEGIN;

SELECT plan(5);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_notes_update_user_a_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_update_user_b_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_update_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_update_manual_target_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_update_ai_target_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_update_foreign_target_id',
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
        current_setting('test.related_notes_update_user_a_id')::uuid,
        'related-notes-update-a@example.com',
        '{}'::jsonb
    ),
    (
        current_setting('test.related_notes_update_user_b_id')::uuid,
        'related-notes-update-b@example.com',
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
        current_setting('test.related_notes_update_source_id')::uuid,
        current_setting('test.related_notes_update_user_a_id')::uuid,
        'Update Source',
        'Update Source Content',
        0
    ),
    (
        current_setting('test.related_notes_update_manual_target_id')::uuid,
        current_setting('test.related_notes_update_user_a_id')::uuid,
        'Manual Target',
        'Manual Target Content',
        0
    ),
    (
        current_setting('test.related_notes_update_ai_target_id')::uuid,
        current_setting('test.related_notes_update_user_a_id')::uuid,
        'AI Target',
        'AI Target Content',
        0
    ),
    (
        current_setting('test.related_notes_update_foreign_target_id')::uuid,
        current_setting('test.related_notes_update_user_b_id')::uuid,
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
        current_setting('test.related_notes_update_source_id')::uuid,
        current_setting('test.related_notes_update_manual_target_id')::uuid,
        'manual',
        'active',
        '{
            "title": "Manual Target",
            "reason": "기존 이유",
            "custom": "preserve"
        }'::jsonb
    ),
    (
        current_setting('test.related_notes_update_source_id')::uuid,
        current_setting('test.related_notes_update_ai_target_id')::uuid,
        'ai',
        'active',
        '{
            "title": "AI Target",
            "reason": "AI 추천 이유"
        }'::jsonb
    ),
    (
        current_setting('test.related_notes_update_source_id')::uuid,
        current_setting('test.related_notes_update_foreign_target_id')::uuid,
        'manual',
        'active',
        '{
            "title": "Foreign Target"
        }'::jsonb
    );


SET LOCAL ROLE authenticated;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',
        current_setting('test.related_notes_update_user_a_id'),
        'role',
        'authenticated'
    )::text,
    true
);


-- ============================================================================
-- 1. Update Reason
-- ============================================================================

-- relation ID로 manual 관계 reason을 수정할 수 있어야 합니다.
SELECT public.update_note_related_manual_reason(
    current_setting('test.related_notes_update_source_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '  수정된 이유  '
);

SELECT is(
    (
        SELECT metadata
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '{
        "title": "Manual Target",
        "reason": "수정된 이유",
        "custom": "preserve"
    }'::jsonb,
    'updating manual reason should preserve existing metadata'
);


-- ============================================================================
-- 2. Remove Reason
-- ============================================================================

-- relation ID로 manual 관계 reason만 제거할 수 있어야 합니다.
SELECT public.update_note_related_manual_reason(
    current_setting('test.related_notes_update_source_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '   '
);

SELECT is(
    (
        SELECT metadata
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '{
        "title": "Manual Target",
        "custom": "preserve"
    }'::jsonb,
    'blank reason should remove only the reason metadata key'
);


-- ============================================================================
-- 3. Update Reason From Reverse View
-- ============================================================================

-- relation ID와 화면 기준 Note 조합이면 역방향 화면에서도 같은 row를 수정해야 합니다.
SELECT public.update_note_related_manual_reason(
    current_setting('test.related_notes_update_manual_target_id')::uuid,
    (
        SELECT id
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '역방향 수정 이유'
);

SELECT is(
    (
        SELECT metadata
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_update_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_update_manual_target_id')::uuid
    ),
    '{
        "title": "Manual Target",
        "reason": "역방향 수정 이유",
        "custom": "preserve"
    }'::jsonb,
    'updating manual reason from reverse view should update stored relationship'
);


-- ============================================================================
-- 4. AI Relation
-- ============================================================================

-- relation ID가 AI 관계를 가리키면 manual reason 수정은 거부해야 합니다.
SELECT throws_ok(
    format(
        $sql$
            SELECT public.update_note_related_manual_reason(
                '%s'::uuid,
                '%s'::uuid,
                '수정할 수 없는 이유'
            );
        $sql$,
        current_setting('test.related_notes_update_source_id'),
        (
            SELECT id::text
            FROM public.note_related_notes
            WHERE note_id =
                    current_setting('test.related_notes_update_source_id')::uuid
              AND related_note_id =
                    current_setting('test.related_notes_update_ai_target_id')::uuid
        )
    ),
    'P0002',
    'RELATED_NOTE_MANUAL_RELATION_NOT_FOUND',
    'AI relationship reason should not be manually editable'
);


-- ============================================================================
-- 5. Target Ownership
-- ============================================================================

-- relation ID가 다른 사용자의 target Note를 포함하면 수정할 수 없어야 합니다.
SELECT throws_ok(
    format(
        $sql$
            SELECT public.update_note_related_manual_reason(
                '%s'::uuid,
                '%s'::uuid,
                '다른 사용자 Note'
            );
        $sql$,
        current_setting('test.related_notes_update_source_id'),
        (
            SELECT id::text
            FROM public.note_related_notes
            WHERE note_id =
                    current_setting('test.related_notes_update_source_id')::uuid
              AND related_note_id =
                    current_setting('test.related_notes_update_foreign_target_id')::uuid
        )
    ),
    'P0002',
    'RELATED_NOTE_TARGET_NOT_FOUND',
    'manual relationship targeting another users note should not be editable'
);


RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
