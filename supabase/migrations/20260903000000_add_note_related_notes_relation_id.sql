-- ============================================================================
-- Add Related Notes Relation ID
-- ============================================================================

/*
 * Related Notes 관계 row 자체를 식별하는 UUID입니다.
 *
 * (note_id, related_note_id) composite primary key와 unordered pair uniqueness는
 * 관계 생성/중복 판정 정책으로 유지하고, id는 수정/삭제 대상 식별에만 사용합니다.
 */
ALTER TABLE "public"."note_related_notes"
    ADD COLUMN IF NOT EXISTS "id" uuid;

-- 기존 row에도 각자 다른 relation ID를 부여합니다.
UPDATE "public"."note_related_notes"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;

-- 신규 row는 relation ID를 자동 생성합니다.
ALTER TABLE "public"."note_related_notes"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE ONLY "public"."note_related_notes"
    ADD CONSTRAINT "note_related_notes_id_key"
    UNIQUE ("id");

COMMENT ON COLUMN "public"."note_related_notes"."id" IS
    'Related Notes 관계 row를 식별하는 UUID입니다. pair primary key는 그대로 유지합니다.';

-- ============================================================================
-- Update Manual Related Note Reason By Relation ID
-- ============================================================================

DROP FUNCTION IF EXISTS
    "public"."update_note_related_manual_reason"(uuid, uuid, text);

CREATE OR REPLACE FUNCTION "public"."update_note_related_manual_reason"(
    "p_note_id" uuid,
    "p_relation_id" uuid,
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
    "v_relation_note_id" uuid;
    "v_relation_related_note_id" uuid;
BEGIN
    -- SECURITY DEFINER 함수이므로 현재 인증 세션의 사용자 ID를 직접 확인합니다.
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    -- reason은 trim 후 비어 있으면 제거 요청으로 처리합니다.
    "v_reason" := NULLIF(btrim("p_reason"), '');

    IF "v_reason" IS NOT NULL
       AND char_length("v_reason") > 500
    THEN
        RAISE EXCEPTION
            'RELATED_NOTE_REASON_TOO_LONG'
            USING ERRCODE = 'WP008';
    END IF;

    -- 화면 기준 Note가 현재 사용자의 Note인지 먼저 확인합니다.
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

    -- relationId가 화면 기준 Note를 포함하는 실제 관계인지 확인합니다.
    SELECT
        "note_id",
        "related_note_id"
    INTO
        "v_relation_note_id",
        "v_relation_related_note_id"
    FROM "public"."note_related_notes"
    WHERE "id" = "p_relation_id"
      AND (
            "note_id" = "p_note_id"
            OR "related_note_id" = "p_note_id"
        )
      AND "origin" = 'manual';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'RELATED_NOTE_MANUAL_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- pair의 반대편 Note도 현재 사용자의 Note인지 RPC 경계에서 검증합니다.
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."notes"
        WHERE "id" = CASE
                WHEN "v_relation_note_id" = "p_note_id"
                    THEN "v_relation_related_note_id"
                ELSE "v_relation_note_id"
            END
          AND "user_id" = "v_user_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- 같은 pair에 대한 다른 쓰기와 충돌하지 않도록 기존 pair lock을 유지합니다.
    PERFORM "public"."lock_note_related_note_pair"(
        "v_relation_note_id",
        "v_relation_related_note_id"
    );

    IF "v_reason" IS NOT NULL THEN
        UPDATE "public"."note_related_notes"
        SET "metadata" = jsonb_set(
            "metadata",
            '{reason}',
            to_jsonb("v_reason"),
            true
        )
        WHERE "id" = "p_relation_id"
          AND "origin" = 'manual';

        RETURN;
    END IF;

    UPDATE "public"."note_related_notes"
    SET "metadata" = "metadata" - 'reason'
    WHERE "id" = "p_relation_id"
      AND "origin" = 'manual';
END;
$$;

COMMENT ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
IS
    '현재 사용자의 manual Related Note 관계를 relation ID로 찾아 기존 metadata를 유지한 채 선택적 reason만 수정하거나 제거합니다.';

REVOKE ALL
ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
TO "authenticated";


-- ============================================================================
-- Delete Related Note By Relation ID
-- ============================================================================

DROP FUNCTION IF EXISTS
    "public"."delete_note_related"(uuid, uuid);

CREATE OR REPLACE FUNCTION "public"."delete_note_related"(
    "p_note_id" uuid,
    "p_relation_id" uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    "v_user_id" uuid;
    "v_origin" text;
    "v_relation_note_id" uuid;
    "v_relation_related_note_id" uuid;
BEGIN
    -- SECURITY DEFINER 함수이므로 현재 인증 세션의 사용자 ID를 직접 확인합니다.
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    -- 화면 기준 Note가 현재 사용자의 Note인지 먼저 확인합니다.
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

    -- relationId가 화면 기준 Note를 포함하는 실제 관계인지 확인합니다.
    SELECT
        "origin",
        "note_id",
        "related_note_id"
    INTO
        "v_origin",
        "v_relation_note_id",
        "v_relation_related_note_id"
    FROM "public"."note_related_notes"
    WHERE "id" = "p_relation_id"
      AND (
            "note_id" = "p_note_id"
            OR "related_note_id" = "p_note_id"
        );

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- pair의 반대편 Note도 현재 사용자의 Note인지 RPC 경계에서 검증합니다.
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."notes"
        WHERE "id" = CASE
                WHEN "v_relation_note_id" = "p_note_id"
                    THEN "v_relation_related_note_id"
                ELSE "v_relation_note_id"
            END
          AND "user_id" = "v_user_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- 같은 pair에 대한 다른 쓰기와 충돌하지 않도록 기존 pair lock을 유지합니다.
    PERFORM "public"."lock_note_related_note_pair"(
        "v_relation_note_id",
        "v_relation_related_note_id"
    );

    IF "v_origin" = 'manual' THEN
        DELETE FROM "public"."note_related_notes"
        WHERE "id" = "p_relation_id"
          AND "origin" = 'manual';

        RETURN;
    END IF;

    IF "v_origin" = 'ai' THEN
        UPDATE "public"."note_related_notes"
        SET "status" = 'dismissed'
        WHERE "id" = "p_relation_id"
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
    '현재 사용자의 Related Note 관계를 relation ID로 찾아 제거합니다. manual 관계는 삭제하고 AI 관계는 dismissed 상태로 전환합니다.';

REVOKE ALL
ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
TO "authenticated";
