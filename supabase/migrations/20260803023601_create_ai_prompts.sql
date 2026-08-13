BEGIN;

-- ============================================================================
-- AI Prompt Families
-- ============================================================================

/**
 * Agent에 속한 Prompt Family의 메타데이터를 저장합니다.
 * 실제 Prompt 내용과 lifecycle은 ai_prompt_versions에서 관리합니다.
 */
CREATE TABLE "public"."ai_prompt_families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_prompt_families_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_prompt_families_display_name_check"
        CHECK (
            char_length(btrim("display_name")) > 0
        )
);


-- ============================================================================
-- AI Prompt Versions
-- ============================================================================

/**
 * Prompt Family에 속한 버전별 Prompt 내용과 lifecycle 상태를 저장합니다.
 * lifecycle은 draft, published, archived 중 하나이며 version_number는 Family 내에서 유일합니다.
 */
CREATE TABLE "public"."ai_prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "display_name" "text" NOT NULL,
    "change_summary" "text",
    "lifecycle_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "system_template" "text" NOT NULL,
    "user_template" "text" NOT NULL,
    "response_schema" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by_kind" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_prompt_versions_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_prompt_versions_family_version_key"
        UNIQUE ("family_id", "version_number"),

    CONSTRAINT "ai_prompt_versions_created_by_kind_check"
        CHECK (
            "created_by_kind" = ANY (
                ARRAY[
                    'system'::"text",
                    'user'::"text"
                ]
            )
        ),

    CONSTRAINT "ai_prompt_versions_created_by_consistency_check"
        CHECK (
            (
                "created_by_kind" = 'system'::"text"
                AND "created_by" IS NULL
            )
            OR (
                "created_by_kind" = 'user'::"text"
                AND "created_by" IS NOT NULL
            )
        ),

    CONSTRAINT "ai_prompt_versions_display_name_check"
        CHECK (
            char_length(btrim("display_name")) > 0
        ),

    CONSTRAINT "ai_prompt_versions_lifecycle_status_check"
        CHECK (
            "lifecycle_status" = ANY (
                ARRAY[
                    'draft'::"text",
                    'published'::"text",
                    'archived'::"text"
                ]
            )
        ),

    CONSTRAINT "ai_prompt_versions_response_schema_object_check"
        CHECK (
            jsonb_typeof("response_schema") = 'object'
        ),

    CONSTRAINT "ai_prompt_versions_system_template_check"
        CHECK (
            char_length(btrim("system_template")) > 0
        ),

    CONSTRAINT "ai_prompt_versions_user_template_check"
        CHECK (
            char_length(btrim("user_template")) > 0
        ),

    CONSTRAINT "ai_prompt_versions_variables_array_check"
        CHECK (
            jsonb_typeof("variables") = 'array'
        ),

    CONSTRAINT "ai_prompt_versions_version_number_check"
        CHECK (
            "version_number" > 0
        )
);



-- ============================================================================
-- Foreign Keys
-- ============================================================================

-- Prompt Family는 반드시 하나의 Agent에 속하도록 외래 키를 연결합니다.
ALTER TABLE ONLY "public"."ai_prompt_families"
    ADD CONSTRAINT "ai_prompt_families_agent_id_fkey"
    FOREIGN KEY ("agent_id")
    REFERENCES "public"."ai_prompt_agents"("id")
    ON DELETE RESTRICT;

-- Prompt Version은 반드시 하나의 Prompt Family에 속하도록 외래 키를 연결합니다.
ALTER TABLE ONLY "public"."ai_prompt_versions"
    ADD CONSTRAINT "ai_prompt_versions_family_id_fkey"
    FOREIGN KEY ("family_id")
    REFERENCES "public"."ai_prompt_families"("id")
    ON DELETE RESTRICT;

