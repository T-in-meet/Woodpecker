BEGIN;

-- ============================================================================
-- ai_embeddings: 청킹 + 세대(generation) 기반 교체 지원
-- ============================================================================

-- 하나의 source가 여러 청크 embedding을 가질 수 있도록 원문 내 청크 순서를 저장합니다.
-- 기존 비청킹 embedding은 단일 청크로 취급하여 0을 기본값으로 사용합니다.
ALTER TABLE "public"."ai_embeddings"
    ADD COLUMN "chunk_index" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."ai_embeddings"
    ADD CONSTRAINT "ai_embeddings_chunk_index_check"
        CHECK ("chunk_index" >= 0);

-- 같은 generation이 총 몇 개의 청크로 구성되어야 하는지 저장합니다.
-- activation 시 실제 저장된 청크 개수와 비교하여 불완전한 generation이
-- 검색 대상으로 전환되지 않도록 검증하는 데 사용합니다.
ALTER TABLE "public"."ai_embeddings"
    ADD COLUMN "chunk_count" integer NOT NULL DEFAULT 1;

ALTER TABLE "public"."ai_embeddings"
    ADD CONSTRAINT "ai_embeddings_chunk_count_check"
        CHECK (
            "chunk_count" >= 1
            AND "chunk_index" < "chunk_count"
        );

-- 한 번의 source 재인덱싱에서 생성된 청크 집합을 같은 generation으로 묶습니다.
-- 새 generation은 기존 활성 generation과 동시에 존재할 수 있으며,
-- 모든 청크가 준비된 뒤 activate_ai_embedding_generation RPC로 활성화합니다.
ALTER TABLE "public"."ai_embeddings"
    ADD COLUMN "generation_id" "uuid" NOT NULL DEFAULT "gen_random_uuid"();


-- ============================================================================
-- ai_embeddings Unique 제약 재설정
-- ============================================================================

-- 기존 content_hash 기반 제약은 source당 단일 embedding을 전제로 합니다.
-- 청킹 이후에는 같은 source의 여러 generation과 여러 chunk_index가 공존해야 하므로
-- 동일 generation 안에서 chunk_index가 중복되지 않도록 제약을 변경합니다.
ALTER TABLE "public"."ai_embeddings"
    DROP CONSTRAINT "ai_embeddings_owner_source_model_kind_hash_key";

ALTER TABLE "public"."ai_embeddings"
    ADD CONSTRAINT "ai_embeddings_owner_source_model_kind_gen_chunk_key"
        UNIQUE (
            "owner_user_id",
            "source_type",
            "source_id",
            "model_config_id",
            "input_kind",
            "generation_id",
            "chunk_index"
        );


-- ============================================================================
-- ai_embedding_active_generations
-- ============================================================================

-- source/input_kind별 현재 검색에 사용해야 하는 embedding 세트를 하나만 가리킵니다.
-- model_config_id를 PK에 포함하지 않고 값으로 보관하여 모델이 변경되어도
-- 같은 source/input_kind에 활성 세트가 둘 이상 존재하지 않도록 합니다.
CREATE TABLE "public"."ai_embedding_active_generations" (
    "owner_user_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "input_kind" "text" NOT NULL,
    "active_model_config_id" "uuid" NOT NULL,
    "active_generation_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone NOT NULL DEFAULT "now"(),

    CONSTRAINT "ai_embedding_active_generations_pkey"
        PRIMARY KEY (
            "owner_user_id",
            "source_type",
            "source_id",
            "input_kind"
        ),

    CONSTRAINT "ai_embedding_active_generations_source_type_check"
        CHECK (length(trim("source_type")) > 0),

    CONSTRAINT "ai_embedding_active_generations_input_kind_check"
        CHECK (length(trim("input_kind")) > 0)
);

-- 활성 포인터가 참조하는 모델 자체는 반드시 존재해야 합니다.
ALTER TABLE "public"."ai_embedding_active_generations"
    ADD CONSTRAINT "ai_embedding_active_generations_model_config_id_fkey"
    FOREIGN KEY ("active_model_config_id")
    REFERENCES "public"."ai_model_configs"("id")
    ON DELETE RESTRICT;

ALTER TABLE "public"."ai_embedding_active_generations"
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE "public"."ai_embedding_active_generations"
FROM "anon", "authenticated";

GRANT ALL
ON TABLE "public"."ai_embedding_active_generations"
TO "service_role";

