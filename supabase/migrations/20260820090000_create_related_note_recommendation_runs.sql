BEGIN;

/* ============================================================================
 * Related Note Recommendation Run
 * ============================================================================
 *
 * Related Notes AI 추천 후처리의 개별 실행 이력을 저장합니다.
 *
 * Note Chat Run과 달리 Related Notes에는 Conversation/Message가 없으므로
 * 추천 대상 Note와 사용자 ID를 직접 연결합니다.
 *
 * 이 테이블은 사용자 화면의 추천 관계 자체가 아니라 실행 감사 데이터입니다.
 * 실행 당시 Runtime Model, 중간 검색 결과, 최종 추천 snapshot, usage/cost,
 * 실패 메시지를 보존하여 비용 집계와 실패 조사에 사용합니다.
 */
CREATE TABLE "public"."related_note_recommendation_runs" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "note_id" "uuid" NOT NULL,
  "user_id" "uuid" NOT NULL,
  "status" "text" DEFAULT 'running'::"text" NOT NULL,
  "source_updated_at" timestamp with time zone,
  "query_expansion_model_config_id" "uuid",
  "embedding_model_config_id" "uuid",
  "answer_generation_model_config_id" "uuid",
  "expanded_query" "text",
  "matched_note_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
  "recommendations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
  "query_expansion_usage" "jsonb",
  "query_embedding_usage" "jsonb",
  "answer_generation_usage" "jsonb",
  "query_expansion_cost_usd" numeric,
  "query_embedding_cost_usd" numeric,
  "answer_generation_cost_usd" numeric,
  "total_cost_usd" numeric,
  "failure_message" "text",
  "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  /*
   * Related Notes 추천 실행 상태는 실행 중, 성공, 실패, stale만 허용합니다.
   *
   * stale은 AI 실행은 끝났지만 source Note가 다시 수정되었거나 삭제/owner 불일치로
   * 추천 저장을 적용하지 않은 정상적인 비동기 경합 결과입니다.
   */
  CONSTRAINT "related_note_recommendation_runs_status_check"
    CHECK ("status" = ANY (ARRAY[
      'running'::"text",
      'succeeded'::"text",
      'failed'::"text",
      'stale'::"text"
    ])),

  /*
   * 추천 snapshot은 실행 당시 AI가 선택한 Note와 reason을 보존하는 JSON 배열입니다.
   */
  CONSTRAINT "related_note_recommendation_runs_recommendations_array_check"
    CHECK (jsonb_typeof("recommendations") = 'array'),

  /*
   * Usage snapshot은 Provider 공통 token usage object 또는 NULL입니다.
   */
  CONSTRAINT "related_note_runs_qe_usage_object_check"
    CHECK (
      ("query_expansion_usage" IS NULL)
      OR jsonb_typeof("query_expansion_usage") = 'object'
    ),

  CONSTRAINT "related_note_runs_embedding_usage_object_check"
    CHECK (
      ("query_embedding_usage" IS NULL)
      OR jsonb_typeof("query_embedding_usage") = 'object'
    ),

  CONSTRAINT "related_note_runs_answer_usage_object_check"
    CHECK (
      ("answer_generation_usage" IS NULL)
      OR jsonb_typeof("answer_generation_usage") = 'object'
    ),

  /*
   * 완료된 실행은 완료 시각을 가져야 하며, 실행 중인 Run은 완료 시각이 없어야 합니다.
   */
  CONSTRAINT "related_note_recommendation_runs_status_timestamps_check"
    CHECK (
      (
        "status" = 'running'
        AND "completed_at" IS NULL
      )
      OR (
        "status" IN ('succeeded', 'failed', 'stale')
        AND "completed_at" IS NOT NULL
      )
    )
);


/* ============================================================================
 * Primary Key and Foreign Keys
 * ========================================================================== */

ALTER TABLE ONLY "public"."related_note_recommendation_runs"
  ADD CONSTRAINT "related_note_recommendation_runs_pkey"
  PRIMARY KEY ("id");

/*
 * 추천 대상 Note가 삭제되면 해당 Note의 실행 이력도 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."related_note_recommendation_runs"
  ADD CONSTRAINT "related_note_recommendation_runs_note_id_fkey"
  FOREIGN KEY ("note_id")
  REFERENCES "public"."notes"("id")
  ON DELETE CASCADE;

/*
 * 사용자 계정 삭제 시 해당 사용자의 Related Notes 실행 이력도 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."related_note_recommendation_runs"
  ADD CONSTRAINT "related_note_recommendation_runs_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id")
  ON DELETE CASCADE;


/* ============================================================================
 * Indexes
 * ========================================================================== */

/*
 * 사용자의 특정 Note에 대한 최근 추천 실행 이력 조회에 사용합니다.
 */
CREATE INDEX "related_note_recommendation_runs_user_note_started_at_idx"
  ON "public"."related_note_recommendation_runs" (
    "user_id",
    "note_id",
    "started_at" DESC
  );

