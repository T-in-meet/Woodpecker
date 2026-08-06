BEGIN;

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

CREATE TABLE "public"."note_chat_conversations" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "user_id" "uuid" NOT NULL,
  "title" "text" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "note_chat_conversations_title_check"
    CHECK (
      char_length("title") <= 50
      AND char_length(btrim("title")) > 0
    )
);

CREATE TABLE "public"."note_chat_messages" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "conversation_id" "uuid" NOT NULL,
  "role" "text" NOT NULL,
  "content" "jsonb" NOT NULL,
  "sequence_number" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "note_chat_messages_role_check"
    CHECK ("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])),
  CONSTRAINT "note_chat_messages_content_object_check"
    CHECK (jsonb_typeof("content") = 'object'),
  CONSTRAINT "note_chat_messages_sequence_number_check"
    CHECK ("sequence_number" > 0)
);

CREATE TABLE "public"."note_chat_runs" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "user_message_id" "uuid" NOT NULL,
  "assistant_message_id" "uuid",
  "status" "text" DEFAULT 'pending'::"text" NOT NULL,
  "agent_id" "uuid",
  "prompt_version_id" "uuid",
  "chat_model_config_id" "uuid",
  "embedding_model_config_id" "uuid",
  "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
  "usage" "jsonb",
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "memo" "text",
  "memo_updated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "note_chat_runs_status_check"
    CHECK ("status" = ANY (ARRAY[
      'pending'::"text",
      'running'::"text",
      'succeeded'::"text",
      'failed'::"text"
    ])),
  CONSTRAINT "note_chat_runs_sources_array_check"
    CHECK (jsonb_typeof("sources") = 'array'),
  CONSTRAINT "note_chat_runs_usage_object_check"
    CHECK (("usage" IS NULL) OR jsonb_typeof("usage") = 'object'),
  CONSTRAINT "note_chat_runs_memo_length_check"
    CHECK (("memo" IS NULL) OR char_length("memo") <= 500),
  CONSTRAINT "note_chat_runs_status_values_check"
    CHECK (
      (
        "status" = 'pending'
        AND "completed_at" IS NULL
        AND "assistant_message_id" IS NULL
      )
      OR (
        "status" = 'running'
        AND "started_at" IS NOT NULL
        AND "completed_at" IS NULL
        AND "assistant_message_id" IS NULL
      )
      OR (
        "status" = 'succeeded'
        AND "started_at" IS NOT NULL
        AND "completed_at" IS NOT NULL
        AND "assistant_message_id" IS NOT NULL
      )
      OR (
        "status" = 'failed'
        AND "started_at" IS NOT NULL
        AND "completed_at" IS NOT NULL
        AND "assistant_message_id" IS NULL
      )
    )
);

ALTER TABLE ONLY "public"."note_chat_conversations"
  ADD CONSTRAINT "note_chat_conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_conversation_sequence_key"
  UNIQUE ("conversation_id", "sequence_number");

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_assistant_message_id_key"
  UNIQUE ("assistant_message_id");

ALTER TABLE ONLY "public"."note_chat_conversations"
  ADD CONSTRAINT "note_chat_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."note_chat_conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_user_message_id_fkey"
  FOREIGN KEY ("user_message_id") REFERENCES "public"."note_chat_messages"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_assistant_message_id_fkey"
  FOREIGN KEY ("assistant_message_id") REFERENCES "public"."note_chat_messages"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "public"."ai_prompt_agents"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_prompt_version_id_fkey"
  FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_chat_model_config_id_fkey"
  FOREIGN KEY ("chat_model_config_id") REFERENCES "public"."ai_model_configs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_embedding_model_config_id_fkey"
  FOREIGN KEY ("embedding_model_config_id") REFERENCES "public"."ai_model_configs"("id") ON DELETE SET NULL;

CREATE INDEX "note_chat_conversations_user_updated_at_idx"
  ON "public"."note_chat_conversations" ("user_id", "updated_at" DESC);

CREATE INDEX "note_chat_conversations_title_trgm_idx"
  ON "public"."note_chat_conversations" USING "gin" ("title" "extensions"."gin_trgm_ops");

