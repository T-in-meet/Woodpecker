BEGIN;

CREATE OR REPLACE VIEW "public"."note_chat_conversation_list"
WITH ("security_invoker" = true)
AS
SELECT
  "conversations"."id",
  "conversations"."title",
  "conversations"."created_at",
  "conversations"."updated_at",
  "last_message"."id" AS "last_message_id",
  "last_message"."role" AS "last_message_role",
  "last_message"."content" AS "last_message_content",
  "last_message"."created_at" AS "last_message_created_at"
FROM "public"."note_chat_conversations" AS "conversations"
LEFT JOIN LATERAL (
  SELECT
    "messages"."id",
    "messages"."role",
    "messages"."content",
    "messages"."created_at"
  FROM "public"."note_chat_messages" AS "messages"
  WHERE "messages"."conversation_id" = "conversations"."id"
  ORDER BY "messages"."sequence_number" DESC
  LIMIT 1
) AS "last_message" ON true;

CREATE OR REPLACE FUNCTION "public"."create_note_chat_question"(
  "p_conversation_id" "uuid",
  "p_content" "jsonb",
  "p_agent_id" "uuid" DEFAULT NULL,
  "p_prompt_version_id" "uuid" DEFAULT NULL,
  "p_chat_model_config_id" "uuid" DEFAULT NULL,
  "p_embedding_model_config_id" "uuid" DEFAULT NULL
)
RETURNS TABLE ("user_message_id" "uuid", "run_id" "uuid")
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_user_id" "uuid" := "auth"."uid"();
  "v_next_sequence_number" integer;
  "v_user_message_id" "uuid";
  "v_run_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT "public"."is_current_user_email_confirmed"() THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF "p_conversation_id" IS NULL THEN
    RAISE EXCEPTION 'conversation_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  PERFORM 1
  FROM "public"."note_chat_conversations"
  WHERE "id" = "p_conversation_id"
    AND "user_id" = "v_user_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  SELECT COALESCE(MAX("sequence_number"), 0) + 1
  INTO "v_next_sequence_number"
  FROM "public"."note_chat_messages"
  WHERE "conversation_id" = "p_conversation_id";

  INSERT INTO "public"."note_chat_messages" (
    "conversation_id",
    "role",
    "content",
    "sequence_number",
    "created_at",
    "updated_at"
  )
  VALUES (
    "p_conversation_id",
    'user',
    "p_content",
    "v_next_sequence_number",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_user_message_id";

  INSERT INTO "public"."note_chat_runs" (
    "user_message_id",
    "status",
    "agent_id",
    "prompt_version_id",
    "chat_model_config_id",
    "embedding_model_config_id",
    "created_at",
    "updated_at"
  )
  VALUES (
    "v_user_message_id",
    'pending',
    "p_agent_id",
    "p_prompt_version_id",
    "p_chat_model_config_id",
    "p_embedding_model_config_id",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_run_id";

  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "p_conversation_id";

  RETURN QUERY SELECT "v_user_message_id", "v_run_id";
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_note_chat_user_message"(
  "p_message_id" "uuid",
  "p_content" "jsonb",
  "p_agent_id" "uuid" DEFAULT NULL,
  "p_prompt_version_id" "uuid" DEFAULT NULL,
  "p_chat_model_config_id" "uuid" DEFAULT NULL,
  "p_embedding_model_config_id" "uuid" DEFAULT NULL
)
RETURNS TABLE ("user_message_id" "uuid", "run_id" "uuid")
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_user_id" "uuid" := "auth"."uid"();
  "v_conversation_id" "uuid";
  "v_sequence_number" integer;
  "v_run_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT "public"."is_current_user_email_confirmed"() THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF "p_message_id" IS NULL THEN
    RAISE EXCEPTION 'message_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  SELECT
    "messages"."conversation_id",
    "messages"."sequence_number"
  INTO
    "v_conversation_id",
    "v_sequence_number"
  FROM "public"."note_chat_messages" AS "messages"
  JOIN "public"."note_chat_conversations" AS "conversations"
    ON "conversations"."id" = "messages"."conversation_id"
  WHERE "messages"."id" = "p_message_id"
    AND "messages"."role" = 'user'
    AND "conversations"."user_id" = "v_user_id"
  FOR UPDATE OF "messages", "conversations";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user message not found';
  END IF;

  DELETE FROM "public"."note_chat_messages"
  WHERE "conversation_id" = "v_conversation_id"
    AND "sequence_number" > "v_sequence_number";

  UPDATE "public"."note_chat_messages"
  SET
    "content" = "p_content",
    "updated_at" = "v_now"
  WHERE "id" = "p_message_id";

  INSERT INTO "public"."note_chat_runs" (
    "user_message_id",
    "status",
    "agent_id",
    "prompt_version_id",
    "chat_model_config_id",
    "embedding_model_config_id",
    "created_at",
    "updated_at"
  )
  VALUES (
    "p_message_id",
    'pending',
    "p_agent_id",
    "p_prompt_version_id",
    "p_chat_model_config_id",
    "p_embedding_model_config_id",
    "v_now",
    "v_now"
  )
  RETURNING "id" INTO "v_run_id";

  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "v_conversation_id";

  RETURN QUERY SELECT "p_message_id", "v_run_id";
END;
$$;

COMMENT ON VIEW "public"."note_chat_conversation_list" IS
  '사용자의 Note Chat Conversation 목록과 실제 마지막 Message를 반환하는 조회 전용 View';

REVOKE ALL ON TABLE "public"."note_chat_conversation_list" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."note_chat_conversation_list" TO "authenticated";
GRANT SELECT ON TABLE "public"."note_chat_conversation_list" TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_note_chat_question"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
) FROM PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."create_note_chat_question"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
) FROM PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
) TO "authenticated";

COMMIT;
