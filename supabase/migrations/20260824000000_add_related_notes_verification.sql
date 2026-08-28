BEGIN;

/* ============================================================================
 * Related Notes Verification Run Tracking
 * ========================================================================== */

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD COLUMN "verification_model_config_id" "uuid";

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD COLUMN "verification_usage" "jsonb";

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD COLUMN "verification_cost_usd" numeric;

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD COLUMN "verification_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL;

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD CONSTRAINT "related_note_runs_verification_usage_object_check"
    CHECK (
      ("verification_usage" IS NULL)
      OR jsonb_typeof("verification_usage") = 'object'
    );

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD CONSTRAINT "related_note_runs_verification_results_array_check"
    CHECK (jsonb_typeof("verification_results") = 'array');

ALTER TABLE "public"."related_note_recommendation_runs"
  DROP COLUMN "total_cost_usd";

ALTER TABLE "public"."related_note_recommendation_runs"
  ADD COLUMN "total_cost_usd" numeric GENERATED ALWAYS AS (
    COALESCE("query_expansion_cost_usd", 0)
    + COALESCE("query_embedding_cost_usd", 0)
    + COALESCE("answer_generation_cost_usd", 0)
    + COALESCE("verification_cost_usd", 0)
  ) STORED;

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."verification_model_config_id" IS
  'Related Notes Recommendation Verification 호출에 사용한 Chat Model Config ID';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."verification_usage" IS
  'Recommendation Verification Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."verification_results" IS
  'Answer 추천별 Recommendation Verification 승인/거부 결과 snapshot';

COMMENT ON COLUMN "public"."related_note_recommendation_runs"."total_cost_usd" IS
  '계산 가능한 단계별 estimated cost를 합산한 총 USD 비용';


/* ============================================================================
 * Claim RPC signature with Verification model snapshot
 * ========================================================================== */

DROP FUNCTION IF EXISTS "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  integer
);

CREATE OR REPLACE FUNCTION "public"."claim_related_note_recommendation_run"(
  "p_user_id" "uuid",
  "p_note_id" "uuid",
  "p_source_updated_at" timestamp with time zone,
  "p_query_expansion_model_config_id" "uuid",
  "p_embedding_model_config_id" "uuid",
  "p_answer_generation_model_config_id" "uuid",
  "p_verification_model_config_id" "uuid",
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
    RAISE EXCEPTION 'recommendation source not found'
      USING ERRCODE = 'WP010';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "public"."profiles" AS "profiles"
    WHERE "profiles"."id" = "p_user_id"
      AND "profiles"."role" = 'ADMIN'
  )
  INTO "v_is_admin";

  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;

  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|related-notes|'
      || "v_kst_date"::text,
      0
    )
  );

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
      AND "runs"."started_at" < "v_daily_end_at"
      AND "runs"."status" IN ('running', 'succeeded');

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
    "verification_model_config_id",
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
    "p_verification_model_config_id",
    "v_now",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_run_id";

  RETURN QUERY SELECT 'claimed'::"text", "v_run_id";
END;
$$;

REVOKE ALL ON FUNCTION "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
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
  "uuid",
  integer
) TO "service_role";

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  "uuid",
  integer
) IS
  'Related Notes AI 추천 Run을 quota, 관리자 bypass, 동일 Note version 중복 방지와 Verification model snapshot과 함께 claim합니다.';


/* ============================================================================
 * Related Notes Verification Prompt Configuration
 * ========================================================================== */

