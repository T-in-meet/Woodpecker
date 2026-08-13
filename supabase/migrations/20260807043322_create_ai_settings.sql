BEGIN;

-- ============================================================================
-- AI Settings
-- ============================================================================

CREATE TABLE "public"."ai_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_settings_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_settings_key_key"
        UNIQUE ("key")
);

COMMENT ON TABLE "public"."ai_settings" IS
    'AI 기능에서 사용하는 설정입니다.';

COMMENT ON COLUMN "public"."ai_settings"."id" IS
    'AI 설정 ID입니다.';

COMMENT ON COLUMN "public"."ai_settings"."key" IS
    '애플리케이션에서 AI 설정을 조회할 때 사용하는 고유 키입니다.';

COMMENT ON COLUMN "public"."ai_settings"."display_name" IS
    '관리자 화면에 표시할 AI 설정 이름입니다.';

COMMENT ON COLUMN "public"."ai_settings"."description" IS
    'AI 설정의 목적과 사용처에 대한 설명입니다.';

COMMENT ON COLUMN "public"."ai_settings"."created_at" IS
    'AI 설정 생성 시각입니다.';

COMMENT ON COLUMN "public"."ai_settings"."updated_at" IS
    'AI 설정 최종 수정 시각입니다.';


-- ============================================================================
-- AI Setting Configurations
-- ============================================================================

CREATE TABLE "public"."ai_setting_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "model_config_id" "uuid" NOT NULL,
    "prompt_version_id" "uuid",
    "temperature" numeric,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_setting_configurations_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "ai_setting_configurations_setting_id_role_key_key"
        UNIQUE (
            "setting_id",
            "role_key"
        ),

    CONSTRAINT "ai_setting_configurations_kind_check"
        CHECK (
            "kind" IN (
                'chat',
                'embedding'
            )
        ),

    CONSTRAINT "ai_setting_configurations_role_key_format_check"
        CHECK (
            "role_key" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        ),

    CONSTRAINT "ai_setting_configurations_temperature_check"
        CHECK (
            "temperature" IS NULL
            OR (
                "temperature" >= 0
                AND "temperature" <= 2
            )
        ),

    CONSTRAINT "ai_setting_configurations_sort_order_check"
        CHECK (
            "sort_order" >= 0
        ),

    CONSTRAINT "ai_setting_configurations_kind_fields_check"
        CHECK (
            (
                "kind" = 'chat'
                AND "prompt_version_id" IS NOT NULL
                AND "temperature" IS NOT NULL
            )
            OR (
                "kind" = 'embedding'
                AND "prompt_version_id" IS NULL
                AND "temperature" IS NULL
            )
        )
);


-- ============================================================================
-- Foreign Keys
-- ============================================================================

ALTER TABLE ONLY "public"."ai_setting_configurations"
    ADD CONSTRAINT "ai_setting_configurations_setting_id_fkey"
    FOREIGN KEY ("setting_id")
    REFERENCES "public"."ai_settings"("id")
    ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_setting_configurations"
    ADD CONSTRAINT "ai_setting_configurations_model_config_id_fkey"
    FOREIGN KEY ("model_config_id")
    REFERENCES "public"."ai_model_configs"("id");

ALTER TABLE ONLY "public"."ai_setting_configurations"
    ADD CONSTRAINT "ai_setting_configurations_prompt_version_id_fkey"
    FOREIGN KEY ("prompt_version_id")
    REFERENCES "public"."ai_prompt_versions"("id");


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE "public"."ai_setting_configurations" IS
    'AI 설정에 연결된 Chat 및 Embedding 구성입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."id" IS
    'AI 구성 ID입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."setting_id" IS
    '구성이 속한 AI 설정 ID입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."role_key" IS
    'AI 기능이 설정 내 구성을 식별할 때 사용하는 역할 키입니다. 동일한 AI 설정 안에서 고유하며 소문자 kebab-case를 사용합니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."kind" IS
    'AI 구성 종류입니다. chat 또는 embedding 값을 사용합니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."model_config_id" IS
    '구성 실행에 사용할 AI 모델 설정 ID입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."prompt_version_id" IS
    'Chat 구성에서 사용할 Prompt Version ID입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."temperature" IS
    'Chat 모델 실행에 사용할 Temperature 값입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."sort_order" IS
    'AI 설정 안에서 구성의 표시 및 실행 순서를 나타냅니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."created_at" IS
    'AI 구성 생성 시각입니다.';

