-- ============================================================================
-- Replace Active AI Related Notes
-- ============================================================================

/*
 * 지정한 Note의 현재 AI 추천(active)을 새로운 추천 결과로 원자적으로 교체합니다.
 *
 * 하나의 함수 호출 안에서 기존 active AI 추천 삭제와 새 추천 삽입을
 * 함께 수행하므로, 새 추천 저장 중 오류가 발생하면 전체 변경이 rollback됩니다.
 *
 * manual 관계와 dismissed AI 관계는 사용자의 명시적인 판단이 반영된 데이터이므로
 * 이 함수에서 수정하거나 삭제하지 않습니다.
 *
 * AI 추천은 Note 저장/수정 이후 비동기 후처리로 생성되므로,
 * 추천 생성에 사용한 Note snapshot의 updated_at을 함께 전달받습니다.
 *
 * 추천 저장 직전에 현재 Note row를 잠그고 updated_at을 비교하여,
 * 추천 생성 중 Note가 다시 수정된 경우 오래된 추천 결과가
 * 최신 추천을 덮어쓰지 않도록 해당 교체 작업을 수행하지 않습니다.
 *
 * p_recommendations 형식:
 *
 * [
 *   {
 *     "relatedNoteId": "<uuid>",
 *     "metadata": {
 *       "reason": "...",
 *       "rank": 1
 *     }
 *   }
 * ]
 *
 * metadata는 생략할 수 있으며 이 경우 빈 JSON object를 저장합니다.
 *
 * 이 함수는 Related Notes 서버 실행 계층에서만 사용하므로
 * service_role에만 실행 권한을 부여합니다.
 */