-- 사용자에 의해 생성된 Prompt Version의 생성자 정보를 auth.users와 연결합니다.
ALTER TABLE ONLY "public"."ai_prompt_versions"
    ADD CONSTRAINT "ai_prompt_versions_created_by_fkey"
    FOREIGN KEY ("created_by")
    REFERENCES "auth"."users"("id")
    ON DELETE RESTRICT;



-- ============================================================================
-- Indexes
-- ============================================================================

-- Agent별 Prompt Family 조회를 지원합니다.
CREATE INDEX "ai_prompt_families_agent_idx"
    ON "public"."ai_prompt_families" (
        "agent_id"
    );

-- Family와 lifecycle 상태별 Prompt Version 조회 및 최신 버전 정렬을 지원합니다.
CREATE INDEX "ai_prompt_versions_family_status_idx"
    ON "public"."ai_prompt_versions" (
        "family_id",
        "lifecycle_status",
        "version_number" DESC
    );


-- 관리자 목록에서 Prompt Family 생성일 기준 정렬을 지원합니다.
CREATE INDEX "ai_prompt_families_created_at_idx"
    ON "public"."ai_prompt_families" (
        "created_at" DESC
    );

-- 관리자 목록에서 Prompt Family 최근 수정일 기준 정렬을 지원합니다.
CREATE INDEX "ai_prompt_families_updated_at_idx"
    ON "public"."ai_prompt_families" (
        "updated_at" DESC
    );

-- 관리자 Prompt Family 검색에서 display_name의 부분 문자열 검색을 지원합니다.
CREATE INDEX "ai_prompt_families_display_name_trgm_idx"
    ON "public"."ai_prompt_families"
    USING "gin" (
        "display_name" "extensions"."gin_trgm_ops"
    );

-- 관리자 Prompt Version 검색에서 display_name의 부분 문자열 검색을 지원합니다.
CREATE INDEX "ai_prompt_versions_display_name_trgm_idx"
    ON "public"."ai_prompt_versions"
    USING "gin" (
        "display_name" "extensions"."gin_trgm_ops"
    );


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

/**
 * Prompt Family가 수정될 때 updated_at을 자동으로 갱신합니다.
 */
CREATE OR REPLACE TRIGGER "tr_ai_prompt_families_updated_at"
    BEFORE UPDATE ON "public"."ai_prompt_families"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();



-- ============================================================================
-- Published Prompt Template Protection
-- ============================================================================

/**
 * published Version의 system_template과 user_template 변경을 차단합니다.
 * 배포된 Prompt의 실제 Template 이력은 보존하되, Template 이외의 수정 가능한 메타데이터는 제한하지 않습니다.
 */
CREATE OR REPLACE FUNCTION "public"."prevent_published_ai_prompt_template_update"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SET "search_path" = "public"
AS $$
BEGIN
    IF OLD."lifecycle_status" = 'published'
       AND (
           NEW."system_template" IS DISTINCT FROM OLD."system_template"
           OR NEW."user_template" IS DISTINCT FROM OLD."user_template"
       )
    THEN
        RAISE EXCEPTION 'Published AI prompt templates cannot be modified'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

/**
 * published Prompt Version의 Template 변경 시 보호 함수를 실행합니다.
 */
CREATE OR REPLACE TRIGGER "tr_prevent_published_ai_prompt_template_update"
    BEFORE UPDATE OF "system_template", "user_template"
    ON "public"."ai_prompt_versions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."prevent_published_ai_prompt_template_update"();


-- ============================================================================
-- Seed Data
-- ============================================================================

/**
 * Notes RAG Answer 기능에서 사용할 초기 Agent, Family, published Version을 생성합니다.
 *
 * Agent → Family → Version 순서로 생성하며,
 * 생성된 ID를 다음 계층의 외래 키로 연결합니다.
 */
DO $$
DECLARE
    "seed_agent_id" "uuid";
    "seed_family_id" "uuid";