CREATE INDEX "note_chat_messages_conversation_sequence_idx"
  ON "public"."note_chat_messages" ("conversation_id", "sequence_number");

CREATE INDEX "note_chat_runs_user_message_created_at_idx"
  ON "public"."note_chat_runs" ("user_message_id", "created_at" DESC);

CREATE INDEX "note_chat_runs_status_created_at_idx"
  ON "public"."note_chat_runs" ("status", "created_at" DESC);

CREATE INDEX "note_chat_runs_chat_model_config_created_at_idx"
  ON "public"."note_chat_runs" ("chat_model_config_id", "created_at" DESC);

CREATE INDEX "note_chat_runs_created_at_idx"
  ON "public"."note_chat_runs" ("created_at" DESC);

CREATE OR REPLACE FUNCTION "public"."update_note_chat_conversation_title_updated_at"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SET "search_path" = "public"
AS $$
BEGIN
  IF NEW."title" IS DISTINCT FROM OLD."title" THEN
    NEW."updated_at" := "now"();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "tr_note_chat_conversations_title_updated_at"
  BEFORE UPDATE OF "title"
  ON "public"."note_chat_conversations"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_note_chat_conversation_title_updated_at"();

CREATE OR REPLACE TRIGGER "tr_note_chat_messages_updated_at"
  BEFORE UPDATE ON "public"."note_chat_messages"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "tr_note_chat_runs_updated_at"
  BEFORE UPDATE ON "public"."note_chat_runs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."note_chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."note_chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."note_chat_runs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_chat_conversations_select_own"
  ON "public"."note_chat_conversations"
  FOR SELECT
  TO "authenticated"
  USING ("auth"."uid"() = "user_id");

CREATE POLICY "note_chat_conversations_update_title_own_confirmed"
  ON "public"."note_chat_conversations"
  FOR UPDATE
  TO "authenticated"
  USING (
    ("auth"."uid"() = "user_id")
    AND "public"."is_current_user_email_confirmed"()
  )
  WITH CHECK (
    ("auth"."uid"() = "user_id")
    AND "public"."is_current_user_email_confirmed"()
  );

CREATE POLICY "note_chat_messages_select_own"
  ON "public"."note_chat_messages"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."note_chat_conversations" AS "conversations"
      WHERE "conversations"."id" = "note_chat_messages"."conversation_id"
        AND "conversations"."user_id" = "auth"."uid"()
    )
  );

CREATE POLICY "note_chat_runs_select_own"
  ON "public"."note_chat_runs"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."note_chat_messages" AS "messages"
      JOIN "public"."note_chat_conversations" AS "conversations"
        ON "conversations"."id" = "messages"."conversation_id"
      WHERE "messages"."id" = "note_chat_runs"."user_message_id"
        AND "conversations"."user_id" = "auth"."uid"()
    )
  );

REVOKE ALL ON TABLE "public"."note_chat_conversations" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."note_chat_messages" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."note_chat_runs" FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."note_chat_conversations" TO "authenticated";
GRANT UPDATE ("title", "updated_at") ON TABLE "public"."note_chat_conversations" TO "authenticated";
GRANT SELECT ON TABLE "public"."note_chat_messages" TO "authenticated";
GRANT SELECT ON TABLE "public"."note_chat_runs" TO "authenticated";

GRANT ALL ON TABLE "public"."note_chat_conversations" TO "service_role";
GRANT ALL ON TABLE "public"."note_chat_messages" TO "service_role";
GRANT ALL ON TABLE "public"."note_chat_runs" TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_note_chat_conversation_title_updated_at"()
  FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."update_note_chat_conversation_title_updated_at"()
  TO "service_role";

COMMENT ON TABLE "public"."note_chat_conversations" IS
  '사용자와 노트 챗봇 사이의 하나의 대화';

COMMENT ON TABLE "public"."note_chat_messages" IS
  'Note Chat Conversation에 속한 User/Assistant Message';

COMMENT ON TABLE "public"."note_chat_runs" IS
  '하나의 User Message에 대한 AI 답변 생성 실행 이력';

COMMIT;