COMMENT ON COLUMN "public"."ai_setting_configurations"."updated_at" IS
    'AI 구성 최종 수정 시각입니다.';


-- ============================================================================
-- Updated At Triggers
-- ============================================================================

CREATE OR REPLACE TRIGGER "tr_ai_settings_updated_at"
    BEFORE UPDATE ON "public"."ai_settings"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "tr_ai_setting_configurations_updated_at"
    BEFORE UPDATE ON "public"."ai_setting_configurations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX "ai_setting_configurations_setting_order_idx"
    ON "public"."ai_setting_configurations" (
        "setting_id",
        "sort_order"
    );

CREATE INDEX "ai_setting_configurations_model_config_id_idx"
    ON "public"."ai_setting_configurations" (
        "model_config_id"
    );

CREATE INDEX "ai_setting_configurations_prompt_version_id_idx"
    ON "public"."ai_setting_configurations" (
        "prompt_version_id"
    )
    WHERE "prompt_version_id" IS NOT NULL;


-- ============================================================================
-- Save AI Setting Configurations RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."save_ai_setting_configurations"(
    "p_setting_id" "uuid",
    "p_configurations" "jsonb"
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    "configuration" jsonb;
    "configuration_index" integer;
    "configuration_kind" text;
    "configuration_role_key" text;
    "model_config_id" uuid;
    "prompt_version_id" uuid;
BEGIN
    -- 저장 대상 AI 설정이 실제로 존재하는지 확인합니다.
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."ai_settings"
        WHERE "id" = "p_setting_id"
    ) THEN
        RAISE EXCEPTION 'AI setting not found: %', "p_setting_id"
            USING ERRCODE = 'P0002';
    END IF;

    -- Configuration 입력은 JSON 배열이어야 합니다.
    IF "p_configurations" IS NULL
       OR jsonb_typeof("p_configurations") <> 'array'
    THEN
        RAISE EXCEPTION 'p_configurations must be a JSON array'
            USING ERRCODE = '22023';
    END IF;

    /*
     * 기존 구성을 제거한 뒤 전달받은 최종 폼 상태를 다시 생성합니다.
     *
     * PostgreSQL 함수 호출 전체가 하나의 트랜잭션에서 실행되므로
     * 아래 INSERT 중 하나라도 실패하면 DELETE도 함께 롤백됩니다.
     */
    DELETE FROM "public"."ai_setting_configurations"
    WHERE "setting_id" = "p_setting_id";

    FOR "configuration", "configuration_index" IN
        SELECT
            "value",
            "ordinality"::integer
        FROM jsonb_array_elements("p_configurations")
        WITH ORDINALITY
            AS "configurations"("value", "ordinality")
    LOOP
        "configuration_kind" :=
            "configuration" ->> 'kind';

        "configuration_role_key" :=
            "configuration" ->> 'roleKey';

        "model_config_id" :=
            ("configuration" ->> 'modelConfigId')::uuid;

        IF "configuration_role_key" IS NULL
           OR "configuration_role_key"
               !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        THEN
            RAISE EXCEPTION
                'Invalid AI setting configuration roleKey: %',
                "configuration_role_key"
                USING ERRCODE = '22023';
        END IF;

        CASE "configuration_kind"
            WHEN 'chat' THEN
                "prompt_version_id" :=
                    (
                        "configuration"
                        ->> 'promptVersionId'
                    )::uuid;

                IF NOT EXISTS (
                    SELECT 1
                    FROM "public"."ai_model_configs"
                    WHERE "id" = "model_config_id"
                      AND "capability" = 'chat'
                      AND "is_active" = true
                ) THEN
                    RAISE EXCEPTION
                        'Chat AI setting configuration requires an active chat model: %',
                        "model_config_id"
                        USING ERRCODE = '23514';
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM "public"."ai_prompt_versions"
                    WHERE "id" = "prompt_version_id"
                      AND "lifecycle_status" = 'published'
                ) THEN
                    RAISE EXCEPTION
                        'Chat AI setting configuration requires a published prompt version: %',
                        "prompt_version_id"
                        USING ERRCODE = '23514';
                END IF;

                INSERT INTO "public"."ai_setting_configurations" (
                    "setting_id",
                    "role_key",
                    "kind",
                    "sort_order",
                    "model_config_id",
                    "prompt_version_id",
                    "temperature"
                )
                VALUES (
                    "p_setting_id",
                    "configuration_role_key",
                    'chat',
                    "configuration_index" - 1,
                    "model_config_id",
                    "prompt_version_id",
                    (
                        "configuration"
                        ->> 'temperature'
                    )::numeric
                );

            WHEN 'embedding' THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "public"."ai_model_configs"
                    WHERE "id" = "model_config_id"
                      AND "capability" = 'embedding'
                      AND "is_active" = true
                ) THEN
                    RAISE EXCEPTION
                        'Embedding AI setting configuration requires an active embedding model: %',
                        "model_config_id"
                        USING ERRCODE = '23514';
                END IF;

                INSERT INTO "public"."ai_setting_configurations" (
                    "setting_id",
                    "role_key",
                    "kind",
                    "sort_order",
                    "model_config_id",
                    "prompt_version_id",
                    "temperature"
                )
                VALUES (
                    "p_setting_id",
                    "configuration_role_key",
                    'embedding',
                    "configuration_index" - 1,
                    "model_config_id",
                    NULL,
                    NULL
                );

            ELSE
                RAISE EXCEPTION
                    'Unsupported AI setting configuration kind: %',
                    "configuration_kind"
                    USING ERRCODE = '22023';
        END CASE;
    END LOOP;
