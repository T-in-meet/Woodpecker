BEGIN;

SELECT plan(2);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_notes_replace_user_id',
    gen_random_uuid()::text,
    true
);

INSERT INTO auth.users (
    id,
    email,
    raw_user_meta_data
)
VALUES (
    current_setting('test.related_notes_replace_user_id')::uuid,
    'related-notes-replace@example.com',
    '{}'::jsonb
);


-- ============================================================================
-- 1. Replace Active AI Related Notes RPC
-- ============================================================================

/*
 * RPC 실행 시 기존 active AI 추천만 새로운 추천으로 교체되고,
 * 사용자가 직접 연결한 manual 관계와 사용자가 거부한 dismissed AI 관계는
 * 그대로 유지되어야 합니다.
 */
SELECT set_config(
    'test.related_notes_replace_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_replace_manual_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_replace_dismissed_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_replace_old_ai_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_replace_new_ai_id',
    gen_random_uuid()::text,
    true
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
        current_setting('test.related_notes_replace_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Replace Source',
        'Replace Source Content',
        0
    ),
    (
        current_setting('test.related_notes_replace_manual_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Replace Manual',
        'Replace Manual Content',
        0
    ),
    (
        current_setting('test.related_notes_replace_dismissed_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Replace Dismissed',
        'Replace Dismissed Content',
        0
    ),
    (
        current_setting('test.related_notes_replace_old_ai_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Replace Old AI',
        'Replace Old AI Content',
        0
    ),
    (
        current_setting('test.related_notes_replace_new_ai_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Replace New AI',
        'Replace New AI Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES
    (
        current_setting('test.related_notes_replace_source_id')::uuid,
        current_setting('test.related_notes_replace_manual_id')::uuid,
        'manual',
        'active'
    ),
    (
        current_setting('test.related_notes_replace_source_id')::uuid,
        current_setting('test.related_notes_replace_dismissed_id')::uuid,
        'ai',
        'dismissed'
    ),
    (
        current_setting('test.related_notes_replace_source_id')::uuid,
        current_setting('test.related_notes_replace_old_ai_id')::uuid,
        'ai',
        'active'
    );

SELECT public.replace_note_related_ai_recommendations(
    current_setting('test.related_notes_replace_source_id')::uuid,
    jsonb_build_array(
        jsonb_build_object(
            'relatedNoteId',
            current_setting('test.related_notes_replace_manual_id'),
            'metadata',
            jsonb_build_object('reason', 'manual conflict')
        ),
        jsonb_build_object(
            'relatedNoteId',
            current_setting('test.related_notes_replace_dismissed_id'),
            'metadata',
            jsonb_build_object('reason', 'dismissed conflict')
        ),
        jsonb_build_object(
            'relatedNoteId',
            current_setting('test.related_notes_replace_new_ai_id'),
            'metadata',
            jsonb_build_object('reason', 'new recommendation')
        )
    )
);

SELECT ok(
    -- manual 관계는 그대로 유지되어야 합니다.
    EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_replace_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_replace_manual_id')::uuid
          AND origin = 'manual'
          AND status = 'active'
    )
    -- dismissed AI 관계도 그대로 유지되어야 합니다.
    AND EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_replace_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_replace_dismissed_id')::uuid
          AND origin = 'ai'
          AND status = 'dismissed'
    )
    -- 이전 active AI 추천은 제거되어야 합니다.
    AND NOT EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_replace_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_replace_old_ai_id')::uuid
    )
    -- 새로운 AI 추천은 active 상태로 저장되어야 합니다.
    AND EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_replace_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_replace_new_ai_id')::uuid
          AND origin = 'ai'
          AND status = 'active'
    ),
    'RPC should replace only active AI relationships while preserving manual and dismissed relationships'
);


-- ============================================================================
-- 2. Replace Active AI Related Notes RPC Atomicity
-- ============================================================================

/*
 * 새 추천 저장 중 오류가 발생하면 함수 호출 전체가 rollback되어야 합니다.
 *
 * 잘못된 relatedNoteId를 전달해 INSERT를 실패시키고,
 * 함수 초반에 삭제된 기존 active AI 추천이 트랜잭션 rollback으로
 * 다시 유지되는지 확인합니다.
 */
SELECT set_config(
    'test.related_notes_atomic_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_atomic_existing_id',
    gen_random_uuid()::text,
    true
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
        current_setting('test.related_notes_atomic_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Atomic Source',
        'Atomic Source Content',
        0
    ),
    (
        current_setting('test.related_notes_atomic_existing_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Atomic Existing AI',
        'Atomic Existing AI Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_atomic_source_id')::uuid,
    current_setting('test.related_notes_atomic_existing_id')::uuid,
    'ai',
    'active'
);

/*
 * 함수 내부 오류를 잡은 뒤 기존 추천이 사라졌다면 예외를 발생시킵니다.
 *
 * plpgsql의 EXCEPTION block은 오류가 발생한 block의 DB 변경을 rollback하므로,
 * RPC 내부 DELETE와 실패한 INSERT가 모두 취소되는지 한 assertion으로 검증합니다.
 */
SELECT lives_ok(
    format(
        $sql$
            DO $block$
            BEGIN
                BEGIN
                    PERFORM public.replace_note_related_ai_recommendations(
                        '%s'::uuid,
                        '[{"relatedNoteId":"not-a-uuid","metadata":{}}]'::jsonb
                    );

                    RAISE EXCEPTION
                        'Expected replace_note_related_ai_recommendations to fail';
                EXCEPTION
                    WHEN invalid_text_representation THEN
                        NULL;
                END;

                IF NOT EXISTS (
                    SELECT 1
                    FROM public.note_related_notes
                    WHERE note_id = '%s'::uuid
                      AND related_note_id = '%s'::uuid
                      AND origin = 'ai'
                      AND status = 'active'
                ) THEN
                    RAISE EXCEPTION
                        'Existing active AI relationship was not rolled back';
                END IF;
            END;
            $block$;
        $sql$,
        current_setting('test.related_notes_atomic_source_id'),
        current_setting('test.related_notes_atomic_source_id'),
        current_setting('test.related_notes_atomic_existing_id')
    ),
    'RPC should roll back the previous active AI deletion when inserting new recommendations fails'
);


SELECT * FROM finish();

ROLLBACK;