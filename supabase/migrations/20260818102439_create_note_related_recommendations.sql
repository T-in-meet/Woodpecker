-- ============================================================================
-- Related Notes 추천 결과 저장
-- ============================================================================

/*
 * Note별 Related Notes 추천 결과의 최신 snapshot을 저장합니다.
 *
 * 하나의 Note에는 현재 추천 결과 하나만 유지하므로 note_id를 PK로 사용합니다.
 * recommendations는 Related Notes Answer Agent의 결과를 애플리케이션에서
 * 검증/정규화한 뒤 JSON 배열 형태로 저장합니다.
 *
 * 원본 Note가 삭제되면 해당 Note에 대한 추천 결과도 더 이상 의미가 없으므로
 * ON DELETE CASCADE로 함께 정리합니다.
 */
CREATE TABLE IF NOT EXISTS "public"."note_related_recommendations" (
    "note_id" uuid
        PRIMARY KEY
        REFERENCES "public"."notes"("id")
        ON DELETE CASCADE,

    "recommendations" jsonb
        NOT NULL
        DEFAULT '[]'::jsonb,

    "created_at" timestamp with time zone
        DEFAULT "now"()
        NOT NULL,

    "updated_at" timestamp with time zone
        DEFAULT "now"()
        NOT NULL,

    /*
     * recommendations는 항상 추천 항목의 JSON 배열이어야 합니다.
     * 객체나 scalar 값이 직접 저장되는 것을 DB에서도 방지합니다.
     */
    CONSTRAINT "note_related_recommendations_recommendations_array_check"
        CHECK (
            jsonb_typeof("recommendations") = 'array'
        )
);

COMMENT ON TABLE "public"."note_related_recommendations" IS
    'Note별 최신 Related Notes 추천 결과를 JSON 배열 snapshot으로 저장합니다.';

COMMENT ON COLUMN "public"."note_related_recommendations"."note_id" IS
    '추천 대상 Note ID입니다. Note 삭제 시 추천 결과도 함께 삭제됩니다.';

COMMENT ON COLUMN "public"."note_related_recommendations"."recommendations" IS
    '애플리케이션에서 검증 및 정규화한 Related Notes 추천 항목의 JSON 배열입니다.';


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

/*
 * 추천 결과가 갱신될 때 updated_at을 자동으로 현재 시각으로 변경합니다.
 * 프로젝트 공통 update_updated_at_column trigger function을 재사용합니다.
 */
CREATE OR REPLACE TRIGGER "tr_note_related_recommendations_updated_at"
    BEFORE UPDATE
    ON "public"."note_related_recommendations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ============================================================================
-- Row Level Security
-- ============================================================================

/*
 * 추천 결과는 원본 Note의 소유권을 기준으로 접근을 제한합니다.
 *
 * authenticated 사용자는 자신의 Note에 연결된 추천 결과만 조회할 수 있으며,
 * 추천 생성/갱신은 서버의 service_role 경로에서만 수행합니다.
 */
ALTER TABLE "public"."note_related_recommendations"
    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_related_recommendations_select_own"
    ON "public"."note_related_recommendations"
    FOR SELECT
    TO "authenticated"
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."notes"
            WHERE "notes"."id" =
                    "note_related_recommendations"."note_id"
              AND "notes"."user_id" = "auth"."uid"()
        )
    );


-- ============================================================================
-- Table Permissions
-- ============================================================================

/*
 * anon에는 어떤 권한도 부여하지 않습니다.
 *
 * authenticated는 RLS를 통과한 자신의 추천 결과만 조회할 수 있습니다.
 * INSERT/UPDATE/DELETE는 Related Notes 서버 실행 계층에서 service_role로
 * 수행하도록 제한합니다.
 */
REVOKE ALL
ON TABLE "public"."note_related_recommendations"
FROM "anon", "authenticated";

GRANT SELECT
ON TABLE "public"."note_related_recommendations"
TO "authenticated";