END;
$$;


-- ============================================================================
-- Admin AI Setting List RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_admin_ai_setting_list"(
    "p_page" integer DEFAULT 1,
    "p_page_size" integer DEFAULT 20,
    "p_search_field" text DEFAULT 'all',
    "p_search_query" text DEFAULT '',
    "p_chat_model_id_filters" uuid[] DEFAULT NULL,
    "p_chat_count_min" integer DEFAULT NULL,
    "p_chat_count_max" integer DEFAULT NULL,
    "p_embedding_model_id_filters" uuid[] DEFAULT NULL,
    "p_embedding_count_min" integer DEFAULT NULL,
    "p_embedding_count_max" integer DEFAULT NULL,
    "p_created_from" timestamptz DEFAULT NULL,
    "p_created_to" timestamptz DEFAULT NULL,
    "p_updated_from" timestamptz DEFAULT NULL,
    "p_updated_to" timestamptz DEFAULT NULL,
    "p_sort_field" text DEFAULT 'updatedAt',
    "p_sort_direction" text DEFAULT 'desc'
)
RETURNS TABLE (
    "items" jsonb,
    "total_count" bigint
)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
    "v_page" integer :=
        GREATEST(
            COALESCE("p_page", 1),
            1
        );

    "v_page_size" integer :=
        GREATEST(
            COALESCE("p_page_size", 20),
            1
        );

    "v_offset" integer;
