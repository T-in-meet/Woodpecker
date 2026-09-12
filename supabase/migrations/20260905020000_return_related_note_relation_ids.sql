-- Related Notes replacement가 같은 transaction에서 저장한 relation UUID를 반환한다.

DROP FUNCTION "public"."replace_note_related_ai_recommendations"(uuid, uuid, timestamp with time zone, jsonb);

/** active AI Related Notes를 교체하고 이번 호출이 저장한 relation UUID를 반환한다. */
CREATE FUNCTION "public"."replace_note_related_ai_recommendations"(
    "p_note_id" uuid,
    "p_owner_user_id" uuid,
    "p_source_updated_at" timestamp with time zone,
    "p_recommendations" jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    "v_current_source_updated_at" timestamp with time zone;
    "v_recommendation_count" integer;
    "v_valid_target_count" integer;
    "v_relation_ids" uuid[] := ARRAY[]::uuid[];
BEGIN
    -- 기존 payload array validation을 그대로 유지한다.
    IF jsonb_typeof("p_recommendations") <> 'array' THEN
        RAISE EXCEPTION 'RELATED_NOTE_RECOMMENDATIONS_MUST_BE_ARRAY'
            USING ERRCODE = '22023';
    END IF;

    -- 소유권과 source version을 쓰기 전에 잠근 상태로 확인한다.
    SELECT "updated_at" INTO "v_current_source_updated_at"
    FROM "public"."notes"
    WHERE "id" = "p_note_id" AND "user_id" = "p_owner_user_id"
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'source_not_found', 'relationIds', '[]'::jsonb);
    END IF;

    IF "v_current_source_updated_at" IS DISTINCT FROM "p_source_updated_at" THEN
        RETURN jsonb_build_object('status', 'stale', 'relationIds', '[]'::jsonb);
    END IF;

    -- 각 추천 target의 필수 값과 UUID 형식을 기존 계약대로 검증한다.
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements("p_recommendations") AS "items"("recommendation")
        WHERE jsonb_typeof("recommendation") <> 'object'
           OR NULLIF(btrim("recommendation" ->> 'relatedNoteId'), '') IS NULL
    ) THEN
        RAISE EXCEPTION 'RELATED_NOTE_AI_RECOMMENDATION_TARGET_INVALID'
            USING ERRCODE = '22023';
    END IF;

    PERFORM ("recommendation" ->> 'relatedNoteId')::uuid
    FROM jsonb_array_elements("p_recommendations") AS "items"("recommendation");

    SELECT count(*) INTO "v_recommendation_count"
    FROM jsonb_array_elements("p_recommendations");

    SELECT count(*) INTO "v_valid_target_count"
    FROM jsonb_array_elements("p_recommendations") AS "items"("recommendation")
    INNER JOIN "public"."notes" AS "target_note"
      ON "target_note"."id" = ("recommendation" ->> 'relatedNoteId')::uuid
     AND "target_note"."user_id" = "p_owner_user_id";

    IF "v_recommendation_count" <> "v_valid_target_count" THEN
        RAISE EXCEPTION 'RELATED_NOTE_AI_RECOMMENDATION_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- 삭제 및 삽입 대상 unordered pair를 동일한 정렬 순서로 잠근다.
    PERFORM "public"."lock_note_related_note_pair"("locks"."note_id", "locks"."related_note_id")
    FROM (
        SELECT DISTINCT
            least("existing_relation"."note_id", "existing_relation"."related_note_id") AS "pair_min_id",
            greatest("existing_relation"."note_id", "existing_relation"."related_note_id") AS "pair_max_id",
            "existing_relation"."note_id", "existing_relation"."related_note_id"
        FROM "public"."note_related_notes" AS "existing_relation"
        WHERE ("existing_relation"."note_id" = "p_note_id" OR "existing_relation"."related_note_id" = "p_note_id")
          AND "existing_relation"."origin" = 'ai'
          AND "existing_relation"."status" = 'active'
        UNION
        SELECT DISTINCT
            least("p_note_id", "target_note"."id"),
            greatest("p_note_id", "target_note"."id"),
            "p_note_id", "target_note"."id"
        FROM jsonb_array_elements("p_recommendations") AS "items"("recommendation")
        INNER JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" = ("recommendation" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "p_owner_user_id"
    ) AS "locks"
    ORDER BY "locks"."pair_min_id", "locks"."pair_max_id";

    DELETE FROM "public"."note_related_notes"
    WHERE ("note_id" = "p_note_id" OR "related_note_id" = "p_note_id")
      AND "origin" = 'ai' AND "status" = 'active';

    -- 같은 INSERT RETURNING에서 이번 호출이 실제 저장한 UUID만 수집한다.
    WITH "inserted" AS (
        INSERT INTO "public"."note_related_notes" (
            "note_id", "related_note_id", "origin", "status", "metadata"
        )
        SELECT "p_note_id", "target_note"."id", 'ai', 'active',
               COALESCE("recommendation" -> 'metadata', '{}'::jsonb)
        FROM jsonb_array_elements("p_recommendations") AS "items"("recommendation")
        INNER JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" = ("recommendation" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "p_owner_user_id"
        ON CONFLICT DO NOTHING
        RETURNING "id"
    )
    SELECT COALESCE(array_agg("id"), ARRAY[]::uuid[])
    INTO "v_relation_ids"
    FROM "inserted";

    RETURN jsonb_build_object(
        'status', 'replaced',
        'relationIds', to_jsonb("v_relation_ids")
    );
END;
$$;

COMMENT ON FUNCTION "public"."replace_note_related_ai_recommendations"(uuid, uuid, timestamp with time zone, jsonb)
IS 'active AI Related Notes를 원자적으로 교체하고 이번 호출이 저장한 relation UUID를 반환합니다.';

REVOKE ALL ON FUNCTION "public"."replace_note_related_ai_recommendations"(uuid, uuid, timestamp with time zone, jsonb)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."replace_note_related_ai_recommendations"(uuid, uuid, timestamp with time zone, jsonb)
TO "service_role";
