BEGIN;

-- ============================================================================
-- AI Model Configs
-- ============================================================================

CREATE TABLE "public"."ai_model_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "capability" "text" NOT NULL,
    "dimensions" integer,
    "distance_metric" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_model_configs_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_model_configs_provider_model_capability_key"
        UNIQUE ("provider", "model", "capability"),

    CONSTRAINT "ai_model_configs_capability_check"
        CHECK (
            "capability" = ANY (
                ARRAY[
                    'chat'::"text",
                    'embedding'::"text"
                ]
            )
        ),

    CONSTRAINT "ai_model_configs_dimensions_check"
        CHECK (
            "dimensions" IS NULL
            OR "dimensions" > 0
        ),

    CONSTRAINT "ai_model_configs_display_name_check"
        CHECK (
            char_length(btrim("display_name")) > 0
        ),

    CONSTRAINT "ai_model_configs_distance_metric_check"
        CHECK (
            "distance_metric" IS NULL
            OR "distance_metric" = ANY (
                ARRAY[
                    'cosine'::"text",
                    'inner_product'::"text",
                    'l2'::"text"
                ]
            )
        ),

    CONSTRAINT "ai_model_configs_embedding_required_fields_check"
        CHECK (
            "capability" <> 'embedding'
            OR (
                "dimensions" IS NOT NULL
                AND "dimensions" = 1536
                AND "distance_metric" IS NOT NULL
            )
        ),

    CONSTRAINT "ai_model_configs_model_check"
        CHECK (
            char_length(btrim("model")) > 0
        ),

    CONSTRAINT "ai_model_configs_provider_check"
        CHECK (
            char_length(btrim("provider")) > 0
        )
);


-- ============================================================================
-- Embedding Model Reference
-- ============================================================================

/*
 * ai_embeddings는 Models보다 먼저 생성된다.
 * model_config_id 컬럼은 Embeddings migration에서 정의하고,
 * 참조 대상인 ai_model_configs가 생성된 이 시점에 FK를 연결한다.
 */
ALTER TABLE ONLY "public"."ai_embeddings"
    ADD CONSTRAINT "ai_embeddings_model_config_id_fkey"
    FOREIGN KEY ("model_config_id")
    REFERENCES "public"."ai_model_configs"("id")
    ON DELETE RESTRICT;


-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX "ai_model_configs_capability_active_idx"
    ON "public"."ai_model_configs" (
        "capability",
        "is_active"
    );

CREATE INDEX "ai_model_configs_created_at_idx"
    ON "public"."ai_model_configs" (
        "created_at" DESC
    );

CREATE INDEX "ai_model_configs_updated_at_idx"
    ON "public"."ai_model_configs" (
        "updated_at" DESC
    );

CREATE INDEX "ai_model_configs_display_name_trgm_idx"
    ON "public"."ai_model_configs"
    USING "gin" (
        "display_name" "extensions"."gin_trgm_ops"
    );

CREATE INDEX "ai_model_configs_model_trgm_idx"
    ON "public"."ai_model_configs"
    USING "gin" (
        "model" "extensions"."gin_trgm_ops"
    );


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE TRIGGER "tr_ai_model_configs_updated_at"
    BEFORE UPDATE ON "public"."ai_model_configs"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ============================================================================
-- Seed Data
-- ============================================================================

-- AI 기능에서 기본으로 사용할 모델 설정을 초기 데이터로 등록합니다.
-- 동일한 provider/model/capability 조합이 이미 존재하면 기존 데이터를 유지합니다.
INSERT INTO "public"."ai_model_configs" (
    "display_name",
    "provider",
    "model",
    "capability",
    "dimensions",
    "distance_metric",
    "notes"
)
VALUES
    (
        'OpenAI text-embedding-3-small',
        'openai',
        'text-embedding-3-small',
        'embedding',
        1536,
        'cosine',
        'Default 1536-dimensional embedding model for AI Foundation v1.'
    ),
    (
        'OpenAI gpt-4o-mini',
        'openai',
        'gpt-4o-mini',
        'chat',
        NULL,
        NULL,
        'Default chat model for AI Foundation v1.'
    )