-- source 삭제 시 활성 세대 포인터를 빠르게 정리할 수 있도록 지원합니다.
CREATE INDEX "ai_embedding_active_generations_source_idx"
    ON "public"."ai_embedding_active_generations" (
        "source_type",
        "source_id"
    );

-- 활성 generation과 실제 embedding 청크의 조인을 지원합니다.
CREATE INDEX "ai_embedding_active_generations_model_generation_idx"
    ON "public"."ai_embedding_active_generations" (
        "active_model_config_id",
        "active_generation_id"
    );


-- ============================================================================
-- 기존 ai_embeddings 데이터의 활성 세대 백필
-- ============================================================================

-- 기존 행은 generation_id 기본값에 의해 각각 단일 청크 generation이 됩니다.
-- source/input_kind별 가장 최근 embedding 하나를 현재 활성 세트로 등록하여
-- 마이그레이션 직후 기존의 "최신 embedding 사용" 동작을 이어갑니다.
INSERT INTO "public"."ai_embedding_active_generations" (
    "owner_user_id",
    "source_type",
    "source_id",
    "input_kind",
    "active_model_config_id",
    "active_generation_id"
)
SELECT DISTINCT ON (
    "embeddings"."owner_user_id",
    "embeddings"."source_type",
    "embeddings"."source_id",
    "embeddings"."input_kind"
)
    "embeddings"."owner_user_id",
    "embeddings"."source_type",
    "embeddings"."source_id",
    "embeddings"."input_kind",
    "embeddings"."model_config_id",
    "embeddings"."generation_id"
FROM "public"."ai_embeddings" AS "embeddings"
ORDER BY
    "embeddings"."owner_user_id",
    "embeddings"."source_type",
    "embeddings"."source_id",
    "embeddings"."input_kind",
    "embeddings"."created_at" DESC,
    "embeddings"."id" DESC
ON CONFLICT (
    "owner_user_id",
    "source_type",
    "source_id",
    "input_kind"
) DO NOTHING;


-- ============================================================================
-- activate_ai_embedding_generation
-- ============================================================================

/*
 * 완전히 생성된 새 generation을 source/input_kind의 활성 embedding 세트로 전환합니다.
 *
 * 정책:
 *   1) 같은 source/input_kind의 activation을 advisory transaction lock으로 직렬화합니다.
 *   2) Note source는 작업 시작 시점의 updated_at이 현재 Note와 같은지 확인합니다.
 *   3) 대상 generation의 모든 row가 동일한 chunk_count를 가지는지 확인합니다.
 *   4) 실제 row 수, chunk_index distinct 수, 0부터 chunk_count - 1까지의 연속성을 검증합니다.
 *   5) 검증을 모두 통과한 경우에만 활성 model/generation 포인터를 전환합니다.
 *   6) 전환 성공 후 직전 활성 generation의 embedding만 삭제합니다.
 *
 * 새 generation이 불완전하거나 검증에 실패하면 예외가 발생하며,
 * 같은 트랜잭션의 활성 포인터 변경과 기존 generation 삭제는 수행되지 않습니다.
 *
 * 진행 중인 다른 비활성 generation은 삭제하지 않습니다.
 */
CREATE OR REPLACE FUNCTION "public"."activate_ai_embedding_generation"(
    "p_owner_user_id" "uuid",
    "p_source_type" "text",
    "p_source_id" "uuid",
    "p_model_config_id" "uuid",
    "p_input_kind" "text",
    "p_generation_id" "uuid",
    "p_source_updated_at" timestamp with time zone
)
RETURNS "void"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
    "target_row_count" bigint;
    "target_distinct_chunk_index_count" bigint;
    "target_chunk_count_min" integer;
    "target_chunk_count_max" integer;
    "target_chunk_index_min" integer;
    "target_chunk_index_max" integer;

    "previous_model_config_id" "uuid";
    "previous_generation_id" "uuid";
    "current_source_updated_at" timestamp with time zone;