BEGIN
    -- Notes RAG Answer 기능의 최상위 Agent를 생성합니다.
    INSERT INTO "public"."ai_prompt_agents" (
        "display_name",
        "description",
        "purpose",
        "tags"
    )
    VALUES (
        'Notes RAG Answer',
        'Answers user questions using the user''s own notes as evidence.',
        'Generate grounded answers for the first notes RAG user feature.',
        ARRAY['notes', 'rag']::"text"[]
    )
    RETURNING "id"
    INTO "seed_agent_id";

    -- 생성한 Agent에 기본 Prompt Family를 연결합니다.
    INSERT INTO "public"."ai_prompt_families" (
        "agent_id",
        "display_name",
        "description",
        "tags"
    )
    VALUES (
        "seed_agent_id",
        'Default',
        'Default prompt family for the system Notes RAG Answer agent.',
        ARRAY['notes', 'rag']::"text"[]
    )
    RETURNING "id"
    INTO "seed_family_id";

    -- 기본 Family에 최초 published Prompt Version을 생성합니다.
    INSERT INTO "public"."ai_prompt_versions" (
        "family_id",
        "version_number",
        "display_name",
        "change_summary",
        "lifecycle_status",
        "system_template",
        "user_template",
        "response_schema",
        "variables",
        "tags",
        "created_by_kind",
        "created_by"
    )
    VALUES (
        "seed_family_id",
        1,
        'Initial Notes RAG Answer Prompt',
        'Initial system seed prompt for notes RAG answer generation.',
        'published',
        'You answer questions using only the provided user notes. If the notes do notcontain enough evidence, say that the notes do not provide enough information. Answerin Korean.',
        'Question: {{question}}

Reference notes:
{{contextNotes}}

Write a concise answer grounded in the reference notes.',
        '{}'::"jsonb",
        '["question", "contextNotes"]'::"jsonb",
        ARRAY['notes', 'rag']::"text"[],
        'system',
        NULL
    );
END;
$$;

-- ============================================================================
-- Admin Views
-- ============================================================================

-- 관리자 Agent 목록에서 Family 개수와 기본 메타데이터를 함께 조회합니다.
CREATE OR REPLACE VIEW "public"."admin_ai_agent_list"
WITH ("security_invoker" = true)
AS
WITH "family_counts" AS (
    SELECT
        "agent_id",
        count(*)::integer AS "family_count"
    FROM "public"."ai_prompt_families"
    GROUP BY "agent_id"
)
SELECT
    "agents"."id",
    "agents"."display_name",
    "agents"."purpose",
    COALESCE(
        "family_counts"."family_count",
        0
    ) AS "family_count",
    "agents"."created_at",
    "agents"."updated_at"
FROM "public"."ai_prompt_agents" AS "agents"
LEFT JOIN "family_counts"
    ON "family_counts"."agent_id" = "agents"."id";



-- 관리자 Prompt Family 목록에서 Agent 정보와 lifecycle별 Version 개수를 함께 조회합니다.
CREATE OR REPLACE VIEW "public"."admin_ai_prompt_family_list"
WITH ("security_invoker" = true)
AS
WITH "version_counts" AS (
    SELECT
        "family_id",
        count(*) FILTER (
            WHERE "lifecycle_status" = 'draft'
        )::integer AS "draft_version_count",
        count(*) FILTER (
            WHERE "lifecycle_status" = 'published'
        )::integer AS "published_version_count",
        count(*) FILTER (
            WHERE "lifecycle_status" = 'archived'
        )::integer AS "archived_version_count"
    FROM "public"."ai_prompt_versions"
    GROUP BY "family_id"
)
SELECT
    "families"."id",
    "families"."agent_id",
    "agents"."display_name"
        AS "agent_display_name",
    "families"."display_name",
    COALESCE(
        "version_counts"."draft_version_count",
        0
    ) AS "draft_version_count",
    COALESCE(
        "version_counts"."published_version_count",
        0
    ) AS "published_version_count",
    COALESCE(
        "version_counts"."archived_version_count",
        0
    ) AS "archived_version_count",
    "families"."created_at",
    "families"."updated_at"