ON CONFLICT ("provider", "model", "capability") DO NOTHING;


-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE "public"."ai_model_configs"
    ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Model Permissions
-- ============================================================================

REVOKE ALL
ON TABLE "public"."ai_model_configs"
FROM "anon", "authenticated";

GRANT ALL
ON TABLE "public"."ai_model_configs"
TO "service_role";


-- ============================================================================
-- Admin AI Model List View
-- ============================================================================

-- 관리자 AI 모델 목록 조회에 필요한 Embedding 참조 수를 함께 제공합니다.
CREATE OR REPLACE VIEW "public"."admin_ai_model_list"
WITH ("security_invoker" = true)
AS
WITH "embedding_reference_counts" AS (
    SELECT
        "model_config_id",
        count(*)::integer AS "embedding_reference_count"
    FROM "public"."ai_embeddings"
    GROUP BY "model_config_id"
)
SELECT
    "configs"."id",
    "configs"."display_name",
    "configs"."provider",
    "configs"."model",
    "configs"."capability",
    "configs"."is_active",
    COALESCE(
        "reference_counts"."embedding_reference_count",
        0
    ) AS "embedding_reference_count",
    "configs"."created_at",
    "configs"."updated_at"
FROM "public"."ai_model_configs" AS "configs"
LEFT JOIN "embedding_reference_counts" AS "reference_counts"
    ON "reference_counts"."model_config_id" = "configs"."id";


-- ============================================================================
-- Admin AI Model List RPC
-- ============================================================================

/**
 * 관리자 AI 모델 목록을 조회합니다.
 *
 * 검색, Provider/Capability/활성 상태/Embedding 참조 수/기간 필터를 적용하고,
 * 정렬 및 페이지네이션된 모델 목록과 전체 건수를 반환합니다.
 */