BEGIN
    -- 동일 source/input_kind에 대한 generation 전환을 한 트랜잭션씩 처리합니다.
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"(
            "p_owner_user_id"::text
            || '|'
            || "p_source_type"
            || '|'
            || "p_source_id"::text
            || '|'
            || "p_input_kind",
            0
        )
    );

    -- Note가 embedding 작업 시작 이후 다시 수정되었는지 확인합니다.
    -- 현재 Note row를 잠근 상태에서 updated_at을 비교하여, 오래된 내용으로 생성된
    -- generation이 최신 Note의 active generation을 뒤늦게 덮어쓰지 못하도록 합니다.
    IF "p_source_type" = 'note' THEN
        SELECT "updated_at"
        INTO "current_source_updated_at"
        FROM "public"."notes"
        WHERE "id" = "p_source_id"
          AND "user_id" = "p_owner_user_id"
        FOR SHARE;

        IF "current_source_updated_at" IS NULL
           OR "current_source_updated_at" IS DISTINCT FROM "p_source_updated_at"
        THEN
            RAISE EXCEPTION
                'AI embedding source is stale: source=% generation=%',
                "p_source_id",
                "p_generation_id"
                USING ERRCODE = '40001';
        END IF;
    END IF;

    -- 대상 generation의 완전성을 DB에 저장된 chunk_count 기준으로 검증합니다.
    SELECT
        count(*),
        count(DISTINCT "chunk_index"),
        min("chunk_count"),
        max("chunk_count"),
        min("chunk_index"),
        max("chunk_index")
    INTO
        "target_row_count",
        "target_distinct_chunk_index_count",
        "target_chunk_count_min",
        "target_chunk_count_max",
        "target_chunk_index_min",
        "target_chunk_index_max"
    FROM "public"."ai_embeddings"
    WHERE "owner_user_id" = "p_owner_user_id"
      AND "source_type" = "p_source_type"
      AND "source_id" = "p_source_id"
      AND "model_config_id" = "p_model_config_id"
      AND "input_kind" = "p_input_kind"
      AND "generation_id" = "p_generation_id";

    IF "target_row_count" = 0 THEN
        RAISE EXCEPTION
            'AI embedding generation not found: source=% generation=%',
            "p_source_id",
            "p_generation_id"
            USING ERRCODE = '23503';
    END IF;

    IF "target_chunk_count_min" IS DISTINCT FROM "target_chunk_count_max" THEN
        RAISE EXCEPTION
            'AI embedding generation has inconsistent chunk_count: source=% generation=%',
            "p_source_id",
            "p_generation_id"
            USING ERRCODE = '23514';
    END IF;

    IF "target_row_count" <> "target_chunk_count_min"
       OR "target_distinct_chunk_index_count" <> "target_chunk_count_min"
       OR "target_chunk_index_min" <> 0
       OR "target_chunk_index_max" <> "target_chunk_count_min" - 1
    THEN
        RAISE EXCEPTION
            'AI embedding generation is incomplete: source=% generation=% rows=% expected=%',
            "p_source_id",
            "p_generation_id",
            "target_row_count",
            "target_chunk_count_min"
            USING ERRCODE = '23514';
    END IF;

    -- 직전 활성 세대를 잠근 상태로 읽어 전환 후 정확히 그 세대만 정리합니다.
    SELECT
        "active_model_config_id",
        "active_generation_id"
    INTO
        "previous_model_config_id",
        "previous_generation_id"
    FROM "public"."ai_embedding_active_generations"
    WHERE "owner_user_id" = "p_owner_user_id"
      AND "source_type" = "p_source_type"
      AND "source_id" = "p_source_id"
      AND "input_kind" = "p_input_kind"
    FOR UPDATE;

    INSERT INTO "public"."ai_embedding_active_generations" (
        "owner_user_id",
        "source_type",
        "source_id",
        "input_kind",
        "active_model_config_id",
        "active_generation_id",
        "updated_at"
    )
    VALUES (
        "p_owner_user_id",
        "p_source_type",
        "p_source_id",
        "p_input_kind",
        "p_model_config_id",
        "p_generation_id",
        "now"()
    )
    ON CONFLICT (
        "owner_user_id",
        "source_type",
        "source_id",
        "input_kind"
    )
    DO UPDATE SET
        "active_model_config_id" = EXCLUDED."active_model_config_id",
        "active_generation_id" = EXCLUDED."active_generation_id",
        "updated_at" = "now"();

    -- 전환 직전 활성 세대만 삭제합니다.
    -- 새 generation과 동일한 세대를 재활성화한 경우에는 삭제하지 않습니다.
    IF "previous_generation_id" IS NOT NULL
       AND (
           "previous_generation_id" <> "p_generation_id"
           OR "previous_model_config_id" <> "p_model_config_id"
       )
    THEN
        DELETE FROM "public"."ai_embeddings"
        WHERE "owner_user_id" = "p_owner_user_id"
          AND "source_type" = "p_source_type"
          AND "source_id" = "p_source_id"
          AND "model_config_id" = "previous_model_config_id"
          AND "input_kind" = "p_input_kind"
          AND "generation_id" = "previous_generation_id";
    END IF;
