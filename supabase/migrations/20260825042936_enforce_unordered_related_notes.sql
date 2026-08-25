-- ============================================================================
-- Enforce Unordered Related Notes
-- ============================================================================

/*
 * Related Notes는 조회와 저장 모두에서 Note pair의 방향을 의미로 보지 않습니다.
 * 기존에 양방향 duplicate row가 있으면 우선순위가 높은 row만 남긴 뒤,
 * unordered pair unique index로 이후 중복 생성을 차단합니다.
 */
WITH "ranked_related_notes" AS (
    SELECT
        "ctid",
        row_number() OVER (
            PARTITION BY
                least("note_id", "related_note_id"),
                greatest("note_id", "related_note_id")
            ORDER BY
                CASE
                    WHEN "origin" = 'manual'
                         AND "status" = 'active'
                        THEN 1
                    WHEN "origin" = 'ai'
                         AND "status" = 'dismissed'
                        THEN 2
                    WHEN "origin" = 'ai'
                         AND "status" = 'active'
                        THEN 3
                    ELSE 4
                END,
                "updated_at" DESC,
                "created_at" DESC,
                "note_id",
                "related_note_id"
        ) AS "duplicate_rank"
    FROM "public"."note_related_notes"
)
DELETE FROM "public"."note_related_notes" AS "relation"
USING "ranked_related_notes" AS "ranked"
WHERE "relation"."ctid" = "ranked"."ctid"
  AND "ranked"."duplicate_rank" > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "note_related_notes_unordered_pair_uidx"
    ON "public"."note_related_notes" (
        least("note_id", "related_note_id"),
        greatest("note_id", "related_note_id")
    );

COMMENT ON INDEX "public"."note_related_notes_unordered_pair_uidx" IS
    'Note pair의 저장 방향과 관계없이 Related Notes 관계가 하나만 존재하도록 보장합니다.';


-- ============================================================================
-- Lock Related Note Pairs During Writes
-- ============================================================================

/*
 * Related Notes는 unordered Note pair 단위로 하나의 관계만 유지합니다.
 * manual 추가와 AI 추천 교체가 같은 pair를 동시에 쓰더라도 동일한
 * transaction advisory lock key를 사용하도록 공통 helper를 둡니다.
 */
