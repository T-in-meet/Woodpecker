BEGIN;

-- ============================================================================
-- AI Prompt Agents
-- ============================================================================

/**
 * AI Prompt Agent의 최상위 메타데이터를 저장합니다.
 *
 * Agent는 하나 이상의 Prompt Family를 그룹화하는 논리적 단위입니다.
 * 실제 Prompt 내용과 lifecycle은 Prompt Family / Prompt Version 계층에서
 * 관리하므로 이 테이블은 Agent 자체의 식별 및 설명 정보만 담당합니다.
 *
 * Agent에는 별도의 key 또는 active 상태를 두지 않습니다.
 * 런타임에서 사용할 Prompt는 AI Setting이 특정 Prompt Version을
 * 참조하는 방식으로 결정합니다.
 */
CREATE TABLE "public"."ai_prompt_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "purpose" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_prompt_agents_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_prompt_agents_display_name_check"
        CHECK (
            char_length(btrim("display_name")) > 0
        )
);


-- ============================================================================
-- Indexes
-- ============================================================================

-- 관리자 목록에서 생성일 기준 정렬을 지원합니다.
CREATE INDEX "ai_prompt_agents_created_at_idx"
    ON "public"."ai_prompt_agents" (
        "created_at" DESC
    );

-- 관리자 목록에서 최근 수정일 기준 정렬을 지원합니다.
CREATE INDEX "ai_prompt_agents_updated_at_idx"
    ON "public"."ai_prompt_agents" (
        "updated_at" DESC
    );

-- 관리자 Agent 검색에서 display_name의 부분 문자열 검색을 지원합니다.
CREATE INDEX "ai_prompt_agents_display_name_trgm_idx"
    ON "public"."ai_prompt_agents"
    USING "gin" (
        "display_name" "extensions"."gin_trgm_ops"
    );

-- 관리자 Agent 검색에서 purpose의 부분 문자열 검색을 지원합니다.
CREATE INDEX "ai_prompt_agents_purpose_trgm_idx"
    ON "public"."ai_prompt_agents"
    USING "gin" (
        "purpose" "extensions"."gin_trgm_ops"
    );


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

/**
 * Agent가 수정될 때 updated_at을 자동으로 갱신합니다.
 */
CREATE OR REPLACE TRIGGER "tr_ai_prompt_agents_updated_at"
    BEFORE UPDATE ON "public"."ai_prompt_agents"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ============================================================================
-- Admin Views
-- ============================================================================

-- 관리자 Agent 목록에서 기본 메타데이터를 조회합니다.
CREATE OR REPLACE VIEW "public"."admin_ai_agent_list"
WITH ("security_invoker" = true)
AS
SELECT
    "agents"."id",
    "agents"."display_name",
    "agents"."purpose",
    0::integer AS "family_count",
    "agents"."created_at",
    "agents"."updated_at"
FROM "public"."ai_prompt_agents" AS "agents";


-- ============================================================================
-- Admin List RPCs
-- ============================================================================

/**
 * 관리자 AI Agent 목록을 조회합니다.
 *
 * 검색, 생성/수정 기간 필터를 적용하고 정렬 및 페이지네이션된 Agent 목록과
 * 전체 건수를 반환합니다. Prompt Family가 도입되기 전에는 family_count를
 * 0으로 반환합니다.
 * Prompt Family 도입 후에는 실제 Family 수를 집계하도록 확장합니다.
 */
CREATE OR REPLACE FUNCTION "public"."get_admin_ai_agent_list"(
    "p_search_field" "text",
    "p_search_query" "text",
    "p_family_count_min" integer,
    "p_family_count_max" integer,
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
                    'purpose'
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
                    'familyCount',
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
        FROM "public"."admin_ai_agent_list" AS "rows"
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
                "params"."search_field" = 'purpose'
                AND COALESCE(
                    "rows"."purpose",
                    ''
                ) ILIKE "params"."search_pattern"
                    ESCAPE '\'
            )
        )
        AND (
            "p_family_count_min" IS NULL
            OR "rows"."family_count" >= "p_family_count_min"
        )
        AND (
            "p_family_count_max" IS NULL
            OR "rows"."family_count" <= "p_family_count_max"
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
                        WHEN "params"."sort_field" = 'familyCount'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."family_count"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'familyCount'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."family_count"
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
-- Admin Agent Delete RPC
-- ============================================================================

/**
 * 관리자 Agent 삭제를 원자적으로 처리합니다.
 * Prompt Family가 도입되기 전에는 Agent 존재 여부만 확인한 뒤 삭제합니다.
 * Prompt Family 도입 후에는 연결된 Family를 고려한 삭제 보호를 적용합니다.
 */
CREATE OR REPLACE FUNCTION "public"."delete_admin_ai_agent"(
    "p_agent_id" "uuid"
)
RETURNS "text"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
    -- 삭제 대상 Agent가 존재하는지 먼저 확인합니다.
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."ai_prompt_agents"
        WHERE "id" = "p_agent_id"
    ) THEN
        RETURN 'NOT_FOUND';
    END IF;

    DELETE FROM "public"."ai_prompt_agents"
    WHERE "id" = "p_agent_id";

    RETURN 'OK';
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

/**
 * Agent 테이블은 일반 클라이언트에서 직접 접근하지 않습니다.
 *
 * 관리자 기능은 서버의 service_role 또는 제한된 관리자 RPC를 통해 접근합니다.
 */
ALTER TABLE "public"."ai_prompt_agents"
    ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Table Permissions
-- ============================================================================

-- 일반 클라이언트 역할의 직접 테이블 접근을 차단합니다.
REVOKE ALL
ON TABLE "public"."ai_prompt_agents"
FROM "anon", "authenticated";

-- 서버 관리자 작업에서만 Agent 데이터를 직접 관리할 수 있습니다.
GRANT ALL
ON TABLE "public"."ai_prompt_agents"
TO "service_role";


-- ============================================================================
-- View / Function Permissions
-- ============================================================================

COMMENT ON VIEW "public"."admin_ai_agent_list" IS
    '관리자 AI Agent 목록의 검색, 필터, 정렬, 페이지네이션을 위한 조회 전용 View';

REVOKE ALL
ON TABLE "public"."admin_ai_agent_list"
FROM "anon", "authenticated";

GRANT SELECT
ON TABLE "public"."admin_ai_agent_list"
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."get_admin_ai_agent_list"(
    "text", "text", integer, integer,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, timestamp with time zone,
    "text", "text", integer, integer
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."get_admin_ai_agent_list"(
    "text", "text", integer, integer,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, timestamp with time zone,
    "text", "text", integer, integer
)
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."delete_admin_ai_agent"("uuid")
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."delete_admin_ai_agent"("uuid")
TO "service_role";


COMMIT;