/*
 * 운영자가 실행 중이거나 실패한 Related Notes 추천 Run을 최근 순으로 점검할 때 사용합니다.
 */
CREATE INDEX "related_note_recommendation_runs_status_started_at_idx"
  ON "public"."related_note_recommendation_runs" (
    "status",
    "started_at" DESC
  );


/* ============================================================================
 * Claim RPC
 * ========================================================================== */

/*
 * Related Notes 추천 Run을 생성하기 전에 사용자 quota와 동일 Note version
 * 중복 실행 여부를 하나의 DB transaction 안에서 검증합니다.
 *
 * 일반 사용자는 KST 기준 일일 추천 실행 횟수를 제한합니다. 관리자는 운영 및
 * AI 기능 검증을 위해 이 제한을 건너뛰며, service_role 호출에서도 관리자
 * 여부는 profiles.role을 기준으로 RPC 내부에서 직접 확인합니다.
 *
 * 같은 user_id, note_id, source_updated_at에 대해 running 또는 succeeded Run이
 * 이미 있으면 새 Run을 만들지 않고 duplicate 상태를 반환하여 Provider 호출을
 * 시작하기 전에 중복 비용 발생을 방지합니다.
 */
CREATE OR REPLACE FUNCTION "public"."claim_related_note_recommendation_run"(
  "p_user_id" "uuid",
  "p_note_id" "uuid",
  "p_source_updated_at" timestamp with time zone,
  "p_query_expansion_model_config_id" "uuid",
  "p_embedding_model_config_id" "uuid",
  "p_answer_generation_model_config_id" "uuid",
  "p_daily_recommendation_limit" integer
)
RETURNS TABLE ("status" "text", "run_id" "uuid")
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_existing_run_id" "uuid";
  "v_is_admin" boolean;
  "v_now" timestamp with time zone := clock_timestamp();
  "v_kst_date" date;
  "v_daily_start_at" timestamp with time zone;
  "v_daily_end_at" timestamp with time zone;
  "v_daily_count" integer;
  "v_run_id" "uuid";
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF "p_note_id" IS NULL THEN
    RAISE EXCEPTION 'note_id is required';
  END IF;

  IF "p_source_updated_at" IS NULL THEN
    RAISE EXCEPTION 'source_updated_at is required';
  END IF;

  IF "p_daily_recommendation_limit" IS NULL
     OR "p_daily_recommendation_limit" < 1 THEN
    RAISE EXCEPTION 'daily recommendation limit must be positive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "auth"."users" AS "users"
    WHERE "users"."id" = "p_user_id"
      AND "users"."email_confirmed_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  PERFORM 1
  FROM "public"."notes" AS "notes"
  WHERE "notes"."id" = "p_note_id"
    AND "notes"."user_id" = "p_user_id"
    AND "notes"."updated_at" IS NOT DISTINCT FROM "p_source_updated_at";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recommendation source not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "public"."profiles" AS "profiles"
    WHERE "profiles"."id" = "p_user_id"
      AND "profiles"."role" = 'ADMIN'
  )
  INTO "v_is_admin";

  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;

  /*
   * 동일 사용자의 같은 KST 날짜 claim을 직렬화하여 quota count와 Run INSERT
   * 사이의 경쟁 조건을 막습니다. 관리자는 quota를 건너뛰지만 같은 key 규칙을
   * 사용해 일반 사용자에서 관리자로 role이 바뀌는 경계도 단순하게 유지합니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|related-notes|'
      || "v_kst_date"::text,
      0
    )
  );

  /*
   * 동일 Note version claim을 직렬화하여 같은 source_updated_at에 대한
   * running/succeeded Run 중복 생성을 방지합니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|related-notes|'
      || "p_note_id"::text
      || '|'
      || "p_source_updated_at"::text,
      0
    )
  );

  SELECT "runs"."id"
  INTO "v_existing_run_id"
  FROM "public"."related_note_recommendation_runs" AS "runs"
  WHERE "runs"."user_id" = "p_user_id"
    AND "runs"."note_id" = "p_note_id"
    AND "runs"."source_updated_at" IS NOT DISTINCT FROM "p_source_updated_at"
    AND "runs"."status" IN ('running', 'succeeded')
  ORDER BY "runs"."started_at" DESC
  LIMIT 1;

  IF "v_existing_run_id" IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicate'::"text", "v_existing_run_id";
    RETURN;
  END IF;

  IF NOT "v_is_admin" THEN
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    SELECT count(*)
    INTO "v_daily_count"
    FROM "public"."related_note_recommendation_runs" AS "runs"
    WHERE "runs"."user_id" = "p_user_id"
      AND "runs"."started_at" >= "v_daily_start_at"
      AND "runs"."started_at" < "v_daily_end_at";

    IF "v_daily_count" >= "p_daily_recommendation_limit" THEN
      RAISE EXCEPTION 'RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_EXCEEDED'
        USING ERRCODE = 'WP003';
    END IF;
  END IF;

  INSERT INTO "public"."related_note_recommendation_runs" (
    "note_id",
    "user_id",
    "status",
    "source_updated_at",
    "query_expansion_model_config_id",
    "embedding_model_config_id",
    "answer_generation_model_config_id",
    "started_at",
    "created_at",
    "updated_at"
  )
  VALUES (
    "p_note_id",
    "p_user_id",
    'running',
    "p_source_updated_at",
    "p_query_expansion_model_config_id",
    "p_embedding_model_config_id",
    "p_answer_generation_model_config_id",
    "v_now",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_run_id";

  RETURN QUERY SELECT 'claimed'::"text", "v_run_id";
END;
$$;


/* ============================================================================
 * Triggers
 * ========================================================================== */

