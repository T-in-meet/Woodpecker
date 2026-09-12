BEGIN;

-- ============================================================================
-- Remove AI Runs cron jobs
-- ============================================================================

-- 함수와 ai_runs 테이블을 제거하기 전에 해당 함수를 호출하는 cron job부터 해제한다.
SELECT cron.unschedule('cleanup-stale-ai-run-cron-history');
SELECT cron.unschedule('sweep-stale-ai-runs');


-- ============================================================================
-- Remove AI Runs functions
-- ============================================================================

DROP FUNCTION public.cleanup_stale_ai_run_cron_history();

DROP FUNCTION public.sweep_stale_ai_runs();

DROP FUNCTION public.finalize_ai_run(
    uuid,
    uuid,
    text,
    timestamptz,
    text,
    timestamptz,
    jsonb,
    uuid[]
);


-- ============================================================================
-- Remove AI Runs table
-- ============================================================================

DROP TABLE public.ai_runs;


-- ============================================================================
-- Restore Related Notes replacement RPC contract
-- ============================================================================

-- 20260905020000_return_related_note_relation_ids.sql에서
-- text 반환을 jsonb { status, relationIds }로 변경했으므로
-- AI Runs 제거 후 기존 text 상태 반환 계약으로 되돌린다.

DROP FUNCTION public.replace_note_related_ai_recommendations(
    uuid,
    uuid,
    timestamp with time zone,
    jsonb
);

