-- ============================================================================
-- Make Related Note Mutations Bidirectional
-- ============================================================================

/*
 * Related Notes는 DB에 단일 방향 row만 저장하되 조회 화면에서는 양방향으로
 * 표시합니다. 이 migration은 역방향으로 표시된 row도 기존 수정/삭제 RPC가
 * 같은 저장 row를 찾아 처리할 수 있도록 관계 매칭 조건만 확장합니다.
 */

CREATE OR REPLACE FUNCTION "public"."update_note_related_manual_reason"(
    "p_note_id" uuid,
    "p_related_note_id" uuid,
    "p_reason" text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    "v_user_id" uuid;
    "v_reason" text;
BEGIN
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    "v_reason" := NULLIF(btrim("p_reason"), '');

    IF "v_reason" IS NOT NULL
       AND char_length("v_reason") > 500
    THEN
        RAISE EXCEPTION
            'RELATED_NOTE_REASON_TOO_LONG'
            USING ERRCODE = '22023';
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

    IF NOT EXISTS (
        SELECT 1
        FROM "public"."notes"
        WHERE "id" = "p_related_note_id"
          AND "user_id" = "v_user_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * 화면 기준의 (현재 Note, 표시된 Related Note) 방향과 실제 저장 row의
     * 방향이 다를 수 있으므로 양방향으로 manual 관계를 찾습니다.
     */
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."note_related_notes"
        WHERE (
                (
                    "note_id" = "p_note_id"
                    AND "related_note_id" = "p_related_note_id"
                )
                OR (
                    "note_id" = "p_related_note_id"
                    AND "related_note_id" = "p_note_id"
                )
            )
          AND "origin" = 'manual'
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_MANUAL_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF "v_reason" IS NOT NULL THEN
        UPDATE "public"."note_related_notes"
        SET "metadata" = jsonb_set(
            "metadata",
            '{reason}',
            to_jsonb("v_reason"),
            true
        )
        WHERE (
                (
                    "note_id" = "p_note_id"
                    AND "related_note_id" = "p_related_note_id"
                )
                OR (
                    "note_id" = "p_related_note_id"
                    AND "related_note_id" = "p_note_id"
                )
            )
          AND "origin" = 'manual';

        RETURN;
    END IF;

    UPDATE "public"."note_related_notes"
    SET "metadata" = "metadata" - 'reason'
    WHERE (
            (
                "note_id" = "p_note_id"
                AND "related_note_id" = "p_related_note_id"
            )
            OR (
                "note_id" = "p_related_note_id"
                AND "related_note_id" = "p_note_id"
            )
        )
      AND "origin" = 'manual';
END;
$$;

COMMENT ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
IS
    '현재 사용자의 manual Related Note 관계를 저장 방향과 관계없이 찾아 기존 metadata를 유지한 채 선택적 reason만 수정하거나 제거합니다.';

CREATE OR REPLACE FUNCTION "public"."delete_note_related"(
    "p_note_id" uuid,
    "p_related_note_id" uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    "v_user_id" uuid;
    "v_origin" text;
BEGIN
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
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

    IF NOT EXISTS (
        SELECT 1
        FROM "public"."notes"
        WHERE "id" = "p_related_note_id"
          AND "user_id" = "v_user_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * Client는 화면 기준의 현재 Note와 표시된 반대편 Note를 전달합니다.
     * 실제 row는 어느 방향으로든 저장되어 있을 수 있으므로 양방향으로 찾습니다.
     */
    SELECT "origin"
    INTO "v_origin"
    FROM "public"."note_related_notes"
    WHERE (
            "note_id" = "p_note_id"
            AND "related_note_id" = "p_related_note_id"
        )
       OR (
            "note_id" = "p_related_note_id"
            AND "related_note_id" = "p_note_id"
        )
    LIMIT 1;

    IF "v_origin" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF "v_origin" = 'manual' THEN
        DELETE FROM "public"."note_related_notes"
        WHERE (
                (
                    "note_id" = "p_note_id"
                    AND "related_note_id" = "p_related_note_id"
                )
                OR (
                    "note_id" = "p_related_note_id"
                    AND "related_note_id" = "p_note_id"
                )
            )
          AND "origin" = 'manual'
          AND "status" = 'active';

        RETURN;
    END IF;

    IF "v_origin" = 'ai' THEN
        UPDATE "public"."note_related_notes"
        SET "status" = 'dismissed'
        WHERE (
                (
                    "note_id" = "p_note_id"
                    AND "related_note_id" = "p_related_note_id"
                )
                OR (
                    "note_id" = "p_related_note_id"
                    AND "related_note_id" = "p_note_id"
                )
            )
          AND "origin" = 'ai';

        RETURN;
    END IF;

    RAISE EXCEPTION
        'RELATED_NOTE_ORIGIN_INVALID'
        USING ERRCODE = '22023';
END;
$$;

COMMENT ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
IS
    '현재 사용자의 Related Note 관계를 저장 방향과 관계없이 찾아 제거합니다. manual 관계는 삭제하고 AI 관계는 dismissed 상태로 전환합니다.';