CREATE OR REPLACE FUNCTION "public"."get_admin_ai_model_list"(
    "p_search_field" "text",
    "p_search_query" "text",
    "p_provider_filters" "text"[],
    "p_capability_filters" "text"[],
    "p_is_active_filter" boolean,
    "p_reference_count_min" integer,
    "p_reference_count_max" integer,
    "p_created_from" timestamp with time zone,
    "p_created_to" timestamp with time zone,
    "p_updated_from" timestamp with time zone,
    "p_updated_to" timestamp with time zone,
    "p_sort_field" "text",
    "p_sort_direction" "text",
    "p_page" integer,
    "p_page_size" integer
)
RETURNS TABLE (
    "items" "jsonb",
    "total_count" bigint
)
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
    WITH "params" AS (
        SELECT
            CASE
                WHEN "p_search_field" IN (
                    'displayName',
                    'model'
                )
                THEN "p_search_field"
                ELSE 'displayName'
            END AS "search_field",

            '%' ||
            replace(
                replace(
                    replace(
                        trim(COALESCE("p_search_query", '')),
                        '\',
                        '\\'
                    ),
                    '%',
                    '\%'
                ),
                '_',
                '\_'
            ) ||
            '%' AS "search_pattern",

            trim(
                COALESCE("p_search_query", '')
            ) AS "search_query",

            CASE
                WHEN "p_sort_field" IN (
                    'displayName',
                    'provider',
                    'model',
                    'capability',
                    'embeddingReferenceCount',
                    'createdAt',
                    'updatedAt'
                )
                THEN "p_sort_field"
                ELSE 'updatedAt'
            END AS "sort_field",

            CASE
                WHEN "p_sort_direction" = 'asc'
                THEN 'asc'
                ELSE 'desc'
            END AS "sort_direction",

            GREATEST(
                COALESCE("p_page", 1),
                1
            ) AS "page",

            LEAST(
                GREATEST(
                    COALESCE("p_page_size", 10),
                    1
                ),
                100
            ) AS "page_size"
    ),

    "filtered" AS (
        SELECT "rows".*
        FROM "public"."admin_ai_model_list" AS "rows"
        CROSS JOIN "params"
        WHERE (
            "params"."search_query" = ''
            OR (
                "params"."search_field" = 'displayName'
                AND "rows"."display_name"
                    ILIKE "params"."search_pattern"
                    ESCAPE '\'
            )
            OR (
                "params"."search_field" = 'model'
                AND "rows"."model"
                    ILIKE "params"."search_pattern"
                    ESCAPE '\'
            )
        )
        AND (
            COALESCE(
                array_length("p_provider_filters", 1),
                0
            ) = 0
            OR "rows"."provider" = ANY("p_provider_filters")
        )
        AND (
            COALESCE(
                array_length("p_capability_filters", 1),
                0
            ) = 0
            OR "rows"."capability" = ANY("p_capability_filters")
        )
        AND (
            "p_is_active_filter" IS NULL
            OR "rows"."is_active" = "p_is_active_filter"
        )
        AND (
            "p_reference_count_min" IS NULL
            OR "rows"."embedding_reference_count"
                >= "p_reference_count_min"
        )
        AND (
            "p_reference_count_max" IS NULL
            OR "rows"."embedding_reference_count"
                <= "p_reference_count_max"
        )
        AND (
            "p_created_from" IS NULL
            OR "rows"."created_at" >= "p_created_from"
        )
        AND (
            "p_created_to" IS NULL
            OR "rows"."created_at" < "p_created_to"
        )
        AND (
            "p_updated_from" IS NULL
            OR "rows"."updated_at" >= "p_updated_from"
        )
        AND (
            "p_updated_to" IS NULL
            OR "rows"."updated_at" < "p_updated_to"
        )
    ),

    "page_rows" AS (
        SELECT
            row_number() OVER (
                ORDER BY
                    CASE
                        WHEN "params"."sort_field" = 'displayName'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."display_name"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'displayName'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."display_name"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'provider'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."provider"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'provider'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."provider"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'model'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."model"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'model'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."model"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'capability'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."capability"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'capability'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."capability"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field"
                            = 'embeddingReferenceCount'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."embedding_reference_count"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field"
                            = 'embeddingReferenceCount'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."embedding_reference_count"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'createdAt'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."created_at"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'createdAt'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."created_at"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'updatedAt'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."updated_at"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'updatedAt'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."updated_at"
                    END DESC NULLS LAST,

                    "filtered"."id" ASC
            ) AS "page_order",
            "filtered".*
        FROM "filtered"
        CROSS JOIN "params"
        ORDER BY "page_order"
        LIMIT (
            SELECT "page_size"
            FROM "params"
        )
        OFFSET (
            (
                SELECT "page"
                FROM "params"
            ) - 1
        ) * (
            SELECT "page_size"
            FROM "params"
        )
    )

    SELECT
        COALESCE(
            jsonb_agg(
                to_jsonb("page_rows") - 'page_order'
                ORDER BY "page_rows"."page_order"
            ),
            '[]'::jsonb
        ) AS "items",
        (
            SELECT count(*)
            FROM "filtered"
        ) AS "total_count"
    FROM "page_rows";
$$;


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON VIEW "public"."admin_ai_model_list" IS
    '관리자 AI 모델 목록의 검색, 필터, 정렬, 페이지네이션을 위한 조회 전용 View';


-- ============================================================================
-- Admin View Permissions
-- ============================================================================

REVOKE ALL
ON TABLE "public"."admin_ai_model_list"
FROM "anon", "authenticated";

GRANT SELECT
ON TABLE "public"."admin_ai_model_list"
TO "service_role";


-- ============================================================================
-- Admin Function Permissions
-- ============================================================================

REVOKE ALL
ON FUNCTION "public"."get_admin_ai_model_list"(
    "text",
    "text",
    "text"[],
    "text"[],
    boolean,
    integer,
    integer,
    timestamp with time zone,
    timestamp with time zone,
    timestamp with time zone,
    timestamp with time zone,
    "text",
    "text",
    integer,
    integer
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."get_admin_ai_model_list"(
    "text",
    "text",
    "text"[],
    "text"[],
    boolean,
    integer,
    integer,
    timestamp with time zone,
    timestamp with time zone,
    timestamp with time zone,
    timestamp with time zone,
    "text",
    "text",
    integer,
    integer
)
TO "service_role";


COMMIT;