CREATE FUNCTION public.replace_note_related_ai_recommendations(
    p_note_id uuid,
    p_owner_user_id uuid,
    p_source_updated_at timestamp with time zone,
    p_recommendations jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_current_source_updated_at timestamp with time zone;
    v_recommendation_count integer;
    v_valid_target_count integer;
BEGIN
    IF jsonb_typeof(p_recommendations) <> 'array' THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RECOMMENDATIONS_MUST_BE_ARRAY'
            USING ERRCODE = '22023';
    END IF;

    SELECT updated_at
    INTO v_current_source_updated_at
    FROM public.notes
    WHERE id = p_note_id
      AND user_id = p_owner_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'source_not_found';
    END IF;

    IF v_current_source_updated_at IS DISTINCT FROM p_source_updated_at THEN
        RETURN 'stale';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_recommendations)
            AS items(recommendation)
        WHERE jsonb_typeof(recommendation) <> 'object'
           OR NULLIF(btrim(recommendation ->> 'relatedNoteId'), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AI_RECOMMENDATION_TARGET_INVALID'
            USING ERRCODE = '22023';
    END IF;

    BEGIN
        PERFORM
            (recommendation ->> 'relatedNoteId')::uuid
        FROM jsonb_array_elements(p_recommendations)
            AS items(recommendation);
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE;
    END;

    SELECT count(*)
    INTO v_recommendation_count
    FROM jsonb_array_elements(p_recommendations);

    SELECT count(*)
    INTO v_valid_target_count
    FROM jsonb_array_elements(p_recommendations)
        AS items(recommendation)
    INNER JOIN public.notes AS target_note
      ON target_note.id = (recommendation ->> 'relatedNoteId')::uuid
     AND target_note.user_id = p_owner_user_id;

    IF v_recommendation_count <> v_valid_target_count THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AI_RECOMMENDATION_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.lock_note_related_note_pair(
        locks.note_id,
        locks.related_note_id
    )
    FROM (
        SELECT DISTINCT
            least(
                existing_relation.note_id,
                existing_relation.related_note_id
            ) AS pair_min_id,
            greatest(
                existing_relation.note_id,
                existing_relation.related_note_id
            ) AS pair_max_id,
            existing_relation.note_id,
            existing_relation.related_note_id
        FROM public.note_related_notes AS existing_relation
        WHERE (
                existing_relation.note_id = p_note_id
                OR existing_relation.related_note_id = p_note_id
            )
          AND existing_relation.origin = 'ai'
          AND existing_relation.status = 'active'

        UNION

        SELECT DISTINCT
            least(p_note_id, target_note.id) AS pair_min_id,
            greatest(p_note_id, target_note.id) AS pair_max_id,
            p_note_id AS note_id,
            target_note.id AS related_note_id
        FROM jsonb_array_elements(p_recommendations)
            AS items(recommendation)
        INNER JOIN public.notes AS target_note
          ON target_note.id = (recommendation ->> 'relatedNoteId')::uuid
         AND target_note.user_id = p_owner_user_id
    ) AS locks
    ORDER BY
        locks.pair_min_id,
        locks.pair_max_id;

    DELETE FROM public.note_related_notes
    WHERE (
            note_id = p_note_id
            OR related_note_id = p_note_id
        )
      AND origin = 'ai'
      AND status = 'active';

    INSERT INTO public.note_related_notes (
        note_id,
        related_note_id,
        origin,
        status,
        metadata
    )
    SELECT
        p_note_id,
        target_note.id,
        'ai',
        'active',
        COALESCE(
            recommendation -> 'metadata',
            '{}'::jsonb
        )
    FROM jsonb_array_elements(p_recommendations)
        AS items(recommendation)
    INNER JOIN public.notes AS target_note
      ON target_note.id = (recommendation ->> 'relatedNoteId')::uuid
     AND target_note.user_id = p_owner_user_id
    ON CONFLICT DO NOTHING;

    RETURN 'replaced';
END;
$$;

COMMENT ON FUNCTION public.replace_note_related_ai_recommendations(
    uuid,
    uuid,
    timestamp with time zone,
    jsonb
)
IS
    '지정한 Note와 연결된 active AI Related Notes를 pair lock을 획득한 뒤 저장 방향과 관계없이 재평가 결과로 원자적으로 교체합니다.';

REVOKE ALL
ON FUNCTION public.replace_note_related_ai_recommendations(
    uuid,
    uuid,
    timestamp with time zone,
    jsonb
)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.replace_note_related_ai_recommendations(
    uuid,
    uuid,
    timestamp with time zone,
    jsonb
)
TO service_role;


-- ============================================================================
-- Restore Quiz finalizer RPC contract
-- ============================================================================

-- 20260905010000_return_quiz_id_from_finalizer.sql에서
-- text 반환을 jsonb { status, quizId }로 변경했으므로
-- 기존 text 상태 반환 계약으로 되돌린다.

DROP FUNCTION public.finalize_quiz_generation_v2(
    uuid,
    uuid,
    text,
    uuid,
    jsonb,
    jsonb,
    text
);

CREATE FUNCTION public.finalize_quiz_generation_v2(
    p_user_id uuid,
    p_note_id uuid,
    p_quiz_type text,
    p_claim_token uuid,
    p_questions jsonb,
    p_history jsonb,
    p_content_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_created_at timestamptz;
    v_completed_at timestamptz;
    v_result text;
BEGIN
    IF p_user_id IS NULL OR p_claim_token IS NULL THEN
        RETURN 'not_found';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    SELECT g.id, g.created_at, g.completed_at
    INTO v_id, v_created_at, v_completed_at
    FROM public.quiz_generations g
    WHERE g.user_id = p_user_id
      AND g.note_id = p_note_id
      AND g.quiz_type = p_quiz_type
      AND g.claim_token = p_claim_token;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.quiz_generations g
        WHERE g.user_id = p_user_id
          AND g.note_id = p_note_id
          AND g.quiz_type = p_quiz_type
          AND g.created_at > v_created_at
    ) THEN
        RETURN 'stale_claim';
    END IF;

    IF v_completed_at IS NOT NULL THEN
        v_result := 'already_completed';
    ELSE
        UPDATE public.quiz_generations
        SET completed_at = now()
        WHERE id = v_id;

        v_result := 'ok';
    END IF;

    INSERT INTO public.quizzes (
        note_id,
        user_id,
        quiz_type,
        questions,
        recent_questions,
        note_content_hash
    )
    VALUES (
        p_note_id,
        p_user_id,
        p_quiz_type,
        p_questions,
        p_history,
        p_content_hash
    )
    ON CONFLICT (note_id, quiz_type) DO UPDATE
    SET questions = excluded.questions,
        recent_questions = excluded.recent_questions,
        note_content_hash = excluded.note_content_hash,
        user_id = excluded.user_id;

    RETURN v_result;
END;
$$;

REVOKE ALL
ON FUNCTION public.finalize_quiz_generation_v2(
    uuid,
    uuid,
    text,
    uuid,
    jsonb,
    jsonb,
    text
)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.finalize_quiz_generation_v2(
    uuid,
    uuid,
    text,
    uuid,
    jsonb,
    jsonb,
    text
)
TO service_role;


-- ============================================================================
-- Restore Review Grading finalizer RPC contract
-- ============================================================================

-- 20260903030000_return_review_grading_id_from_finalizer.sql에서
-- text 반환을 jsonb { status, gradingId }로 변경했으므로
-- 기존 text 상태 반환 계약으로 되돌린다.

DROP FUNCTION public.finalize_review_grading(
    uuid,
    uuid,
    uuid,
    integer,
    jsonb
);

CREATE FUNCTION public.finalize_review_grading(
    p_user_id uuid,
    p_review_log_id uuid,
    p_claim_token uuid,
    p_score integer,
    p_feedback jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_score integer;
    v_existing_claim_token uuid;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN 'not_found';
    END IF;

    IF p_score IS NULL OR p_score < 0 OR p_score > 100 THEN
        RAISE EXCEPTION 'invalid score' USING ERRCODE = '22023';
    END IF;

    IF p_feedback IS NULL
       OR (
            jsonb_typeof(p_feedback) = 'object'
            AND jsonb_typeof(p_feedback -> 'summary') = 'string'
            AND jsonb_typeof(p_feedback -> 'missedConcepts') = 'array'
            AND jsonb_typeof(p_feedback -> 'incorrectPoints') = 'array'
            AND NOT jsonb_path_exists(
                p_feedback,
                '$.missedConcepts[*] ? (@.type() != "string")'
            )
            AND NOT jsonb_path_exists(
                p_feedback,
                '$.incorrectPoints[*] ? (@.type() != "string")'
            )
       ) IS NOT TRUE
    THEN
        RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_review_log_id::text));

    SELECT g.score, g.claim_token
    INTO v_existing_score, v_existing_claim_token
    FROM public.review_gradings g
    WHERE g.review_log_id = p_review_log_id
      AND g.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF v_existing_score IS NOT NULL THEN
        RETURN 'already_graded';
    END IF;

    IF p_claim_token IS NULL
       OR v_existing_claim_token IS DISTINCT FROM p_claim_token
    THEN
        RETURN 'stale_claim';
    END IF;

    UPDATE public.review_gradings
    SET score = p_score,
        feedback = p_feedback
    WHERE review_log_id = p_review_log_id
      AND user_id = p_user_id;

    RETURN 'ok';
END;
$$;

REVOKE ALL
ON FUNCTION public.finalize_review_grading(
    uuid,
    uuid,
    uuid,
    integer,
    jsonb
)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.finalize_review_grading(
    uuid,
    uuid,
    uuid,
    integer,
    jsonb
)
TO service_role;

COMMIT;