FROM "public"."ai_prompt_families" AS "families"
JOIN "public"."ai_prompt_agents" AS "agents"
    ON "agents"."id" = "families"."agent_id"
LEFT JOIN "version_counts"
    ON "version_counts"."family_id" = "families"."id";


-- ============================================================================
-- Admin List RPCs
-- ============================================================================

/**
 * 관리자 AI Agent 목록을 조회합니다.
 *
 * 검색, Family 개수, 생성/수정 기간 필터를 적용하고
 * 정렬 및 페이지네이션된 Agent 목록과 전체 건수를 반환합니다.
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



/**
 * 관리자 AI Prompt Family 목록을 조회합니다.
 *
 * 검색, Agent, lifecycle별 Version 개수, 생성/수정 기간 필터를 적용하고
 * 정렬 및 페이지네이션된 Prompt Family 목록과 전체 건수를 반환합니다.
 */
CREATE OR REPLACE FUNCTION "public"."get_admin_ai_prompt_family_list"(
    "p_search_field" "text",
    "p_search_query" "text",
    "p_agent_id_filters" "uuid"[],
    "p_draft_count_min" integer,
    "p_draft_count_max" integer,
    "p_published_count_min" integer,
    "p_published_count_max" integer,
    "p_archived_count_min" integer,
    "p_archived_count_max" integer,
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
                    'agentDisplayName'
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
                    'agentDisplayName',
                    'draftVersionCount',
                    'publishedVersionCount',
                    'archivedVersionCount',
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
        FROM "public"."admin_ai_prompt_family_list" AS "rows"
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
                "params"."search_field" = 'agentDisplayName'
                AND "rows"."agent_display_name"
                    ILIKE "params"."search_pattern"
                    ESCAPE '\'
            )
        )
        AND (
            COALESCE(
                array_length("p_agent_id_filters", 1),
                0
            ) = 0
            OR "rows"."agent_id" = ANY("p_agent_id_filters")
        )
        AND (
            "p_draft_count_min" IS NULL
            OR "rows"."draft_version_count"
                >= "p_draft_count_min"
        )
        AND (
            "p_draft_count_max" IS NULL
            OR "rows"."draft_version_count"
                <= "p_draft_count_max"
        )
        AND (
            "p_published_count_min" IS NULL
            OR "rows"."published_version_count"
                >= "p_published_count_min"
        )
        AND (
            "p_published_count_max" IS NULL
            OR "rows"."published_version_count"
                <= "p_published_count_max"
        )
        AND (
            "p_archived_count_min" IS NULL
            OR "rows"."archived_version_count"
                >= "p_archived_count_min"
        )
        AND (
            "p_archived_count_max" IS NULL
            OR "rows"."archived_version_count"
                <= "p_archived_count_max"
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
                        WHEN "params"."sort_field" = 'agentDisplayName'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."agent_display_name"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'agentDisplayName'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."agent_display_name"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'draftVersionCount'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."draft_version_count"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'draftVersionCount'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."draft_version_count"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'publishedVersionCount'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."published_version_count"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'publishedVersionCount'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."published_version_count"
                    END DESC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'archivedVersionCount'
                         AND "params"."sort_direction" = 'asc'
                        THEN "filtered"."archived_version_count"
                    END ASC NULLS LAST,

                    CASE
                        WHEN "params"."sort_field" = 'archivedVersionCount'
                         AND "params"."sort_direction" = 'desc'
                        THEN "filtered"."archived_version_count"
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
-- Prompt Creation RPCs
-- ============================================================================

/**
 * Prompt Family와 최초 draft Version(v1)을 하나의 트랜잭션 안에서 생성합니다.
 */
CREATE OR REPLACE FUNCTION "public"."create_ai_prompt_family_with_initial_version"(
    "p_agent_id" "uuid",
    "p_display_name" "text",
    "p_description" "text",
    "p_tags" "text"[],
    "p_version_display_name" "text",
    "p_change_summary" "text",
    "p_system_template" "text",
    "p_user_template" "text",
    "p_response_schema" "jsonb",
    "p_variables" "jsonb",
    "p_admin_user_id" "uuid"
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
    "new_family_id" "uuid";
BEGIN
    -- 새 Prompt Family를 생성합니다.
    INSERT INTO "public"."ai_prompt_families" (
        "agent_id",
        "display_name",
        "description",
        "tags"
    )
    VALUES (
        "p_agent_id",
        "p_display_name",
        NULLIF("p_description", ''),
        COALESCE("p_tags", '{}'::"text"[])
    )
    RETURNING "id"
    INTO "new_family_id";

    -- 생성한 Family에 최초 draft Prompt Version을 함께 생성합니다.
    INSERT INTO "public"."ai_prompt_versions" (
        "family_id",
        "version_number",
        "display_name",
        "change_summary",
        "lifecycle_status",
        "system_template",
        "user_template",
        "response_schema",
        "variables",
        "tags",
        "created_by_kind",
        "created_by"
    )
    VALUES (
        "new_family_id",
        1,
        "p_version_display_name",
        NULLIF("p_change_summary", ''),
        'draft',
        "p_system_template",
        "p_user_template",
        COALESCE("p_response_schema", '{}'::"jsonb"),
        COALESCE("p_variables", '[]'::"jsonb"),
        COALESCE("p_tags", '{}'::"text"[]),
        'user',
        "p_admin_user_id"
    );

    RETURN "new_family_id";
END;
$$;

/**
 * 기존 Family에 다음 version_number를 계산하여 새로운 draft Version을 생성합니다.
 * Family Row를 잠가 동일 Family에서 동시에 Version을 생성할 때 번호 충돌을 방지합니다.
 */
CREATE OR REPLACE FUNCTION "public"."create_ai_prompt_version"(
    "p_family_id" "uuid",
    "p_display_name" "text",
    "p_change_summary" "text",
    "p_system_template" "text",
    "p_user_template" "text",
    "p_response_schema" "jsonb",
    "p_variables" "jsonb",
    "p_tags" "text"[],
    "p_admin_user_id" "uuid"
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
    "next_version_number" integer;
    "new_version_id" "uuid";
BEGIN
    PERFORM 1
    FROM "public"."ai_prompt_families"
    WHERE "id" = "p_family_id"
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI prompt family not found'
            USING ERRCODE = '23503';
    END IF;

    SELECT
        COALESCE(
            MAX("version_number"),
            0
        ) + 1
    INTO "next_version_number"
    FROM "public"."ai_prompt_versions"
    WHERE "family_id" = "p_family_id";

        -- 기존 Family에 다음 순번의 draft Prompt Version을 생성합니다.
    INSERT INTO "public"."ai_prompt_versions" (
        "family_id",
        "version_number",
        "display_name",
        "change_summary",
        "lifecycle_status",
        "system_template",
        "user_template",
        "response_schema",
        "variables",
        "tags",
        "created_by_kind",
        "created_by"
    )
    VALUES (
        "p_family_id",
        "next_version_number",
        "p_display_name",
        NULLIF("p_change_summary", ''),
        'draft',
        "p_system_template",
        "p_user_template",
        COALESCE("p_response_schema", '{}'::"jsonb"),
        COALESCE("p_variables", '[]'::"jsonb"),
        COALESCE("p_tags", '{}'::"text"[]),
        'user',
        "p_admin_user_id"
    )
    RETURNING "id"
    INTO "new_version_id";

    RETURN "new_version_id";
END;
$$;


-- ============================================================================
-- Prompt Lifecycle RPCs
-- ============================================================================

/**
 * draft 또는 archived Version을 published 상태로 전환합니다.
 * 이미 published이거나 존재하지 않는 Version은 NOT_PUBLISHABLE을 반환합니다.
 */
CREATE OR REPLACE FUNCTION "public"."publish_ai_prompt_version"(
    "p_version_id" "uuid"
)
RETURNS "text"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
BEGIN
    UPDATE "public"."ai_prompt_versions"
    SET "lifecycle_status" = 'published'
    WHERE "id" = "p_version_id"
      AND "lifecycle_status" IN (
          'draft',
          'archived'
      );

    IF NOT FOUND THEN
        RETURN 'NOT_PUBLISHABLE';
    END IF;

    RETURN 'OK';
END;
$$;



/**
 * published Version을 archived 상태로 전환합니다.
 * published 상태가 아니거나 존재하지 않는 Version은 NOT_PUBLISHED를 반환합니다.
 */
CREATE OR REPLACE FUNCTION "public"."archive_ai_prompt_version"(
    "p_version_id" "uuid"
)
RETURNS "text"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
BEGIN
    UPDATE "public"."ai_prompt_versions"
    SET "lifecycle_status" = 'archived'
    WHERE "id" = "p_version_id"
      AND "lifecycle_status" = 'published';

    IF NOT FOUND THEN
        RETURN 'NOT_PUBLISHED';
    END IF;

    RETURN 'OK';
END;
$$;


-- ============================================================================
-- Admin Delete RPCs
-- ============================================================================

/**
 * 관리자 Prompt Family 삭제를 원자적으로 처리합니다.
 * 하위 Version의 lifecycle과 관계없이 Version을 모두 삭제한 뒤 Family를 삭제합니다.
 *
 * AI Setting 참조 보호는 Settings 테이블 도입 후 Settings PR에서 보강합니다.
 */
CREATE OR REPLACE FUNCTION "public"."delete_admin_ai_prompt_family"(
    "p_family_id" "uuid"
)
RETURNS "text"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
    -- 삭제 대상 Prompt Family가 존재하는지 먼저 확인합니다.
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."ai_prompt_families"
        WHERE "id" = "p_family_id"
    ) THEN
        RETURN 'NOT_FOUND';
    END IF;

    DELETE FROM "public"."ai_prompt_versions"
    WHERE "family_id" = "p_family_id";

    DELETE FROM "public"."ai_prompt_families"
    WHERE "id" = "p_family_id";

    RETURN 'OK';
END;
$$;

/**
 * 관리자 Agent 삭제를 원자적으로 처리합니다.
 * 하위 Prompt Version과 Family를 모두 삭제한 뒤 Agent를 삭제합니다.
 *
 * AI Setting 참조 보호는 Settings 테이블 도입 후 Settings PR에서 보강합니다.
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

    DELETE FROM "public"."ai_prompt_versions"
    WHERE "family_id" IN (
        SELECT "id"
        FROM "public"."ai_prompt_families"
        WHERE "agent_id" = "p_agent_id"
    );

    DELETE FROM "public"."ai_prompt_families"
    WHERE "agent_id" = "p_agent_id";

    DELETE FROM "public"."ai_prompt_agents"
    WHERE "id" = "p_agent_id";

    RETURN 'OK';
END;
$$;


-- ============================================================================
-- Row Level Security
-- ============================================================================

/**
 * Prompt Family와 Prompt Version 테이블은 일반 클라이언트에서 직접 접근하지 않습니다.
 *
 * 관리자 기능은 서버의 service_role 또는 허용된 RPC를 통해 접근합니다.
 */
ALTER TABLE "public"."ai_prompt_families"
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_prompt_versions"
    ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Table Permissions
-- ============================================================================

-- 일반 클라이언트 역할의 Prompt Family / Version 직접 접근을 차단합니다.
REVOKE ALL
ON TABLE "public"."ai_prompt_families"
FROM "anon", "authenticated";

REVOKE ALL
ON TABLE "public"."ai_prompt_versions"
FROM "anon", "authenticated";

-- 서버 관리자 작업에서만 Prompt Family / Version을 직접 관리할 수 있습니다.
GRANT ALL
ON TABLE "public"."ai_prompt_families"
TO "service_role";

GRANT ALL
ON TABLE "public"."ai_prompt_versions"
TO "service_role";


-- ============================================================================
-- Internal Function Permissions
-- ============================================================================

-- published Template 보호 함수는 일반 클라이언트가 직접 호출할 수 없도록 제한합니다.
REVOKE ALL
ON FUNCTION "public"."prevent_published_ai_prompt_template_update"()
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."prevent_published_ai_prompt_template_update"()
TO "service_role";


-- ============================================================================
-- View Comments / Permissions
-- ============================================================================

-- 관리자 목록 View의 용도를 DB 메타데이터에 기록하고 service_role에만 조회를 허용합니다.
COMMENT ON VIEW "public"."admin_ai_agent_list" IS
    '관리자 AI Agent 목록의 검색, 필터, 정렬, 페이지네이션을 위한 조회 전용 View';

COMMENT ON VIEW "public"."admin_ai_prompt_family_list" IS
    '관리자 AI Prompt Family 목록의 검색, 필터, 정렬, 페이지네이션을 위한 조회 전용 View';

REVOKE ALL
ON TABLE "public"."admin_ai_agent_list"
FROM "anon", "authenticated";

REVOKE ALL
ON TABLE "public"."admin_ai_prompt_family_list"
FROM "anon", "authenticated";

GRANT SELECT
ON TABLE "public"."admin_ai_agent_list"
TO "service_role";

GRANT SELECT
ON TABLE "public"."admin_ai_prompt_family_list"
TO "service_role";


-- ============================================================================
-- Admin Function Permissions
-- ============================================================================

-- 관리자 전용 RPC는 일반 클라이언트의 직접 실행을 차단하고 service_role에만 허용합니다.
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
ON FUNCTION "public"."get_admin_ai_prompt_family_list"(
    "text", "text", "uuid"[],
    integer, integer, integer, integer, integer, integer,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, timestamp with time zone,
    "text", "text", integer, integer
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."get_admin_ai_prompt_family_list"(
    "text", "text", "uuid"[],
    integer, integer, integer, integer, integer, integer,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, timestamp with time zone,
    "text", "text", integer, integer
)
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."create_ai_prompt_family_with_initial_version"(
    "uuid", "text", "text", "text"[],
    "text", "text", "text", "text", "jsonb", "jsonb", "uuid"
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."create_ai_prompt_family_with_initial_version"(
    "uuid", "text", "text", "text"[],
    "text", "text", "text", "text", "jsonb", "jsonb", "uuid"
)
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."create_ai_prompt_version"(
    "uuid", "text", "text", "text", "text",
    "jsonb", "jsonb", "text"[], "uuid"
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."create_ai_prompt_version"(
    "uuid", "text", "text", "text", "text",
    "jsonb", "jsonb", "text"[], "uuid"
)
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."publish_ai_prompt_version"("uuid")
FROM PUBLIC, "anon", "authenticated";
GRANT ALL
ON FUNCTION "public"."publish_ai_prompt_version"("uuid")
TO "service_role";


REVOKE ALL
ON FUNCTION "public"."archive_ai_prompt_version"("uuid")
FROM PUBLIC, "anon", "authenticated";
GRANT ALL
ON FUNCTION "public"."archive_ai_prompt_version"("uuid")
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."delete_admin_ai_prompt_family"("uuid")
FROM PUBLIC, "anon", "authenticated";
GRANT ALL
ON FUNCTION "public"."delete_admin_ai_prompt_family"("uuid")
TO "service_role";

REVOKE ALL
ON FUNCTION "public"."delete_admin_ai_agent"("uuid")
FROM PUBLIC, "anon", "authenticated";
GRANT ALL
ON FUNCTION "public"."delete_admin_ai_agent"("uuid")
TO "service_role";


COMMIT;