END;
$$;

COMMENT ON FUNCTION "public"."activate_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid",
    timestamp with time zone
) IS
'Validates a complete embedding chunk generation, atomically switches the active model/generation for a source/input kind, and removes only the previously active generation.';

REVOKE ALL
ON FUNCTION "public"."activate_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid",
    timestamp with time zone
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."activate_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid",
    timestamp with time zone
)
TO "service_role";

-- ============================================================================
-- 비활성 Embedding Generation 안전 정리
-- ============================================================================

/*
 * 지정한 Embedding generation이 현재 active generation이 아닌 경우에만
 * 해당 generation의 chunk row를 삭제합니다.
 *
 * 새 generation 생성 또는 activation 과정에서 오류가 발생했을 때
 * 애플리케이션이 cleanup을 수행하는 용도로 사용합니다.
 *
 * activation RPC가 DB에서는 성공했지만 네트워크/응답 오류로 호출자에게
 * 실패처럼 보이는 경우에도, 이미 active가 된 generation을 삭제해서
 * active pointer만 남는 상태가 발생하지 않도록 DB에서 삭제를 방어합니다.
 *
 * 동일 source의 generation activation과 cleanup이 동시에 실행되지 않도록
 * activate_ai_embedding_generation과 동일한 advisory transaction lock을
 * 사용해야 합니다.
 */
CREATE OR REPLACE FUNCTION "public"."delete_inactive_ai_embedding_generation"(
    "p_owner_user_id" "uuid",
    "p_source_type" "text",
    "p_source_id" "uuid",
    "p_model_config_id" "uuid",
    "p_input_kind" "text",
    "p_generation_id" "uuid"
)
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
    "deleted_count" integer;
BEGIN
    /*
     * 같은 source/input_kind의 activation과 cleanup을 직렬화합니다.
     *
     * 중요:
     * 이 advisory lock의 key 생성식은 activate_ai_embedding_generation에서
     * 사용하는 식과 반드시 동일해야 합니다.
     */
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"(
            "p_owner_user_id"::text
            || '|'
            || "p_source_type"
            || '|'
            || "p_source_id"::text
            || '|'
            || "p_input_kind",
            0
        )
    );

    /*
     * 현재 active pointer가 삭제 대상 generation을 가리키는 경우에는
     * 어떤 row도 삭제하지 않습니다.
     *
     * active generation이 아니라고 확인된 경우에만 지정된 generation의
     * chunk 전체를 삭제합니다.
     */
    DELETE FROM "public"."ai_embeddings" AS "embedding"
    WHERE "embedding"."owner_user_id" = "p_owner_user_id"
      AND "embedding"."source_type" = "p_source_type"
      AND "embedding"."source_id" = "p_source_id"
      AND "embedding"."model_config_id" = "p_model_config_id"
      AND "embedding"."input_kind" = "p_input_kind"
      AND "embedding"."generation_id" = "p_generation_id"
      AND NOT EXISTS (
          SELECT 1
          FROM "public"."ai_embedding_active_generations" AS "active"
          WHERE "active"."owner_user_id" = "p_owner_user_id"
            AND "active"."source_type" = "p_source_type"
            AND "active"."source_id" = "p_source_id"
            AND "active"."input_kind" = "p_input_kind"
            AND "active"."active_model_config_id" = "p_model_config_id"
            AND "active"."active_generation_id" = "p_generation_id"
      );

    GET DIAGNOSTICS "deleted_count" = ROW_COUNT;

    RETURN "deleted_count";
END;
$$;

COMMENT ON FUNCTION "public"."delete_inactive_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid"
) IS
'Deletes all chunks of the specified embedding generation only when that generation is not the current active generation for the source/input scope. Intended for failure cleanup without risking deletion of an activation that committed successfully.';


-- ============================================================================
-- Function Permissions
-- ============================================================================

REVOKE ALL
ON FUNCTION "public"."delete_inactive_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid"
)
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."delete_inactive_ai_embedding_generation"(
    "uuid",
    "text",
    "uuid",
    "uuid",
    "text",
    "uuid"
)
TO "service_role";