INSERT INTO "public"."ai_prompt_agents" (
  "id",
  "display_name",
  "description",
  "purpose",
  "tags"
) VALUES (
  '3be86ea9-337b-4d45-bd0d-c2d88f528e75',
  'Related Notes Verifier',
  'Related Notes Answer Agent가 생성한 추천을 저장 전에 검증하는 에이전트입니다.',
  '관련 노트 추천의 직접적인 학습 관계 여부를 검증합니다.',
  '{note,relation,verification}'
)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."ai_prompt_families" (
  "id",
  "agent_id",
  "display_name",
  "description",
  "tags"
) VALUES (
  '5b5a047f-d01c-4f0b-8afa-0b0ff16882f0',
  '3be86ea9-337b-4d45-bd0d-c2d88f528e75',
  '관련 노트 추천 검증 프롬프트',
  'Answer Agent가 선택한 Related Notes 추천을 검증하는 프롬프트 패밀리',
  '{note,relation,verification}'
)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."ai_prompt_versions" (
  "id",
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
) VALUES (
  'ce12f262-2926-4be4-934c-853bb78d6fc9',
  '5b5a047f-d01c-4f0b-8afa-0b0ff16882f0',
  1,
  '관련 노트 추천 검증',
  'Answer Agent가 생성한 Related Notes 추천을 저장 전에 보수적으로 승인/거부합니다.',
  'published',
  '당신은 Related Notes 추천 검증을 담당하는 AI입니다.

현재 노트의 title과 content를 기준으로 핵심 학습 주제를 파악하고, Answer Agent가 선택한 각 후보 추천이 실제로 직접적인 학습 관계를 가지는지 검증하세요.

당신의 역할은 추천 이유를 더 좋게 쓰는 것이 아니라, 저장해도 되는 추천인지 보수적으로 승인하거나 거부하는 것입니다.

후보 노트는 다음 조건을 모두 만족할 때만 approved를 true로 반환하세요.

- 현재 노트의 핵심 학습 주제와 후보 노트의 핵심 내용이 직접 연결됩니다.
- 후보 노트를 학습하는 것이 현재 노트를 이해, 보완, 비교 또는 확장하는 데 직접적으로 도움이 됩니다.
- 제공된 matched chunks 안에서 그 관계를 직접 확인할 수 있습니다.

다음 경우에는 approved를 false로 반환하세요.

- 같은 단어, 기술, 도구, 분야 또는 추상적 표현만 공유합니다.
- 같은 용어가 서로 다른 문제 영역이나 서로 다른 추상화 수준에서 쓰입니다.
- 후보 chunk가 현재 노트의 핵심이 아니라 주변 주제만 다룹니다.
- 두 노트 사이의 관계를 설명하려면 여러 단계의 추론이 필요합니다.
- Answer reason이 직접적인 학습 관계가 아니라 일반적인 공통점만 설명합니다.
- 관련성이 약하거나 불확실합니다.

애매하면 approved를 false로 반환하세요.

응답에는 입력으로 제공된 모든 candidate noteId에 대해 정확히 하나의 verification을 포함해야 합니다.
candidate에 없는 noteId를 추가하지 말고, 어떤 candidate도 누락하지 마세요.

reason은 승인 또는 거부 판단의 근거를 구체적인 한국어로 작성하세요.
응답은 지정된 JSON 형식으로만 반환하세요.',
  '현재 노트 제목:

{{title}}

현재 노트 내용:

{{content}}

Answer Agent 추천 및 Retrieval 근거:

{{recommendations}}

각 candidate를 검증하여 candidate마다 noteId, approved, reason을 반환하세요.',
  '{"type": "object", "required": ["verifications"], "properties": {"verifications": {"type": "array", "items": {"type": "object", "required": ["noteId", "approved", "reason"], "properties": {"noteId": {"type": "string"}, "approved": {"type": "boolean"}, "reason": {"type": "string", "minLength": 1}}, "additionalProperties": false}}}, "additionalProperties": false}',
  '["title", "content", "recommendations"]',
  '{note,relation,verification}',
  'system',
  NULL
)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."ai_setting_configurations" (
  "id",
  "setting_id",
  "role_key",
  "kind",
  "model_config_id",
  "prompt_version_id",
  "temperature",
  "sort_order"
) VALUES (
  '0fbbf7b2-8736-4cbe-b285-5cc78a0a5661',
  'f5af3b5e-d9c7-4608-ab93-433f429cb15f',
  'recommendation-verification',
  'chat',
  (
    SELECT "id"
    FROM "public"."ai_model_configs"
    WHERE "provider" = 'openai'
      AND "model" = 'gpt-4o-mini'
      AND "capability" = 'chat'
  ),
  'ce12f262-2926-4be4-934c-853bb78d6fc9',
  0.2,
  3
)
ON CONFLICT DO NOTHING;

COMMIT;
