BEGIN;

SELECT plan(12);


-- ============================================================================
-- Test Fixtures
-- ============================================================================

SELECT set_config(
    'test.related_notes_replace_user_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_replace_foreign_user_id',
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
        current_setting('test.related_notes_replace_user_id')::uuid,
        'related-notes-replace@example.com',
        '{}'::jsonb
    ),
    (
        current_setting('test.related_notes_replace_foreign_user_id')::uuid,
        'related-notes-replace-foreign@example.com',
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

SELECT is(
    public.replace_note_related_ai_recommendations(
        current_setting('test.related_notes_replace_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id =
                current_setting('test.related_notes_replace_source_id')::uuid
        ),
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
    ),
    'replaced',
    'RPC should return replaced when active AI recommendations are updated'
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
                        '%s'::uuid,
                        (
                            SELECT updated_at
                            FROM public.notes
                            WHERE id = '%s'::uuid
                        ),
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
        current_setting('test.related_notes_replace_user_id'),
        current_setting('test.related_notes_atomic_source_id'),
        current_setting('test.related_notes_atomic_source_id'),
        current_setting('test.related_notes_atomic_existing_id')
    ),
    'RPC should roll back the previous active AI deletion when inserting new recommendations fails'
);


-- ============================================================================
-- 3. Ignore Stale AI Related Note Recommendations
-- ============================================================================

/*
 * 추천 생성에 사용한 Note snapshot의 updated_at이 현재 Note와 다르면
 * 해당 추천 결과는 stale 상태이므로 저장하지 않아야 합니다.
 *
 * stale 추천으로 인해 기존 active AI 추천이 삭제되거나
 * 새로운 AI 추천이 삽입되지 않는지 함께 확인합니다.
 */
SELECT set_config(
    'test.related_notes_stale_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_stale_existing_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_stale_new_id',
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
        current_setting('test.related_notes_stale_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Stale Source',
        'Stale Source Content',
        0
    ),
    (
        current_setting('test.related_notes_stale_existing_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Stale Existing AI',
        'Stale Existing AI Content',
        0
    ),
    (
        current_setting('test.related_notes_stale_new_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Stale New AI',
        'Stale New AI Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_stale_source_id')::uuid,
    current_setting('test.related_notes_stale_existing_id')::uuid,
    'ai',
    'active'
);

/*
 * 현재 updated_at보다 과거 timestamp를 전달하여
 * 이미 오래된 Note snapshot에서 생성된 추천 결과를 재현합니다.
 */
SELECT is(
    public.replace_note_related_ai_recommendations(
        current_setting('test.related_notes_stale_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        (
            SELECT updated_at - interval '1 second'
            FROM public.notes
            WHERE id =
                current_setting('test.related_notes_stale_source_id')::uuid
        ),
        jsonb_build_array(
            jsonb_build_object(
                'relatedNoteId',
                current_setting('test.related_notes_stale_new_id'),
                'metadata',
                jsonb_build_object('reason', 'stale recommendation')
            )
        )
    ),
    'stale',
    'RPC should return stale when the source note changed after recommendation generation'
);

SELECT ok(
    -- stale 실행 이전의 active AI 추천은 그대로 유지되어야 합니다.
    EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_stale_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_stale_existing_id')::uuid
          AND origin = 'ai'
          AND status = 'active'
    )
    -- stale 실행에서 전달한 새로운 추천은 저장되지 않아야 합니다.
    AND NOT EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_stale_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_stale_new_id')::uuid
    ),
    'RPC should ignore stale AI recommendations and preserve existing active relationships'
);


-- ============================================================================
-- 4. Ignore Source Owner Mismatch
-- ============================================================================

/*
 * service_role 경로에서 잘못된 owner가 전달되면 source Note를 찾지 못한
 * 비동기 경합과 동일하게 아무 관계도 변경하지 않아야 합니다.
 */
