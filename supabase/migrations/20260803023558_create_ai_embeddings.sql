BEGIN;

-- ============================================================================
-- Extensions
-- ============================================================================

-- AI 임베딩 저장 및 유사도 검색에 사용할 pgvector 확장을 활성화합니다.
-- 확장은 public이 아닌 extensions schema에서 관리합니다.
CREATE EXTENSION IF NOT EXISTS "vector"
WITH SCHEMA "extensions";


-- ============================================================================
-- AI Embeddings
-- ============================================================================

/*
 * AI 기능에서 생성한 임베딩과 생성 당시 입력 정보를 저장합니다.
 *
 * owner/source/model/input_kind 단위로 임베딩의 출처와 생성 조건을 식별하며,
 * content_hash와 input_hash를 통해 동일 입력에 대한 캐시 및 변경 여부를
 * 애플리케이션 계층에서 판단할 수 있도록 합니다.
 *
 * embedding 차원은 현재 공통 임베딩 저장 규격인 1536으로 고정합니다.
 */
CREATE TABLE "public"."ai_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "model_config_id" "uuid" NOT NULL,
    "input_kind" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "input_hash" "text" NOT NULL,
    "input_text" "text" NOT NULL,
    "input_preview" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536) NOT NULL,
    "token_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_embeddings_pkey"
        PRIMARY KEY ("id"),

    -- 동일 source라도 내용이 변경되면 새로운 임베딩을 저장할 수 있도록
    -- content_hash까지 포함한 생성 조건 단위로 중복 저장을 방지합니다.
    CONSTRAINT "ai_embeddings_owner_source_model_kind_hash_key"
        UNIQUE (
            "owner_user_id",
            "source_type",
            "source_id",
            "model_config_id",
            "input_kind",
            "content_hash"
        ),

    -- 해시와 입력 식별 값은 공백 문자열을 유효한 값으로 허용하지 않습니다.
    CONSTRAINT "ai_embeddings_content_hash_check"
        CHECK (
            char_length(btrim("content_hash")) > 0
        ),

    CONSTRAINT "ai_embeddings_input_hash_check"
        CHECK (
            char_length(btrim("input_hash")) > 0
        ),

    CONSTRAINT "ai_embeddings_input_kind_check"
        CHECK (
            char_length(btrim("input_kind")) > 0
        ),

    CONSTRAINT "ai_embeddings_input_preview_check"
        CHECK (
            char_length(btrim("input_preview")) > 0
        ),

    CONSTRAINT "ai_embeddings_input_text_check"
        CHECK (
            char_length(btrim("input_text")) > 0
        ),

    CONSTRAINT "ai_embeddings_source_type_check"
        CHECK (
            char_length(btrim("source_type")) > 0
        ),

    -- Provider가 token count를 제공하지 않는 경우 NULL을 허용하되,
    -- 값이 존재한다면 음수가 될 수 없습니다.
    CONSTRAINT "ai_embeddings_token_count_check"
        CHECK (
            "token_count" IS NULL
            OR "token_count" >= 0
        )
);


-- ============================================================================
-- Foreign Keys
-- ============================================================================

-- 사용자가 삭제되면 해당 사용자가 소유한 임베딩도 함께 제거합니다.
ALTER TABLE ONLY "public"."ai_embeddings"
    ADD CONSTRAINT "ai_embeddings_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id")
    REFERENCES "auth"."users"("id")
    ON DELETE CASCADE;

/*
 * model_config_id는 ai_model_configs를 참조하지만,
 * Models migration보다 먼저 Embeddings를 생성할 수 있도록
 * FK는 create_ai_models.sql에서 후속으로 추가한다.
 */


-- ============================================================================
-- Indexes
-- ============================================================================

-- 특정 source의 임베딩을 owner/model/input 범위에서 조회하는 경로를 지원합니다.
CREATE INDEX "ai_embeddings_lookup_idx"
    ON "public"."ai_embeddings" (
        "owner_user_id",
        "source_type",
        "source_id",
        "model_config_id",
        "input_kind"
    );

-- 임베딩 검색 시 owner/source/model/input 범위를 먼저 제한하고
-- 최신 생성 데이터를 선택하는 조회 경로를 지원합니다.
CREATE INDEX "ai_embeddings_match_scope_idx"
    ON "public"."ai_embeddings" (
        "owner_user_id",
        "source_type",
        "model_config_id",
        "input_kind",
        "created_at" DESC
    );

-- 동일 모델과 input kind에서 content_hash 기반 캐시 조회를 지원합니다.
CREATE INDEX "ai_embeddings_model_kind_hash_idx"
    ON "public"."ai_embeddings" (
        "model_config_id",
        "input_kind",
        "content_hash"
    );


-- ============================================================================
-- Embedding Match RPC
-- ============================================================================