CREATE OR REPLACE FUNCTION "public"."lock_note_related_note_pair"(
    "p_note_id" uuid,
    "p_related_note_id" uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT "pg_catalog"."pg_advisory_xact_lock"(
        "pg_catalog"."hashtextextended"(
            least("p_note_id"::text, "p_related_note_id"::text)
                || ':'
                || greatest("p_note_id"::text, "p_related_note_id"::text),
            0
        )
    );
$$;

COMMENT ON FUNCTION
    "public"."lock_note_related_note_pair"(uuid, uuid)
IS
    'Related Notes unordered Note pair에 대한 transaction advisory lock을 획득합니다.';

REVOKE ALL
ON FUNCTION "public"."lock_note_related_note_pair"(uuid, uuid)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION "public"."lock_note_related_note_pair"(uuid, uuid)
TO "service_role";


-- ============================================================================
-- Replace Active AI Related Notes
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."replace_note_related_ai_recommendations"(
    "p_note_id" uuid,
    "p_owner_user_id" uuid,
    "p_source_updated_at" timestamp with time zone,
    "p_recommendations" jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    "v_current_source_updated_at" timestamp with time zone;
    "v_recommendation_count" integer;
    "v_valid_target_count" integer;
BEGIN
    IF jsonb_typeof("p_recommendations") <> 'array' THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RECOMMENDATIONS_MUST_BE_ARRAY'
            USING ERRCODE = '22023';
    END IF;

    SELECT "updated_at"
    INTO "v_current_source_updated_at"
    FROM "public"."notes"
    WHERE "id" = "p_note_id"
      AND "user_id" = "p_owner_user_id"
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'source_not_found';
    END IF;

    IF "v_current_source_updated_at" IS DISTINCT FROM "p_source_updated_at" THEN
        RETURN 'stale';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_recommendations")
            AS "items"("recommendation")
        WHERE jsonb_typeof("recommendation") <> 'object'
           OR NULLIF(btrim("recommendation" ->> 'relatedNoteId'), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AI_RECOMMENDATION_TARGET_INVALID'
            USING ERRCODE = '22023';
    END IF;

    BEGIN
        PERFORM
            ("recommendation" ->> 'relatedNoteId')::uuid
        FROM jsonb_array_elements("p_recommendations")
            AS "items"("recommendation");
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE;
    END;

    SELECT count(*)
    INTO "v_recommendation_count"
    FROM jsonb_array_elements("p_recommendations");

    SELECT count(*)
    INTO "v_valid_target_count"
    FROM jsonb_array_elements("p_recommendations")
        AS "items"("recommendation")
    INNER JOIN "public"."notes" AS "target_note"
      ON "target_note"."id" = ("recommendation" ->> 'relatedNoteId')::uuid
     AND "target_note"."user_id" = "p_owner_user_id";

    IF "v_recommendation_count" <> "v_valid_target_count" THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AI_RECOMMENDATION_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * delete 대상인 기존 active AI pair와 insert 대상인 새 추천 pair를
     * 같은 key 계산 helper로 잠급니다. lock 획득 순서를 정렬하여
     * 서로 다른 추천 payload 간 deadlock 가능성을 낮춥니다.
     */
    PERFORM "public"."lock_note_related_note_pair"(
        "locks"."note_id",
        "locks"."related_note_id"
    )
    FROM (
        SELECT DISTINCT
            least(
                "existing_relation"."note_id",
                "existing_relation"."related_note_id"
            ) AS "pair_min_id",
            greatest(
                "existing_relation"."note_id",
                "existing_relation"."related_note_id"
            ) AS "pair_max_id",
            "existing_relation"."note_id",
            "existing_relation"."related_note_id"
        FROM "public"."note_related_notes" AS "existing_relation"
        WHERE (
                "existing_relation"."note_id" = "p_note_id"
                OR "existing_relation"."related_note_id" = "p_note_id"
            )
          AND "existing_relation"."origin" = 'ai'
          AND "existing_relation"."status" = 'active'

        UNION

        SELECT DISTINCT
            least("p_note_id", "target_note"."id") AS "pair_min_id",
            greatest("p_note_id", "target_note"."id") AS "pair_max_id",
            "p_note_id" AS "note_id",
            "target_note"."id" AS "related_note_id"
        FROM jsonb_array_elements("p_recommendations")
            AS "items"("recommendation")
        INNER JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" =
                ("recommendation" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "p_owner_user_id"
    ) AS "locks"
    ORDER BY
        "locks"."pair_min_id",
        "locks"."pair_max_id";

    DELETE FROM "public"."note_related_notes"
    WHERE (
            "note_id" = "p_note_id"
            OR "related_note_id" = "p_note_id"
        )
      AND "origin" = 'ai'
      AND "status" = 'active';

    INSERT INTO "public"."note_related_notes" (
        "note_id",
        "related_note_id",
        "origin",
        "status",
        "metadata"
    )
    SELECT
        "p_note_id",
        "target_note"."id",
        'ai',
        'active',
        COALESCE(
            "recommendation" -> 'metadata',
            '{}'::jsonb
        )
    FROM jsonb_array_elements("p_recommendations")
        AS "items"("recommendation")
    INNER JOIN "public"."notes" AS "target_note"
      ON "target_note"."id" = ("recommendation" ->> 'relatedNoteId')::uuid
     AND "target_note"."user_id" = "p_owner_user_id"
    WHERE NOT EXISTS (
        SELECT 1
        FROM "public"."note_related_notes" AS "existing_relation"
        WHERE (
                (
                    "existing_relation"."note_id" = "p_note_id"
                    AND "existing_relation"."related_note_id" =
                        "target_note"."id"
                )
                OR (
                    "existing_relation"."note_id" = "target_note"."id"
                    AND "existing_relation"."related_note_id" =
                        "p_note_id"
                )
            )
    )
    ON CONFLICT DO NOTHING;

    RETURN 'replaced';
END;
$$;

COMMENT ON FUNCTION
    "public"."replace_note_related_ai_recommendations"(
        uuid,
        uuid,
        timestamp with time zone,
        jsonb
    )
IS
    '지정한 Note와 연결된 active AI Related Notes를 pair lock을 획득한 뒤 저장 방향과 관계없이 재평가 결과로 원자적으로 교체합니다.';


-- ============================================================================
-- Add Manual Related Notes
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."add_note_related_manual"(
    "p_note_id" uuid,
    "p_related_notes" jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    "v_user_id" uuid;
BEGIN
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    IF "p_related_notes" IS NULL
       OR jsonb_typeof("p_related_notes") <> 'array'
       OR jsonb_array_length("p_related_notes") = 0
    THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_REQUIRED'
            USING ERRCODE = 'WP004';
    END IF;

    IF jsonb_array_length("p_related_notes") > 10 THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_TOO_MANY'
            USING ERRCODE = 'WP009';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "public"."notes"
        WHERE "id" = "p_note_id"
          AND "user_id" = "v_user_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_SOURCE_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE jsonb_typeof("item") <> 'object'
           OR NULLIF(btrim("item" ->> 'relatedNoteId'), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_INVALID'
            USING ERRCODE = 'WP005';
    END IF;

    BEGIN
        PERFORM
            ("item" ->> 'relatedNoteId')::uuid
        FROM jsonb_array_elements("p_related_notes") AS "item";
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION
                'RELATED_NOTE_TARGET_INVALID'
                USING ERRCODE = 'WP005';
    END;

    IF (
        SELECT count(*)
        FROM jsonb_array_elements("p_related_notes")
    ) <> (
        SELECT count(DISTINCT ("item" ->> 'relatedNoteId')::uuid)
        FROM jsonb_array_elements("p_related_notes") AS "item"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_DUPLICATED'
            USING ERRCODE = 'WP006';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE ("item" ->> 'relatedNoteId')::uuid = "p_note_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_SELF_RELATION_NOT_ALLOWED'
            USING ERRCODE = 'WP007';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE NULLIF(btrim("item" ->> 'reason'), '') IS NOT NULL
          AND char_length(btrim("item" ->> 'reason')) > 500
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_REASON_TOO_LONG'
            USING ERRCODE = 'WP008';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        LEFT JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" = ("item" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "v_user_id"
        WHERE "target_note"."id" IS NULL
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    PERFORM "public"."lock_note_related_note_pair"(
        "p_note_id",
        "target_note"."id"
    )
    FROM jsonb_array_elements("p_related_notes") AS "item"
    INNER JOIN "public"."notes" AS "target_note"
      ON "target_note"."id" = ("item" ->> 'relatedNoteId')::uuid
     AND "target_note"."user_id" = "v_user_id"
    ORDER BY
        least("p_note_id", "target_note"."id"),
        greatest("p_note_id", "target_note"."id");

    WITH "manual_targets" AS (
        SELECT
            "target_note"."id" AS "related_note_id",
            jsonb_strip_nulls(
                jsonb_build_object(
                    'reason',
                    NULLIF(btrim("item" ->> 'reason'), '')
                )
            ) AS "metadata"
        FROM jsonb_array_elements("p_related_notes") AS "item"
        INNER JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" = ("item" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "v_user_id"
    )
    UPDATE "public"."note_related_notes" AS "relation"
    SET
        "origin" = 'manual',
        "status" = 'active',
        "metadata" = "manual_targets"."metadata"
    FROM "manual_targets"
    WHERE (
            (
                "relation"."note_id" = "p_note_id"
                AND "relation"."related_note_id" =
                    "manual_targets"."related_note_id"
            )
            OR (
                "relation"."note_id" =
                    "manual_targets"."related_note_id"
                AND "relation"."related_note_id" = "p_note_id"
            )
        );

    WITH "manual_targets" AS (
        SELECT
            "target_note"."id" AS "related_note_id",
            jsonb_strip_nulls(
                jsonb_build_object(
                    'reason',
                    NULLIF(btrim("item" ->> 'reason'), '')
                )
            ) AS "metadata"
        FROM jsonb_array_elements("p_related_notes") AS "item"
        INNER JOIN "public"."notes" AS "target_note"
          ON "target_note"."id" = ("item" ->> 'relatedNoteId')::uuid
         AND "target_note"."user_id" = "v_user_id"
    )
    INSERT INTO "public"."note_related_notes" (
        "note_id",
        "related_note_id",
        "origin",
        "status",
        "metadata"
    )
    SELECT
        "p_note_id",
        "manual_targets"."related_note_id",
        'manual',
        'active',
        "manual_targets"."metadata"
    FROM "manual_targets"
    WHERE NOT EXISTS (
        SELECT 1
        FROM "public"."note_related_notes" AS "existing_relation"
        WHERE (
                (
                    "existing_relation"."note_id" = "p_note_id"
                    AND "existing_relation"."related_note_id" =
                        "manual_targets"."related_note_id"
                )
                OR (
                    "existing_relation"."note_id" =
                        "manual_targets"."related_note_id"
                    AND "existing_relation"."related_note_id" =
                        "p_note_id"
                )
            )
    )
    ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION
    "public"."add_note_related_manual"(uuid, jsonb)
IS
    '동일 사용자의 여러 Note를 manual Related Notes로 연결하며 공통 pair lock을 획득한 뒤 저장 방향과 관계없이 기존 관계를 재사용합니다.';