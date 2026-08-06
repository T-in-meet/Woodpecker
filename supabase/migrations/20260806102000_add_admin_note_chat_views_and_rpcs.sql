BEGIN;

CREATE OR REPLACE FUNCTION "public"."complete_note_chat_run_success"(
  "p_run_id" "uuid",
  "p_content" "jsonb",
  "p_sources" "jsonb" DEFAULT '[]'::"jsonb",
  "p_usage" "jsonb" DEFAULT NULL
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_run" "public"."note_chat_runs"%ROWTYPE;
  "v_conversation_id" "uuid";
  "v_next_sequence_number" integer;
  "v_assistant_message_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "p_run_id" IS NULL THEN
    RAISE EXCEPTION 'run_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  IF "p_sources" IS NULL OR jsonb_typeof("p_sources") <> 'array' THEN
    RAISE EXCEPTION 'sources must be a JSON array';
  END IF;

  IF "p_usage" IS NOT NULL AND jsonb_typeof("p_usage") <> 'object' THEN
    RAISE EXCEPTION 'usage must be a JSON object';
  END IF;

  SELECT *
  INTO "v_run"
  FROM "public"."note_chat_runs"
  WHERE "id" = "p_run_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run not found';
  END IF;

  IF "v_run"."status" <> 'running' THEN
    RAISE EXCEPTION 'run is not running';
  END IF;

  SELECT "messages"."conversation_id"
  INTO "v_conversation_id"
  FROM "public"."note_chat_messages" AS "messages"
  WHERE "messages"."id" = "v_run"."user_message_id"
    AND "messages"."role" = 'user'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user message not found';
  END IF;

  PERFORM 1
  FROM "public"."note_chat_conversations"
  WHERE "id" = "v_conversation_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  SELECT COALESCE(MAX("sequence_number"), 0) + 1
  INTO "v_next_sequence_number"
  FROM "public"."note_chat_messages"
  WHERE "conversation_id" = "v_conversation_id";

  INSERT INTO "public"."note_chat_messages" (
    "conversation_id",
    "role",
    "content",
    "sequence_number",
    "created_at",
    "updated_at"
  )
  VALUES (
    "v_conversation_id",
    'assistant',
    "p_content",
    "v_next_sequence_number",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_assistant_message_id";

  UPDATE "public"."note_chat_runs"
  SET
    "status" = 'succeeded',
    "assistant_message_id" = "v_assistant_message_id",
    "sources" = "p_sources",
    "usage" = "p_usage",
    "completed_at" = "v_now",
    "updated_at" = "v_now"
  WHERE "id" = "p_run_id";

  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "v_conversation_id";

  RETURN "v_assistant_message_id";
END;
$$;

CREATE OR REPLACE FUNCTION "public"."complete_note_chat_run_failure"(
  "p_run_id" "uuid",
  "p_usage" "jsonb" DEFAULT NULL
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_run" "public"."note_chat_runs"%ROWTYPE;
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "p_run_id" IS NULL THEN
    RAISE EXCEPTION 'run_id is required';
  END IF;

  IF "p_usage" IS NOT NULL AND jsonb_typeof("p_usage") <> 'object' THEN
    RAISE EXCEPTION 'usage must be a JSON object';
  END IF;

  SELECT *
  INTO "v_run"
  FROM "public"."note_chat_runs"
  WHERE "id" = "p_run_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run not found';
  END IF;

  IF "v_run"."status" <> 'running' THEN
    RAISE EXCEPTION 'run is not running';
  END IF;

  UPDATE "public"."note_chat_runs"
  SET
    "status" = 'failed',
    "usage" = "p_usage",
    "completed_at" = "v_now",
    "updated_at" = "v_now"
  WHERE "id" = "p_run_id";

  RETURN "p_run_id";
END;
$$;

CREATE OR REPLACE VIEW "public"."admin_note_chat_run_detail"
WITH ("security_invoker" = true)
AS
SELECT
  "runs"."id",
  "runs"."user_message_id",
  "runs"."assistant_message_id",
  "runs"."status",
  "runs"."agent_id",
  "runs"."prompt_version_id",
  "runs"."chat_model_config_id",
  "runs"."embedding_model_config_id",
  "runs"."sources",
  "runs"."usage",
  "runs"."started_at",
  "runs"."completed_at",
  "runs"."memo",
  "runs"."memo_updated_at",
  "runs"."created_at",
  "runs"."updated_at",
  "conversations"."id" AS "conversation_id",
  "conversations"."title" AS "conversation_title",
  "profiles"."id" AS "user_id",
  "profiles"."nickname" AS "user_nickname",
  "profiles"."avatar_url" AS "user_avatar_url",
  "user_messages"."content" AS "user_message_content",
  "user_messages"."sequence_number" AS "user_message_sequence_number",
  "user_messages"."created_at" AS "user_message_created_at",
  "user_messages"."updated_at" AS "user_message_updated_at",
  "assistant_messages"."content" AS "assistant_message_content",
  "assistant_messages"."sequence_number" AS "assistant_message_sequence_number",
  "assistant_messages"."created_at" AS "assistant_message_created_at",
  "assistant_messages"."updated_at" AS "assistant_message_updated_at",
  "agents"."display_name" AS "agent_display_name",
  "prompt_versions"."version_number" AS "prompt_version_number",
  "prompt_versions"."display_name" AS "prompt_version_display_name",
  "prompt_families"."id" AS "prompt_family_id",
  "prompt_families"."display_name" AS "prompt_family_display_name",
  "chat_models"."display_name" AS "chat_model_display_name",
  "embedding_models"."display_name" AS "embedding_model_display_name"
FROM "public"."note_chat_runs" AS "runs"
JOIN "public"."note_chat_messages" AS "user_messages"
  ON "user_messages"."id" = "runs"."user_message_id"
JOIN "public"."note_chat_conversations" AS "conversations"
  ON "conversations"."id" = "user_messages"."conversation_id"
JOIN "public"."profiles"
  ON "profiles"."id" = "conversations"."user_id"
LEFT JOIN "public"."note_chat_messages" AS "assistant_messages"
  ON "assistant_messages"."id" = "runs"."assistant_message_id"
LEFT JOIN "public"."ai_prompt_agents" AS "agents"
  ON "agents"."id" = "runs"."agent_id"
LEFT JOIN "public"."ai_prompt_versions" AS "prompt_versions"
  ON "prompt_versions"."id" = "runs"."prompt_version_id"
LEFT JOIN "public"."ai_prompt_families" AS "prompt_families"
  ON "prompt_families"."id" = "prompt_versions"."family_id"
LEFT JOIN "public"."ai_model_configs" AS "chat_models"
  ON "chat_models"."id" = "runs"."chat_model_config_id"
LEFT JOIN "public"."ai_model_configs" AS "embedding_models"
  ON "embedding_models"."id" = "runs"."embedding_model_config_id";

CREATE OR REPLACE FUNCTION "public"."get_admin_note_chat_run_list"(
  "p_search_query" "text",
  "p_status_filters" "text"[],
  "p_chat_model_config_id_filters" "uuid"[],
  "p_has_memo_filter" boolean,
  "p_created_from" timestamp with time zone,
  "p_created_to" timestamp with time zone,
  "p_sort_field" "text",
  "p_sort_direction" "text",
  "p_page" integer,
  "p_page_size" integer
)
RETURNS TABLE ("items" "jsonb", "total_count" bigint)
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
  WITH "params" AS (
    SELECT
      '%' || replace(replace(replace(trim(COALESCE("p_search_query", '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS "search_pattern",
      trim(COALESCE("p_search_query", '')) AS "search_query",
      CASE WHEN "p_sort_field" IN ('createdAt', 'userNickname') THEN "p_sort_field" ELSE 'createdAt' END AS "sort_field",
      CASE WHEN "p_sort_direction" = 'asc' THEN 'asc' ELSE 'desc' END AS "sort_direction",
      GREATEST(COALESCE("p_page", 1), 1) AS "page",
      LEAST(GREATEST(COALESCE("p_page_size", 10), 1), 100) AS "page_size"
  ),
  "base_rows" AS (
    SELECT
      "runs"."id",
      "runs"."status",
      "profiles"."id" AS "user_id",
      "profiles"."nickname" AS "user_nickname",
      "profiles"."avatar_url" AS "user_avatar_url",
      COALESCE("user_messages"."content"->>'text', '') AS "question_preview",
      "runs"."chat_model_config_id",
      "chat_models"."display_name" AS "chat_model_display_name",
      (
        "runs"."memo" IS NOT NULL
        AND char_length(btrim("runs"."memo")) > 0
      ) AS "has_memo",
      "runs"."created_at"
    FROM "public"."note_chat_runs" AS "runs"
    JOIN "public"."note_chat_messages" AS "user_messages"
      ON "user_messages"."id" = "runs"."user_message_id"
    JOIN "public"."note_chat_conversations" AS "conversations"
      ON "conversations"."id" = "user_messages"."conversation_id"
    JOIN "public"."profiles"
      ON "profiles"."id" = "conversations"."user_id"
    LEFT JOIN "public"."ai_model_configs" AS "chat_models"
      ON "chat_models"."id" = "runs"."chat_model_config_id"
  ),
  "filtered" AS (
    SELECT "base_rows".*
    FROM "base_rows"
    CROSS JOIN "params"
    WHERE (
      "params"."search_query" = ''
      OR "base_rows"."user_nickname" ILIKE "params"."search_pattern" ESCAPE '\'
      OR "base_rows"."question_preview" ILIKE "params"."search_pattern" ESCAPE '\'
    )
      AND (COALESCE(array_length("p_status_filters", 1), 0) = 0 OR "base_rows"."status" = ANY("p_status_filters"))
      AND (
        COALESCE(array_length("p_chat_model_config_id_filters", 1), 0) = 0
        OR "base_rows"."chat_model_config_id" = ANY("p_chat_model_config_id_filters")
      )
      AND ("p_has_memo_filter" IS NULL OR "base_rows"."has_memo" = "p_has_memo_filter")
      AND ("p_created_from" IS NULL OR "base_rows"."created_at" >= "p_created_from")
      AND ("p_created_to" IS NULL OR "base_rows"."created_at" < "p_created_to")
  ),
  "page_rows" AS (
    SELECT
      row_number() OVER (
        ORDER BY
          CASE WHEN "params"."sort_field" = 'createdAt' AND "params"."sort_direction" = 'asc' THEN "filtered"."created_at" END ASC NULLS LAST,
          CASE WHEN "params"."sort_field" = 'createdAt' AND "params"."sort_direction" = 'desc' THEN "filtered"."created_at" END DESC NULLS LAST,
          CASE WHEN "params"."sort_field" = 'userNickname' AND "params"."sort_direction" = 'asc' THEN "filtered"."user_nickname" END ASC NULLS LAST,
          CASE WHEN "params"."sort_field" = 'userNickname' AND "params"."sort_direction" = 'desc' THEN "filtered"."user_nickname" END DESC NULLS LAST,
          "filtered"."id" ASC
      ) AS "page_order",
      "filtered".*
    FROM "filtered"
    CROSS JOIN "params"
    ORDER BY "page_order"
    LIMIT (SELECT "page_size" FROM "params")
    OFFSET ((SELECT "page" FROM "params") - 1) * (SELECT "page_size" FROM "params")
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb("page_rows") - 'page_order' ORDER BY "page_rows"."page_order"), '[]'::jsonb) AS "items",
    (SELECT count(*) FROM "filtered") AS "total_count"
  FROM "page_rows";
$$;

COMMENT ON VIEW "public"."admin_note_chat_run_detail" IS
  '관리자 Note Chat Run 상세 조회를 위한 조회 전용 View';

REVOKE ALL ON TABLE "public"."admin_note_chat_run_detail" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."admin_note_chat_run_detail" TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_note_chat_run_success"(
  "uuid", "jsonb", "jsonb", "jsonb"
) FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."complete_note_chat_run_success"(
  "uuid", "jsonb", "jsonb", "jsonb"
) TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_note_chat_run_failure"(
  "uuid", "jsonb"
) FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."complete_note_chat_run_failure"(
  "uuid", "jsonb"
) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_admin_note_chat_run_list"(
  "text", "text"[], "uuid"[], boolean,
  timestamp with time zone, timestamp with time zone,
  "text", "text", integer, integer
) FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_note_chat_run_list"(
  "text", "text"[], "uuid"[], boolean,
  timestamp with time zone, timestamp with time zone,
  "text", "text", integer, integer
) TO "service_role";

COMMIT;