-- ============================================================================
-- match_ai_embeddings: 활성 generation의 청크 Top-K 검색
-- ============================================================================

-- 반환 컬럼이 chunk_index를 포함하도록 변경되므로 기존 함수를 제거한 뒤 재생성합니다.
DROP FUNCTION IF EXISTS "public"."match_ai_embeddings"(
    "extensions"."vector"(1536),
    "uuid",
    "text",
    "uuid",
    "text",
    integer,
    double precision
);

/*
 * 지정한 owner/source/model/input 범위에서 현재 활성 generation에 속한 청크만
 * query embedding과 비교하여 유사도가 높은 청크 Top-K를 반환합니다.
 *
 * 이 공통 RPC는 source(노트) 단위 중복 제거를 수행하지 않습니다.
 * Note Chat은 반환된 청크를 직접 Context로 사용할 수 있고,
 * Related Notes처럼 source 단위 결과가 필요한 기능은 호출 계층에서
 * source_id 기준 중복 제거/오버페치 정책을 적용합니다.
 *
 * p_exclude_source_id가 지정되면 해당 source의 모든 청크를
 * ranking 및 LIMIT 적용 전에 검색 대상에서 제외합니다.
 * NULL이면 기존 검색과 동일하게 어떤 source도 제외하지 않습니다.
 *
 * 활성 포인터의 active_model_config_id가 요청 모델과 일치하지 않으면
 * 해당 source는 검색 후보에서 제외됩니다.
 */
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
    "safe_limit" := LEAST(
        GREATEST(
            COALESCE("p_limit", 10),
            1
        ),
        100
    );

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
            (
                "embeddings"."embedding"
                <=> "p_query_embedding"
            )::double precision AS "distance",
            (
                1 - (
                    "embeddings"."embedding"
                    <=> "p_query_embedding"
                )
            )::double precision AS "similarity"
        FROM "public"."ai_embeddings" AS "embeddings"
        JOIN "public"."ai_embedding_active_generations" AS "active_generations"
          ON "active_generations"."owner_user_id" = "embeddings"."owner_user_id"
         AND "active_generations"."source_type" = "embeddings"."source_type"
         AND "active_generations"."source_id" = "embeddings"."source_id"
         AND "active_generations"."input_kind" = "embeddings"."input_kind"
         AND "active_generations"."active_model_config_id" = "embeddings"."model_config_id"
         AND "active_generations"."active_generation_id" = "embeddings"."generation_id"
        WHERE "embeddings"."owner_user_id" = "p_owner_user_id"
          AND "embeddings"."source_type" = "p_source_type"
          AND "embeddings"."model_config_id" = "p_model_config_id"
          AND "embeddings"."input_kind" = "p_input_kind"
          AND "active_generations"."active_model_config_id" = "p_model_config_id"
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
    WHERE (
        "safe_min_similarity" IS NULL
        OR "scored_chunks"."similarity" >= "safe_min_similarity"
    )
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
'Returns top matching chunks from each source''s active embedding generation. Optionally excludes one source before ranking and limit. Source-level deduplication is intentionally left to the caller.';

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


-- ============================================================================
-- notes 삭제 시 관련 embedding 세대 전체 정리
-- ============================================================================

-- ai_embeddings는 source_type/source_id를 사용하는 폴리모픽 저장소이므로
-- source_id에 notes(id) FK를 직접 연결할 수 없습니다.
-- Note 삭제 시 해당 Note의 활성/비활성 generation과 활성 포인터를 함께 정리합니다.
CREATE OR REPLACE FUNCTION "public"."delete_note_embeddings"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
BEGIN
    DELETE FROM "public"."ai_embedding_active_generations"
    WHERE "source_type" = 'note'
      AND "source_id" = OLD."id";

    DELETE FROM "public"."ai_embeddings"
    WHERE "source_type" = 'note'
      AND "source_id" = OLD."id";

    RETURN OLD;
END;
$$;

REVOKE ALL
ON FUNCTION "public"."delete_note_embeddings"()
FROM PUBLIC, "anon", "authenticated";

GRANT ALL
ON FUNCTION "public"."delete_note_embeddings"()
TO "service_role";

CREATE OR REPLACE TRIGGER "tr_notes_delete_embeddings"
    AFTER DELETE ON "public"."notes"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."delete_note_embeddings"();


COMMIT;