/*
 * 지정한 owner/source/model/input 범위에서 query embedding과 가까운
 * 임베딩을 검색합니다.
 *
 * 동일 source에 여러 버전의 임베딩이 존재할 수 있으므로 최신 임베딩만
 * 검색 후보로 사용하며, 호출자가 전달한 limit과 최소 similarity는
 * 안전한 범위로 보정한 뒤 적용합니다.
 *
 * source 자체의 존재 여부와 도메인별 접근 권한 검증은 이 RPC의 책임이
 * 아니며 호출 계층에서 처리합니다.
 */
CREATE OR REPLACE FUNCTION "public"."match_ai_embeddings"(
    "p_query_embedding" "extensions"."vector"(1536),
    "p_owner_user_id" "uuid",
    "p_source_type" "text",
    "p_model_config_id" "uuid",
    "p_input_kind" "text",
    "p_limit" integer DEFAULT 10,
    "p_min_similarity" double precision DEFAULT NULL
)
RETURNS TABLE (
    "source_id" "uuid",
    "embedding_id" "uuid",
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
    -- 비정상적으로 크거나 작은 limit이 검색 비용에 영향을 주지 않도록
    -- 최종 검색 개수를 1~100 범위로 제한합니다.
    "safe_limit" := LEAST(
        GREATEST(
            COALESCE("p_limit", 10),
            1
        ),
        100
    );

    -- cosine similarity의 유효 범위에 맞춰 최소 similarity를 0~1로 보정합니다.
    -- NULL은 최소 유사도 필터를 사용하지 않는다는 의미로 유지합니다.
    "safe_min_similarity" := CASE
        WHEN "p_min_similarity" IS NULL THEN NULL
        ELSE LEAST(
            GREATEST("p_min_similarity", 0),
            1
        )
    END;

    /*
     * 동일 source에 여러 임베딩이 존재할 수 있으므로
     * 현재 검색 범위에서 source별 가장 최신 임베딩만 후보로 사용한다.
     */
    RETURN QUERY
    WITH "latest_embeddings" AS (
        SELECT DISTINCT ON ("ai_embeddings"."source_id")
            "ai_embeddings"."source_id",
            "ai_embeddings"."id" AS "embedding_id",
            "ai_embeddings"."embedding",
            "ai_embeddings"."created_at"
        FROM "public"."ai_embeddings"
        WHERE "ai_embeddings"."owner_user_id" = "p_owner_user_id"
          AND "ai_embeddings"."source_type" = "p_source_type"
          AND "ai_embeddings"."model_config_id" = "p_model_config_id"
          AND "ai_embeddings"."input_kind" = "p_input_kind"
        ORDER BY
            "ai_embeddings"."source_id",
            "ai_embeddings"."created_at" DESC,
            "ai_embeddings"."id" DESC
    ),
    -- 최신 임베딩 후보와 query embedding 사이의 cosine distance 및
    -- similarity를 계산해 최종 필터링과 정렬에 사용할 값을 구성합니다.
    "scored_embeddings" AS (
        SELECT
            "latest_embeddings"."source_id",
            "latest_embeddings"."embedding_id",
            (
                "latest_embeddings"."embedding"
                <=> "p_query_embedding"
            )::double precision AS "distance",
            (
                1 - (
                    "latest_embeddings"."embedding"
                    <=> "p_query_embedding"
                )
            )::double precision AS "similarity"
        FROM "latest_embeddings"
    )
    SELECT
        "scored_embeddings"."source_id",
        "scored_embeddings"."embedding_id",
        "scored_embeddings"."distance",
        "scored_embeddings"."similarity"
    FROM "scored_embeddings"
    WHERE (
        "safe_min_similarity" IS NULL
        OR "scored_embeddings"."similarity" >= "safe_min_similarity"
    )
    ORDER BY "scored_embeddings"."distance"
    LIMIT "safe_limit";
END;
$$;

-- RPC의 책임 경계를 DB metadata에도 명시합니다.
COMMENT ON FUNCTION "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision
) IS
'Matches latest AI embeddings within an owner/source/model/input scope. Source existence and domain authorization are caller responsibilities.';


-- ============================================================================
-- Row Level Security
-- ============================================================================

-- ai_embeddings는 사용자 클라이언트가 직접 접근하지 않고
-- 서버 측 AI 실행 계층을 통해서만 사용합니다.
ALTER TABLE "public"."ai_embeddings"
    ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Table Permissions
-- ============================================================================

-- anon/authenticated의 직접 테이블 접근을 차단하고
-- 서버 측 service_role만 임베딩 데이터를 관리할 수 있도록 합니다.
REVOKE ALL
ON TABLE "public"."ai_embeddings"
FROM "anon", "authenticated";

GRANT ALL
ON TABLE "public"."ai_embeddings"
TO "service_role";


-- ============================================================================
-- Function Permissions
-- ============================================================================

-- SECURITY DEFINER RPC이므로 일반 역할의 직접 실행 권한을 명시적으로 제거하고
-- 신뢰된 서버 실행 주체인 service_role에만 실행 권한을 부여합니다.
REVOKE ALL
ON FUNCTION "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision
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
    double precision
)
TO "service_role";


COMMIT;