BEGIN
    IF "p_search_field" NOT IN (
        'all',
        'displayName',
        'key',
        'agent'
    ) THEN
        RAISE EXCEPTION
            'Invalid search field: %',
            "p_search_field";
    END IF;

    IF "p_sort_field" NOT IN (
        'displayName',
        'key',
        'createdAt',
        'updatedAt'
    ) THEN
        RAISE EXCEPTION
            'Invalid sort field: %',
            "p_sort_field";
    END IF;

    IF "p_sort_direction" NOT IN (
        'asc',
        'desc'
    ) THEN
        RAISE EXCEPTION
            'Invalid sort direction: %',
            "p_sort_direction";
    END IF;

    "v_offset" :=
        ("v_page" - 1)
        * "v_page_size";

    RETURN QUERY
    WITH "setting_data" AS (
        SELECT
            "s"."id",
            "s"."display_name",
            "s"."key",
            "s"."created_at",
            "s"."updated_at",

            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            "agent_data"."id",
                            'displayName',
                            "agent_data"."display_name"
                        )
                        ORDER BY
                            "agent_data"."display_name"
                    )
                    FROM (
                        SELECT DISTINCT
                            "agent"."id",
                            "agent"."display_name"
                        FROM "public"."ai_setting_configurations"
                            AS "configuration"
                        JOIN "public"."ai_prompt_versions"
                            AS "version"
                            ON "version"."id"
                                = "configuration"."prompt_version_id"
                        JOIN "public"."ai_prompt_families"
                            AS "family"
                            ON "family"."id"
                                = "version"."family_id"
                        JOIN "public"."ai_prompt_agents"
                            AS "agent"
                            ON "agent"."id"
                                = "family"."agent_id"
                        WHERE "configuration"."setting_id"
                                = "s"."id"
                          AND "configuration"."kind"
                                = 'chat'
                    ) AS "agent_data"
                ),
                '[]'::jsonb
            ) AS "agents",

            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            "model_data"."id",
                            'displayName',
                            "model_data"."display_name"
                        )
                        ORDER BY
                            "model_data"."display_name"
                    )
                    FROM (
                        SELECT DISTINCT
                            "model"."id",
                            "model"."display_name"
                        FROM "public"."ai_setting_configurations"
                            AS "configuration"
                        JOIN "public"."ai_model_configs"
                            AS "model"
                            ON "model"."id"
                                = "configuration"."model_config_id"
                        WHERE "configuration"."setting_id"
                                = "s"."id"
                          AND "configuration"."kind"
                                = 'chat'
                    ) AS "model_data"
                ),
                '[]'::jsonb
            ) AS "chat_models",

            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            "model_data"."id",
                            'displayName',
                            "model_data"."display_name"
                        )
                        ORDER BY
                            "model_data"."display_name"
                    )
                    FROM (
                        SELECT DISTINCT
                            "model"."id",
                            "model"."display_name"
                        FROM "public"."ai_setting_configurations"
                            AS "configuration"
                        JOIN "public"."ai_model_configs"
                            AS "model"
                            ON "model"."id"
                                = "configuration"."model_config_id"
                        WHERE "configuration"."setting_id"
                                = "s"."id"
                          AND "configuration"."kind"
                                = 'embedding'
                    ) AS "model_data"
                ),
                '[]'::jsonb
            ) AS "embedding_models",

            (
                SELECT COUNT(*)::integer
                FROM "public"."ai_setting_configurations"
                    AS "configuration"
                WHERE "configuration"."setting_id"
                        = "s"."id"
                  AND "configuration"."kind"
                        = 'chat'
            ) AS "chat_configuration_count",

            (
                SELECT COUNT(*)::integer
                FROM "public"."ai_setting_configurations"
                    AS "configuration"
                WHERE "configuration"."setting_id"
                        = "s"."id"
                  AND "configuration"."kind"
                        = 'embedding'
            ) AS "embedding_configuration_count"

        FROM "public"."ai_settings" AS "s"
    ),

    "filtered" AS (
        SELECT *
        FROM "setting_data" AS "setting"
        WHERE (
            COALESCE(
                "p_search_query",
                ''
            ) = ''

            OR (
                "p_search_field" IN (
                    'all',
                    'displayName'
                )
                AND "setting"."display_name"
                    ILIKE '%'
                        || "p_search_query"
                        || '%'
            )

            OR (
                "p_search_field" IN (
                    'all',
                    'key'
                )
                AND "setting"."key"
                    ILIKE '%'
                        || "p_search_query"
                        || '%'
            )

            OR (
                "p_search_field" IN (
                    'all',
                    'agent'
                )
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                        "setting"."agents"
                    ) AS "agent"
                    WHERE "agent"
                        ->> 'displayName'
                        ILIKE '%'
                            || "p_search_query"
                            || '%'
                )
            )
        )

        AND (
            "p_chat_model_id_filters" IS NULL
            OR cardinality(
                "p_chat_model_id_filters"
            ) = 0
            OR EXISTS (
                SELECT 1
                FROM "public"."ai_setting_configurations"
                    AS "configuration"
                WHERE "configuration"."setting_id"
                        = "setting"."id"
                  AND "configuration"."kind"
                        = 'chat'
                  AND "configuration"."model_config_id"
                        = ANY(
                            "p_chat_model_id_filters"
                        )
            )
        )

        AND (
            "p_embedding_model_id_filters" IS NULL
            OR cardinality(
                "p_embedding_model_id_filters"
            ) = 0
            OR EXISTS (
                SELECT 1
                FROM "public"."ai_setting_configurations"
                    AS "configuration"
                WHERE "configuration"."setting_id"
                        = "setting"."id"
                  AND "configuration"."kind"
                        = 'embedding'
                  AND "configuration"."model_config_id"
                        = ANY(
                            "p_embedding_model_id_filters"
                        )
            )
        )

        AND (
            "p_chat_count_min" IS NULL
            OR "setting"."chat_configuration_count"
                >= "p_chat_count_min"
        )

        AND (
            "p_chat_count_max" IS NULL
            OR "setting"."chat_configuration_count"
                <= "p_chat_count_max"
        )

        AND (
            "p_embedding_count_min" IS NULL
            OR "setting"."embedding_configuration_count"
                >= "p_embedding_count_min"
        )

        AND (
            "p_embedding_count_max" IS NULL
            OR "setting"."embedding_configuration_count"
                <= "p_embedding_count_max"
        )

        AND (
            "p_created_from" IS NULL
            OR "setting"."created_at"
                >= "p_created_from"
        )

        AND (
            "p_created_to" IS NULL
            OR "setting"."created_at"
                <= "p_created_to"
        )

        AND (
            "p_updated_from" IS NULL
            OR "setting"."updated_at"
                >= "p_updated_from"
        )

        AND (
            "p_updated_to" IS NULL
            OR "setting"."updated_at"
                <= "p_updated_to"
        )
    ),

    "paged" AS (
        SELECT *
        FROM "filtered"
        ORDER BY
            CASE
                WHEN "p_sort_field" = 'displayName'
                 AND "p_sort_direction" = 'asc'
                THEN "display_name"
            END ASC,

            CASE
                WHEN "p_sort_field" = 'displayName'
                 AND "p_sort_direction" = 'desc'
                THEN "display_name"
            END DESC,

            CASE
                WHEN "p_sort_field" = 'key'
                 AND "p_sort_direction" = 'asc'
                THEN "key"
            END ASC,

            CASE
                WHEN "p_sort_field" = 'key'
                 AND "p_sort_direction" = 'desc'
                THEN "key"
            END DESC,

            CASE
                WHEN "p_sort_field" = 'createdAt'
                 AND "p_sort_direction" = 'asc'
                THEN "created_at"
            END ASC,

            CASE
                WHEN "p_sort_field" = 'createdAt'
                 AND "p_sort_direction" = 'desc'
                THEN "created_at"
            END DESC,

            CASE
                WHEN "p_sort_field" = 'updatedAt'
                 AND "p_sort_direction" = 'asc'
                THEN "updated_at"
            END ASC,

            CASE
                WHEN "p_sort_field" = 'updatedAt'
                 AND "p_sort_direction" = 'desc'
                THEN "updated_at"
            END DESC,

            "id" ASC

        LIMIT "v_page_size"
        OFFSET "v_offset"
    )

    SELECT
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id',
                        "row"."id",
                        'displayName',
                        "row"."display_name",
                        'key',
                        "row"."key",
                        'agents',
                        "row"."agents",
                        'chatModels',
                        "row"."chat_models",
                        'embeddingModels',
                        "row"."embedding_models",
                        'chatConfigurationCount',
                        "row"."chat_configuration_count",
                        'embeddingConfigurationCount',
                        "row"."embedding_configuration_count",
                        'createdAt',
                        "row"."created_at",
                        'updatedAt',
                        "row"."updated_at"
                    )
                )
                FROM "paged" AS "row"
            ),
            '[]'::jsonb
        ),
        (
            SELECT COUNT(*)
            FROM "filtered"
        );