SELECT set_config(
    'test.related_notes_source_owner_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_source_owner_existing_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_source_owner_new_id',
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
        current_setting('test.related_notes_source_owner_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Source Owner Source',
        'Source Owner Source Content',
        0
    ),
    (
        current_setting('test.related_notes_source_owner_existing_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Source Owner Existing AI',
        'Source Owner Existing AI Content',
        0
    ),
    (
        current_setting('test.related_notes_source_owner_new_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Source Owner New AI',
        'Source Owner New AI Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_source_owner_source_id')::uuid,
    current_setting('test.related_notes_source_owner_existing_id')::uuid,
    'ai',
    'active'
);

SELECT is(
    public.replace_note_related_ai_recommendations(
        current_setting('test.related_notes_source_owner_source_id')::uuid,
        current_setting('test.related_notes_replace_foreign_user_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id =
                current_setting('test.related_notes_source_owner_source_id')::uuid
        ),
        jsonb_build_array(
            jsonb_build_object(
                'relatedNoteId',
                current_setting('test.related_notes_source_owner_new_id'),
                'metadata',
                jsonb_build_object('reason', 'wrong owner recommendation')
            )
        )
    ),
    'source_not_found',
    'RPC should return source_not_found when source note does not belong to the supplied owner'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_source_owner_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_source_owner_existing_id')::uuid
          AND origin = 'ai'
          AND status = 'active'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_source_owner_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_source_owner_new_id')::uuid
    ),
    'RPC should ignore calls when source note does not belong to the supplied owner'
);


-- ============================================================================
-- 5. Reject Foreign Target Notes
-- ============================================================================

/*
 * payload에 다른 사용자 소유 target Note가 포함되면 service_role RPC라도
 * 저장을 거부하고 기존 active AI 관계를 보존해야 합니다.
 */
SELECT set_config(
    'test.related_notes_foreign_target_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_foreign_target_existing_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_foreign_target_id',
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
        current_setting('test.related_notes_foreign_target_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Foreign Target Source',
        'Foreign Target Source Content',
        0
    ),
    (
        current_setting('test.related_notes_foreign_target_existing_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Foreign Target Existing AI',
        'Foreign Target Existing AI Content',
        0
    ),
    (
        current_setting('test.related_notes_foreign_target_id')::uuid,
        current_setting('test.related_notes_replace_foreign_user_id')::uuid,
        'Foreign Target',
        'Foreign Target Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_foreign_target_source_id')::uuid,
    current_setting('test.related_notes_foreign_target_existing_id')::uuid,
    'ai',
    'active'
);

SELECT lives_ok(
    format(
        $sql$
            DO $block$
            BEGIN
                BEGIN
                    PERFORM public.replace_note_related_ai_recommendations(
                        '%s'::uuid,
                        '%s'::uuid,
                        (
                            SELECT updated_at
                            FROM public.notes
                            WHERE id = '%s'::uuid
                        ),
                        jsonb_build_array(
                            jsonb_build_object(
                                'relatedNoteId',
                                '%s',
                                'metadata',
                                jsonb_build_object(
                                    'reason',
                                    'foreign target recommendation'
                                )
                            )
                        )
                    );

                    RAISE EXCEPTION
                        'Expected replace_note_related_ai_recommendations to fail';
                EXCEPTION
                    WHEN no_data_found THEN
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
                        'Existing active AI relationship was not preserved';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM public.note_related_notes
                    WHERE note_id = '%s'::uuid
                      AND related_note_id = '%s'::uuid
                ) THEN
                    RAISE EXCEPTION
                        'Foreign target relationship was inserted';
                END IF;
            END;
            $block$;
        $sql$,
        current_setting('test.related_notes_foreign_target_source_id'),
        current_setting('test.related_notes_replace_user_id'),
        current_setting('test.related_notes_foreign_target_source_id'),
        current_setting('test.related_notes_foreign_target_id'),
        current_setting('test.related_notes_foreign_target_source_id'),
        current_setting('test.related_notes_foreign_target_existing_id'),
        current_setting('test.related_notes_foreign_target_source_id'),
        current_setting('test.related_notes_foreign_target_id')
    ),
    'RPC should reject foreign target notes and preserve existing active relationships'
);


-- ============================================================================
-- 6. Replace Reverse Active AI With Empty Recommendations
-- ============================================================================

/*
 * 현재 Note가 related_note_id 쪽에 있는 active AI 관계도 현재 Note 기준
 * 추천 재실행의 재평가 대상이므로, 빈 추천 결과에서는 제거되어야 합니다.
 */
SELECT set_config(
    'test.related_notes_reverse_empty_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_reverse_empty_target_id',
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
        current_setting('test.related_notes_reverse_empty_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Reverse Empty Source',
        'Reverse Empty Source Content',
        0
    ),
    (
        current_setting('test.related_notes_reverse_empty_target_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Reverse Empty Target',
        'Reverse Empty Target Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_reverse_empty_target_id')::uuid,
    current_setting('test.related_notes_reverse_empty_source_id')::uuid,
    'ai',
    'active'
);

SELECT is(
    public.replace_note_related_ai_recommendations(
        current_setting('test.related_notes_reverse_empty_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id =
                current_setting('test.related_notes_reverse_empty_source_id')::uuid
        ),
        '[]'::jsonb
    ),
    'replaced',
    'RPC should replace reverse active AI relationships with an empty recommendation set'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.note_related_notes
        WHERE least(note_id, related_note_id) =
                least(
                    current_setting('test.related_notes_reverse_empty_source_id')::uuid,
                    current_setting('test.related_notes_reverse_empty_target_id')::uuid
                )
          AND greatest(note_id, related_note_id) =
                greatest(
                    current_setting('test.related_notes_reverse_empty_source_id')::uuid,
                    current_setting('test.related_notes_reverse_empty_target_id')::uuid
                )
    ),
    0::bigint,
    'reverse active AI relationship should be removed when it is no longer recommended'
);


-- ============================================================================
-- 7. Replace Reverse Active AI With Current Recommendation
-- ============================================================================

/*
 * 반대 방향 active AI 관계가 다시 추천되면 중복 row를 만들지 않고,
 * 현재 Note 기준 방향의 active AI 관계 하나만 남아야 합니다.
 */
SELECT set_config(
    'test.related_notes_reverse_keep_source_id',
    gen_random_uuid()::text,
    true
);

SELECT set_config(
    'test.related_notes_reverse_keep_target_id',
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
        current_setting('test.related_notes_reverse_keep_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Reverse Keep Source',
        'Reverse Keep Source Content',
        0
    ),
    (
        current_setting('test.related_notes_reverse_keep_target_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        'Reverse Keep Target',
        'Reverse Keep Target Content',
        0
    );

INSERT INTO public.note_related_notes (
    note_id,
    related_note_id,
    origin,
    status
)
VALUES (
    current_setting('test.related_notes_reverse_keep_target_id')::uuid,
    current_setting('test.related_notes_reverse_keep_source_id')::uuid,
    'ai',
    'active'
);

SELECT is(
    public.replace_note_related_ai_recommendations(
        current_setting('test.related_notes_reverse_keep_source_id')::uuid,
        current_setting('test.related_notes_replace_user_id')::uuid,
        (
            SELECT updated_at
            FROM public.notes
            WHERE id =
                current_setting('test.related_notes_reverse_keep_source_id')::uuid
        ),
        jsonb_build_array(
            jsonb_build_object(
                'relatedNoteId',
                current_setting('test.related_notes_reverse_keep_target_id'),
                'metadata',
                jsonb_build_object('reason', 'still related')
            )
        )
    ),
    'replaced',
    'RPC should replace reverse active AI relationships with current-direction recommendations'
);

SELECT ok(
    (
        SELECT count(*) = 1
        FROM public.note_related_notes
        WHERE least(note_id, related_note_id) =
                least(
                    current_setting('test.related_notes_reverse_keep_source_id')::uuid,
                    current_setting('test.related_notes_reverse_keep_target_id')::uuid
                )
          AND greatest(note_id, related_note_id) =
                greatest(
                    current_setting('test.related_notes_reverse_keep_source_id')::uuid,
                    current_setting('test.related_notes_reverse_keep_target_id')::uuid
                )
    )
    AND EXISTS (
        SELECT 1
        FROM public.note_related_notes
        WHERE note_id =
                current_setting('test.related_notes_reverse_keep_source_id')::uuid
          AND related_note_id =
                current_setting('test.related_notes_reverse_keep_target_id')::uuid
          AND origin = 'ai'
          AND status = 'active'
          AND metadata = jsonb_build_object('reason', 'still related')
    ),
    'reverse active AI should be replaced by one current-direction active AI relationship'
);


SELECT * FROM finish();

ROLLBACK;