GRANT ALL
ON TABLE "public"."note_related_recommendations"
TO "service_role";


-- ============================================================================
-- match_ai_embeddings: 선택적 source 제외 지원
-- ============================================================================

/*
 * 296에서 도입된 공통 match_ai_embeddings는 현재 활성 generation에 속한
 * embedding chunk를 query embedding과 비교하여 유사도 Top-K를 반환합니다.
 *
 * Related Notes에서는 현재 생성/수정 중인 Note 자체가 검색 결과에 포함되면
 * 해당 Note의 여러 chunk가 Top-K를 차지하여 다른 관련 Note의 chunk가
 * 검색 결과에서 밀려날 수 있습니다.
 *
 * 따라서 optional p_exclude_source_id를 추가하여 특정 source의 chunk를
 * ranking 및 LIMIT 적용 전에 검색 대상에서 제외할 수 있도록 확장합니다.
 *
 * 이 변경은 source 단위 중복 제거 정책을 RPC에 추가하는 것이 아닙니다.
 * 동일한 source에서 여러 관련 chunk가 반환되는 기존 chunk 검색 계약은
 * 그대로 유지합니다.
 *
 * p_exclude_source_id가 NULL이면 별도의 source를 제외하지 않으므로
 * Note Chat을 포함한 기존 호출은 이전과 동일하게 동작합니다.
 *
 * 함수 시그니처가 변경되므로 296에서 생성한 기존 7개 인자 함수를 제거한 뒤
 * optional p_exclude_source_id를 포함한 함수로 다시 생성합니다.
 */
DROP FUNCTION IF EXISTS "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision
);

CREATE OR REPLACE FUNCTION "public"."match_ai_embeddings"(
    "p_query_embedding" "extensions"."vector"(1536),
    "p_owner_user_id" "uuid",
    "p_source_type" "text",
    "p_model_config_id" "uuid",
    "p_input_kind" "text",
    "p_limit" integer DEFAULT 10,
    "p_min_similarity" double precision DEFAULT NULL,
    "p_exclude_source_id" "uuid" DEFAULT NULL
)
RETURNS TABLE (
    "source_id" "uuid",
    "embedding_id" "uuid",
    "chunk_index" integer,
    "distance" double precision,
    "similarity" double precision
)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public", "extensions"
AS $$
DECLARE
    "safe_limit" integer;
    "safe_min_similarity" double precision;