/*
 * Run snapshot 또는 상태가 변경될 때 updated_at을 자동 갱신합니다.
 */
CREATE OR REPLACE TRIGGER "tr_related_note_recommendation_runs_updated_at"
  BEFORE UPDATE ON "public"."related_note_recommendation_runs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();


/* ============================================================================
 * Row Level Security
 * ========================================================================== */

ALTER TABLE "public"."related_note_recommendation_runs"
  ENABLE ROW LEVEL SECURITY;

/*
 * 사용자는 자신의 Related Notes 추천 Run만 조회할 수 있습니다.
 *
 * Run 생성/수정/완료는 Note 저장 응답 이후 서버의 service_role 실행 경로에서만
 * 처리하므로 authenticated 사용자에게 쓰기 정책은 제공하지 않습니다.
 */
CREATE POLICY "related_note_recommendation_runs_select_own"
  ON "public"."related_note_recommendation_runs"
  FOR SELECT
  TO "authenticated"
  USING (
    "auth"."uid"() = "user_id"
  );


/* ============================================================================
 * Table Privileges
 * ========================================================================== */

/*
 * 기본 권한을 제거한 뒤 사용자 조회와 서버 실행 권한만 명시적으로 부여합니다.
 */
REVOKE ALL
  ON TABLE "public"."related_note_recommendation_runs"
  FROM "anon", "authenticated";

GRANT SELECT
  ON TABLE "public"."related_note_recommendation_runs"
  TO "authenticated";

GRANT ALL
  ON TABLE "public"."related_note_recommendation_runs"
  TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  integer
) FROM PUBLIC, "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  integer
) TO "service_role";


/* ============================================================================
 * Database Documentation
 * ========================================================================== */

COMMENT ON TABLE "public"."related_note_recommendation_runs" IS
  'Related Notes AI 추천 후처리의 개별 실행 이력, usage/cost 및 추천 snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."note_id" IS
  '추천을 생성한 source Note ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."user_id" IS
  '추천 실행 대상 Note의 소유 사용자 ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."status" IS
  'Related Notes 추천 실행 상태: running, succeeded, failed, stale';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."source_updated_at" IS
  '추천 생성에 사용한 source Note snapshot의 updated_at';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."query_expansion_model_config_id" IS
  'Query Expansion 호출에 사용한 Chat Model Config ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."embedding_model_config_id" IS
  'Query embedding 및 Note retrieval 검색에 사용한 Embedding Model Config ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."answer_generation_model_config_id" IS
  'Related Notes Answer Generation 호출에 사용한 Chat Model Config ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."expanded_query" IS
  'Query Expansion으로 생성한 Related Notes 검색 질의';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."matched_note_ids" IS
  'RAG 검색에서 match된 Note ID snapshot. chunk 중복이 있을 수 있습니다.';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."recommendations" IS
  'Answer Generation 이후 실행 당시 AI 추천 결과와 reason을 보존하는 JSON 배열 snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."query_expansion_usage" IS
  'Query Expansion Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."query_embedding_usage" IS
  'Related Notes 검색 질의 embedding Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."answer_generation_usage" IS
  'Answer Generation Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."total_cost_usd" IS
  '계산 가능한 단계별 estimated cost를 합산한 총 USD 비용';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."failure_message" IS
  'failed 상태로 완료된 실행의 실패 메시지';

COMMENT ON INDEX "public"."related_note_recommendation_runs_user_note_started_at_idx" IS
  '사용자별 특정 Note의 Related Notes 추천 실행 이력을 최근 순으로 조회하기 위한 인덱스';

COMMENT ON INDEX "public"."related_note_recommendation_runs_status_started_at_idx" IS
  '상태별 Related Notes 추천 실행을 최근 순으로 운영 점검하기 위한 인덱스';

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  integer
) IS
  'Related Notes AI 추천 Run을 quota, 관리자 bypass, 동일 Note version 중복 방지와 함께 claim합니다.';

COMMENT ON POLICY "related_note_recommendation_runs_select_own"
  ON "public"."related_note_recommendation_runs" IS
  '사용자가 자신의 Related Notes 추천 실행 이력만 조회하도록 제한합니다.';


COMMIT;