END;
$$;


-- ============================================================================
-- Settings Reference Delete Protection
-- ============================================================================

/**
 * 관리자 Prompt Family 삭제를 원자적으로 처리합니다.
 * 하위 Version이 AI Setting에서 참조 중이면 삭제하지 않습니다.
 * 그 외에는 하위 Version의 lifecycle과 관계없이 Version을 모두 삭제한 뒤 Family를 삭제합니다.
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

    -- 하위 Prompt Version이 AI Setting에서 사용 중이면 참조 무결성을 위해 삭제하지 않습니다.
    IF EXISTS (
        SELECT 1
        FROM "public"."ai_setting_configurations" AS "configurations"
        JOIN "public"."ai_prompt_versions" AS "versions"
            ON "versions"."id" = "configurations"."prompt_version_id"
        WHERE "versions"."family_id" = "p_family_id"
    ) THEN
        RETURN 'NOT_DELETABLE';
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
 * 하위 Version이 AI Setting에서 참조 중이면 삭제하지 않습니다.
 * 그 외에는 하위 Version과 Family를 모두 삭제한 뒤 Agent를 삭제합니다.
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

    -- 하위 Prompt Version이 AI Setting에서 사용 중이면 참조 무결성을 위해 삭제하지 않습니다.
    IF EXISTS (
        SELECT 1
        FROM "public"."ai_setting_configurations" AS "configurations"
        JOIN "public"."ai_prompt_versions" AS "versions"
            ON "versions"."id" = "configurations"."prompt_version_id"
        JOIN "public"."ai_prompt_families" AS "families"
            ON "families"."id" = "versions"."family_id"
        WHERE "families"."agent_id" = "p_agent_id"
    ) THEN
        RETURN 'NOT_DELETABLE';
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

ALTER TABLE "public"."ai_settings"
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_setting_configurations"
    ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Table Permissions
-- ============================================================================

REVOKE ALL
ON TABLE "public"."ai_settings"
FROM "anon", "authenticated";

REVOKE ALL
ON TABLE "public"."ai_setting_configurations"
FROM "anon", "authenticated";

GRANT ALL
ON TABLE "public"."ai_settings"
TO "service_role";

GRANT ALL
ON TABLE "public"."ai_setting_configurations"
TO "service_role";


-- ============================================================================
-- Function Permissions
-- ============================================================================

REVOKE ALL
ON FUNCTION "public"."save_ai_setting_configurations"(
    "uuid",
    "jsonb"
)
FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE
ON FUNCTION "public"."save_ai_setting_configurations"(
    "uuid",
    "jsonb"
)
TO "service_role";


REVOKE ALL
ON FUNCTION "public"."get_admin_ai_setting_list"(
    integer,
    integer,
    text,
    text,
    uuid[],
    integer,
    integer,
    uuid[],
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz,
    timestamptz,
    text,
    text
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."get_admin_ai_setting_list"(
    integer,
    integer,
    text,
    text,
    uuid[],
    integer,
    integer,
    uuid[],
    integer,
    integer,
    timestamptz,
    timestamptz,
    timestamptz,
    timestamptz,
    text,
    text
)
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