CREATE OR REPLACE FUNCTION "public"."replace_note_related_ai_recommendations"(
    "p_note_id" uuid,
    "p_source_updated_at" timestamp with time zone,
    "p_recommendations" jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    "v_current_source_updated_at" timestamp with time zone;
BEGIN
    /*
     * 호출 계약을 명확히 하기 위해 추천 목록은 반드시 JSON 배열이어야 합니다.
     */
    IF jsonb_typeof("p_recommendations") <> 'array' THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RECOMMENDATIONS_MUST_BE_ARRAY'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 추천 생성에 사용한 Note snapshot이 여전히 최신 상태인지 확인합니다.
     *
     * Note row를 잠근 상태에서 updated_at을 검증하고 이후 추천 교체까지
     * 같은 트랜잭션에서 수행하여, 검증 직후 다른 Note 수정이 끼어들어
     * 오래된 추천이 저장되는 race condition을 방지합니다.
     */
    SELECT "updated_at"
    INTO "v_current_source_updated_at"
    FROM "public"."notes"
    WHERE "id" = "p_note_id"
    FOR UPDATE;

    /*
     * 추천 후처리 실행 전에 Note가 삭제된 경우에는
     * 정상적인 비동기 실행 경합으로 보고 아무것도 변경하지 않습니다.
     */
    IF NOT FOUND THEN
        RETURN;
    END IF;

    /*
     * 추천 생성 이후 Note가 다시 수정되었다면 현재 실행 결과는 stale 상태입니다.
     *
     * 기존 active AI 추천을 삭제하기 전에 종료하여,
     * 최신 Note version을 기준으로 생성된 추천을 오래된 실행이 덮어쓰지 않도록 합니다.
     */
    IF "v_current_source_updated_at" IS DISTINCT FROM "p_source_updated_at" THEN
        RETURN;
    END IF;

    /*
     * 이전 AI 추천 중 현재 화면에 노출되는 active 관계만 제거합니다.
     *
     * manual 관계와 dismissed AI 관계는 그대로 유지합니다.
     */
    DELETE FROM "public"."note_related_notes"
    WHERE "note_id" = "p_note_id"
      AND "origin" = 'ai'
      AND "status" = 'active';

    /*
     * 새 AI 추천을 row 단위로 저장합니다.
     *
     * 동일한 관계가 manual 또는 dismissed 상태로 이미 존재할 경우
     * 사용자의 기존 판단을 우선하여 해당 추천은 삽입하지 않습니다.
     */
    INSERT INTO "public"."note_related_notes" (
        "note_id",
        "related_note_id",
        "origin",
        "status",
        "metadata"
    )
    SELECT
        "p_note_id",
        ("recommendation" ->> 'relatedNoteId')::uuid,
        'ai',
        'active',
        COALESCE(
            "recommendation" -> 'metadata',
            '{}'::jsonb
        )
    FROM jsonb_array_elements("p_recommendations")
        AS "items"("recommendation")
    ON CONFLICT ("note_id", "related_note_id")
    DO NOTHING;
END;
$$;


COMMENT ON FUNCTION
    "public"."replace_note_related_ai_recommendations"(
        uuid,
        timestamp with time zone,
        jsonb
    )
IS
    '지정한 Note의 active AI Related Notes를 새로운 추천 결과로 원자적으로 교체합니다. Note version이 변경된 stale 추천은 저장하지 않으며 manual 및 dismissed 관계는 유지합니다.';


-- ============================================================================
-- Function Permissions
-- ============================================================================

/*
 * Related Notes 추천 저장은 서버의 service_role 실행 계층에서만 수행합니다.
 */
REVOKE ALL
ON FUNCTION
    "public"."replace_note_related_ai_recommendations"(
        uuid,
        timestamp with time zone,
        jsonb
    )
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."replace_note_related_ai_recommendations"(
        uuid,
        timestamp with time zone,
        jsonb
    )
TO "service_role";

-- ============================================================================
-- Add Manual Related Notes
-- ============================================================================

/*
 * 사용자가 자신의 여러 Note를 현재 Note의 수동 Related Note로 연결합니다.
 *
 * Client에서는 다음 형태의 JSONB 배열을 전달합니다.
 *
 * [
 *   {
 *     "relatedNoteId": "<uuid>",
 *     "reason": "첫 번째 Note를 연결한 이유"
 *   },
 *   {
 *     "relatedNoteId": "<uuid>",
 *     "reason": "두 번째 Note를 연결한 이유"
 *   },
 *   {
 *     "relatedNoteId": "<uuid>"
 *   }
 * ]
 *
 * 각 Related Note는 서로 다른 선택적 reason을 가질 수 있습니다.
 *
 * 화면 표시용 title snapshot은 Client에서 전달받지 않고,
 * 각 연결 대상 Note의 현재 title을 DB에서 직접 조회하여 metadata에 저장합니다.
 *
 * source Note와 모든 target Note의 소유권 검증부터 관계 저장까지
 * 하나의 함수 실행 안에서 처리하므로, 하나라도 잘못된 입력이 있으면
 * 전체 요청이 rollback되어 일부 관계만 저장되지 않습니다.
 *
 * 동일한 (note_id, related_note_id) 관계가 이미 존재하면 새 row를 만들지 않고,
 * 사용자의 명시적인 수동 연결을 우선하여 manual + active 관계로 전환합니다.
 */
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
    /*
     * SECURITY DEFINER 함수이므로 사용자 ID를 인자로 받지 않고
     * 현재 인증 세션의 auth.uid()를 직접 사용합니다.
     */
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Related Notes 입력은 비어 있지 않은 JSON 배열이어야 합니다.
     */
    IF "p_related_notes" IS NULL
       OR jsonb_typeof("p_related_notes") <> 'array'
       OR jsonb_array_length("p_related_notes") = 0
    THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_REQUIRED'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 기준 Note가 현재 인증 사용자의 Note인지 확인합니다.
     */
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

    /*
     * 모든 배열 항목은 relatedNoteId를 가져야 합니다.
     *
     * reason은 선택값이므로 존재하지 않거나 null이어도 허용합니다.
     */
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE jsonb_typeof("item") <> 'object'
           OR NULLIF(btrim("item" ->> 'relatedNoteId'), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_INVALID'
            USING ERRCODE = '22023';
    END IF;

    /*
     * relatedNoteId는 모두 UUID 형식이어야 합니다.
     *
     * text를 uuid로 변환할 수 없는 경우 PostgreSQL의 invalid_text_representation
     * 오류를 그대로 반환하지 않고 Related Notes 입력 오류로 통일합니다.
     */
    BEGIN
        PERFORM
            ("item" ->> 'relatedNoteId')::uuid
        FROM jsonb_array_elements("p_related_notes") AS "item";
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION
                'RELATED_NOTE_TARGET_INVALID'
                USING ERRCODE = '22023';
    END;

    /*
     * 동일 target이 배열에 중복되어 있으면 어느 reason을 저장해야 하는지
     * 모호해지므로 요청 자체를 거부합니다.
     */
    IF (
        SELECT count(*)
        FROM jsonb_array_elements("p_related_notes")
    ) <> (
        SELECT count(DISTINCT ("item" ->> 'relatedNoteId')::uuid)
        FROM jsonb_array_elements("p_related_notes") AS "item"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_TARGET_DUPLICATED'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 현재 Note 자신이 target 목록에 포함될 수 없습니다.
     */
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE ("item" ->> 'relatedNoteId')::uuid = "p_note_id"
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_SELF_RELATION_NOT_ALLOWED'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 각 reason은 앞뒤 공백 제거 후 최대 500자까지 허용합니다.
     *
     * reason이 없거나 공백뿐인 경우에는 저장 시 metadata에서 제거합니다.
     */
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements("p_related_notes") AS "item"
        WHERE NULLIF(btrim("item" ->> 'reason'), '') IS NOT NULL
          AND char_length(btrim("item" ->> 'reason')) > 500
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_REASON_TOO_LONG'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 전달된 모든 target Note가 현재 인증 사용자의 Note인지 확인합니다.
     *
     * 하나라도 존재하지 않거나 다른 사용자의 Note라면 전체 요청을 실패시켜
     * 일부 관계만 저장되는 상황을 방지합니다.
     */
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

    /*
     * 검증된 Related Notes를 한 번에 manual + active 관계로 저장합니다.
     *
     * title은 DB의 현재 target Note 제목을 snapshot으로 사용하고,
     * reason은 각 배열 항목에 입력된 값을 개별적으로 저장합니다.
     *
     * 기존 AI 또는 dismissed 관계가 존재하면 사용자의 명시적인 수동 연결을
     * 우선하여 해당 row를 manual + active 관계로 전환합니다.
     */
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
        'manual',
        'active',
        jsonb_strip_nulls(
            jsonb_build_object(
                'title',
                "target_note"."title",
                'reason',
                NULLIF(btrim("item" ->> 'reason'), '')
            )
        )
    FROM jsonb_array_elements("p_related_notes") AS "item"
    INNER JOIN "public"."notes" AS "target_note"
      ON "target_note"."id" = ("item" ->> 'relatedNoteId')::uuid
     AND "target_note"."user_id" = "v_user_id"
    ON CONFLICT ("note_id", "related_note_id")
    DO UPDATE SET
        "origin" = 'manual',
        "status" = 'active',
        "metadata" = EXCLUDED."metadata";
END;
$$;


COMMENT ON FUNCTION
    "public"."add_note_related_manual"(uuid, jsonb)
IS
    '동일 사용자의 여러 Note를 manual Related Notes로 연결하며 각 대상 Note의 title snapshot과 개별 선택적 reason을 metadata에 저장합니다.';

REVOKE ALL
ON FUNCTION
    "public"."add_note_related_manual"(uuid, jsonb)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."add_note_related_manual"(uuid, jsonb)
TO "authenticated";

-- ============================================================================
-- Update Manual Related Note Reason
-- ============================================================================

/*
 * 사용자가 직접 연결한 manual Related Note의 선택적 reason을 수정합니다.
 *
 * 수정 대상 관계는 반드시 현재 인증 사용자가 소유한 source Note와
 * target Note 사이의 manual 관계여야 합니다.
 *
 * 기존 metadata의 title snapshot 및 다른 확장 필드는 그대로 유지하고,
 * reason 값만 추가/수정/제거합니다.
 *
 * p_reason은 선택값이며 다음 경우에는 metadata에서 reason key를 제거합니다.
 *
 * - NULL
 * - 빈 문자열
 * - 공백 문자열
 *
 * reason은 앞뒤 공백 제거 후 최대 500자까지 허용합니다.
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
    /*
     * SECURITY DEFINER 함수이므로 사용자 ID를 인자로 받지 않고
     * 현재 인증 세션의 auth.uid()를 직접 사용합니다.
     */
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    /*
     * reason은 저장 전에 앞뒤 공백을 제거합니다.
     *
     * NULL 또는 공백뿐인 문자열은 reason 제거 요청으로 처리합니다.
     */
    "v_reason" := NULLIF(btrim("p_reason"), '');

    /*
     * reason은 trim된 값을 기준으로 최대 500자까지 허용합니다.
     */
    IF "v_reason" IS NOT NULL
       AND char_length("v_reason") > 500
    THEN
        RAISE EXCEPTION
            'RELATED_NOTE_REASON_TOO_LONG'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 기준 Note가 현재 인증 사용자의 Note인지 확인합니다.
     *
     * 존재하지 않는 Note와 다른 사용자의 Note를 동일하게 처리하여
     * 다른 사용자의 Note 존재 여부를 노출하지 않습니다.
     */
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

    /*
     * target Note가 현재 인증 사용자의 Note인지 확인합니다.
     *
     * source와 동일하게 존재 여부와 소유권 실패를 구분하지 않습니다.
     */
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
     * 수정 대상 관계가 실제로 존재하며 manual 관계인지 확인합니다.
     *
     * AI 추천 관계의 reason은 추천 결과에 포함된 데이터이므로
     * 사용자가 직접 수정할 수 없습니다.
     */
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."note_related_notes"
        WHERE "note_id" = "p_note_id"
          AND "related_note_id" = "p_related_note_id"
          AND "origin" = 'manual'
    ) THEN
        RAISE EXCEPTION
            'RELATED_NOTE_MANUAL_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * reason이 있으면 기존 metadata를 유지하면서 reason만 추가하거나 교체합니다.
     *
     * title snapshot 및 향후 추가될 수 있는 다른 metadata 필드는
     * 이 수정으로 변경되지 않습니다.
     */
    IF "v_reason" IS NOT NULL THEN
        UPDATE "public"."note_related_notes"
        SET "metadata" = jsonb_set(
            "metadata",
            '{reason}',
            to_jsonb("v_reason"),
            true
        )
        WHERE "note_id" = "p_note_id"
          AND "related_note_id" = "p_related_note_id"
          AND "origin" = 'manual';

        RETURN;
    END IF;

    /*
     * reason이 없으면 metadata 전체를 덮어쓰지 않고
     * reason key만 제거합니다.
     */
    UPDATE "public"."note_related_notes"
    SET "metadata" = "metadata" - 'reason'
    WHERE "note_id" = "p_note_id"
      AND "related_note_id" = "p_related_note_id"
      AND "origin" = 'manual';
END;
$$;


COMMENT ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
IS
    '현재 사용자의 manual Related Note 관계에서 기존 metadata를 유지한 채 선택적 reason만 수정하거나 제거합니다.';


-- ============================================================================
-- Update Manual Related Note Reason Permissions
-- ============================================================================

/*
 * manual Related Note 수정은 인증된 사용자가 RPC를 통해서만 수행합니다.
 *
 * 함수 내부에서 auth.uid()를 기준으로 source/target Note 소유권과
 * manual 관계 여부를 검증합니다.
 */
REVOKE ALL
ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."update_note_related_manual_reason"(uuid, uuid, text)
TO "authenticated";

-- ============================================================================
-- Delete Related Note
-- ============================================================================

/*
 * 사용자가 현재 Note의 Related Note 관계를 제거합니다.
 *
 * 관계의 origin에 따라 삭제 의미를 다르게 처리합니다.
 *
 * - manual 관계:
 *   사용자가 직접 생성한 관계이므로 row 자체를 삭제합니다.
 *
 * - ai 관계:
 *   실제 row를 삭제하지 않고 dismissed 상태로 전환합니다.
 *   이후 AI 추천이 다시 생성되더라도 동일 관계가 재노출되지 않도록
 *   사용자의 명시적인 제외 판단을 보존하기 위함입니다.
 *
 * source Note와 target Note는 모두 현재 인증 사용자의 Note여야 하며,
 * 실제 관계의 origin은 Client 입력을 신뢰하지 않고 DB에서 조회합니다.
 */
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
    /*
     * SECURITY DEFINER 함수이므로 사용자 ID를 인자로 받지 않고
     * 현재 인증 세션의 auth.uid()를 직접 사용합니다.
     */
    "v_user_id" := "auth"."uid"();

    IF "v_user_id" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_AUTHENTICATION_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    /*
     * 기준 Note가 현재 인증 사용자의 Note인지 확인합니다.
     *
     * 존재하지 않는 Note와 다른 사용자 소유 Note를 구분하지 않아
     * 다른 사용자의 Note 존재 여부를 노출하지 않습니다.
     */
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

    /*
     * target Note도 현재 인증 사용자의 Note인지 확인합니다.
     */
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
     * 실제 저장된 관계의 origin을 조회합니다.
     *
     * Client가 origin을 직접 전달하지 않도록 하여
     * manual/ai 처리 규칙을 DB 데이터 기준으로 결정합니다.
     */
    SELECT "origin"
    INTO "v_origin"
    FROM "public"."note_related_notes"
    WHERE "note_id" = "p_note_id"
      AND "related_note_id" = "p_related_note_id";

    IF "v_origin" IS NULL THEN
        RAISE EXCEPTION
            'RELATED_NOTE_RELATION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * manual 관계는 사용자가 직접 생성한 관계이므로 실제 row를 삭제합니다.
     */
    IF "v_origin" = 'manual' THEN
        DELETE FROM "public"."note_related_notes"
        WHERE "note_id" = "p_note_id"
          AND "related_note_id" = "p_related_note_id";

        RETURN;
    END IF;

    /*
     * AI 추천 관계는 사용자가 제거했다는 판단을 보존하기 위해
     * row를 삭제하지 않고 dismissed 상태로 변경합니다.
     *
     * 이미 dismissed인 관계에 다시 호출되더라도 동일 상태를 유지합니다.
     */
    IF "v_origin" = 'ai' THEN
        UPDATE "public"."note_related_notes"
        SET "status" = 'dismissed'
        WHERE "note_id" = "p_note_id"
          AND "related_note_id" = "p_related_note_id";

        RETURN;
    END IF;

    /*
     * 현재 schema에서는 manual/ai 외 origin이 허용되지 않지만,
     * 향후 schema 변경이나 비정상 데이터에 대비해 명시적으로 실패시킵니다.
     */
    RAISE EXCEPTION
        'RELATED_NOTE_ORIGIN_INVALID'
        USING ERRCODE = '22023';
END;
$$;


COMMENT ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
IS
    '현재 사용자의 Related Note 관계를 제거합니다. manual 관계는 삭제하고 AI 관계는 dismissed 상태로 전환합니다.';


-- ============================================================================
-- Delete Related Note Permissions
-- ============================================================================

/*
 * Related Note 삭제는 인증된 사용자가 RPC를 통해서만 수행합니다.
 *
 * 함수 내부에서 auth.uid()를 기준으로 source/target Note 소유권을
 * 검증한 뒤 실제 저장된 origin에 따라 삭제 방식을 결정합니다.
 */
REVOKE ALL
ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION
    "public"."delete_note_related"(uuid, uuid)
TO "authenticated";