BEGIN
    /*
     * 과도한 검색량을 방지하기 위해 기존 공통 RPC와 동일하게
     * limit을 1~100 범위로 정규화합니다.
     */
    "safe_limit" := LEAST(
        GREATEST(
            COALESCE("p_limit", 10),
            1
        ),
        100
    );

    /*
     * 최소 유사도가 지정된 경우 cosine similarity 범위에 맞춰
     * 0~1 사이로 정규화합니다.
     *
     * NULL이면 별도의 최소 유사도 필터를 적용하지 않습니다.
     */
    "safe_min_similarity" := CASE
        WHEN "p_min_similarity" IS NULL THEN NULL
        ELSE LEAST(
            GREATEST("p_min_similarity", 0),
            1
        )
    END;

    RETURN QUERY
    WITH "scored_chunks" AS (
        SELECT
            "embeddings"."source_id",
            "embeddings"."id" AS "embedding_id",
            "embeddings"."chunk_index",

            /*
             * 현재 Note RAG의 distance metric은 cosine distance를 사용합니다.
             * 거리가 작을수록 query embedding과 가까운 chunk입니다.
             */
            (
                "embeddings"."embedding"
                <=> "p_query_embedding"
            )::double precision AS "distance",

            /*
             * cosine distance를 1 - distance 형태의 similarity로 변환합니다.
             */
            (
                1 - (
                    "embeddings"."embedding"
                    <=> "p_query_embedding"
                )
            )::double precision AS "similarity"

        FROM "public"."ai_embeddings" AS "embeddings"

        /*
         * 활성 generation pointer와 일치하는 chunk만 검색 대상으로 사용합니다.
         *
         * 새 generation 생성 중이거나 활성화에 실패한 chunk는
         * 검색 결과에 노출되지 않습니다.
         */
        JOIN "public"."ai_embedding_active_generations"
            AS "active_generations"
          ON "active_generations"."owner_user_id" =
                "embeddings"."owner_user_id"
         AND "active_generations"."source_type" =
                "embeddings"."source_type"
         AND "active_generations"."source_id" =
                "embeddings"."source_id"
         AND "active_generations"."input_kind" =
                "embeddings"."input_kind"
         AND "active_generations"."active_model_config_id" =
                "embeddings"."model_config_id"
         AND "active_generations"."active_generation_id" =
                "embeddings"."generation_id"

        WHERE "embeddings"."owner_user_id" = "p_owner_user_id"
          AND "embeddings"."source_type" = "p_source_type"
          AND "embeddings"."model_config_id" = "p_model_config_id"
          AND "embeddings"."input_kind" = "p_input_kind"
          AND "active_generations"."active_model_config_id" =
                "p_model_config_id"

          /*
           * 특정 source를 제외해야 하는 경우 해당 source의 모든 chunk를
           * scoring 결과에서 제거합니다.
           *
           * 이 조건은 아래 ORDER BY / LIMIT보다 먼저 적용되므로,
           * 제외 대상 Note의 여러 chunk가 Top-K를 차지한 뒤 애플리케이션에서
           * 제거되어 다른 후보 chunk가 사라지는 문제를 방지합니다.
           *
           * NULL이면 기존 공통 검색처럼 어떤 source도 제외하지 않습니다.
           */
          AND (
              "p_exclude_source_id" IS NULL
              OR "embeddings"."source_id" <> "p_exclude_source_id"
          )
    )

    SELECT
        "scored_chunks"."source_id",
        "scored_chunks"."embedding_id",
        "scored_chunks"."chunk_index",
        "scored_chunks"."distance",
        "scored_chunks"."similarity"
    FROM "scored_chunks"

    /*
     * 최소 유사도가 지정되어 있으면 해당 기준을 만족하는 chunk만
     * 최종 검색 후보에 포함합니다.
     */
    WHERE (
        "safe_min_similarity" IS NULL
        OR "scored_chunks"."similarity" >= "safe_min_similarity"
    )

    /*
     * 가장 가까운 chunk부터 반환합니다.
     *
     * 동일 distance일 때에도 결과 순서가 안정적으로 유지되도록
     * source_id, chunk_index, embedding_id를 tie-breaker로 사용합니다.
     *
     * source 단위 중복 제거는 수행하지 않으므로 동일 Note의 여러 chunk가
     * 반환될 수 있습니다.
     */
    ORDER BY
        "scored_chunks"."distance" ASC,
        "scored_chunks"."source_id" ASC,
        "scored_chunks"."chunk_index" ASC,
        "scored_chunks"."embedding_id" ASC

    LIMIT "safe_limit";
END;
$$;

COMMENT ON FUNCTION "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision,
    "uuid"
) IS
    '활성 embedding generation의 chunk Top-K를 반환합니다. '
    'p_exclude_source_id가 지정되면 해당 source의 모든 chunk를 '
    'ranking 및 LIMIT 전에 제외하며 source 단위 중복 제거는 수행하지 않습니다.';


-- ============================================================================
-- match_ai_embeddings Permissions
-- ============================================================================

/*
 * Embedding 검색은 서버 내부 AI 실행 경로에서만 수행합니다.
 *
 * 사용자 인증 여부와 별개로 클라이언트에서 RPC를 직접 실행하지 못하도록
 * PUBLIC, anon, authenticated 실행 권한을 모두 제거하고
 * service_role에만 실행 권한을 부여합니다.
 */
REVOKE ALL
ON FUNCTION "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision,
    "uuid"
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision,
    "uuid"
)
TO "service_role";