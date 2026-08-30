BEGIN;

/*
 * Note Chat 대화 제목 부분 검색을 위해 pg_trgm 확장을 사용합니다.
 */
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";


/* ============================================================================
 * Note Chat Conversation
 * ============================================================================
 *
 * 사용자와 노트 챗봇 사이의 하나의 대화를 저장합니다.
 *
 * updated_at은 일반적인 모든 변경에 갱신하지 않고,
 * 제목 변경 또는 Message 생성/수정 과정에서 별도 실행 경로가 갱신합니다.
 */
CREATE TABLE "public"."note_chat_conversations" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "user_id" "uuid" NOT NULL,
  "title" "text" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  /*
   * 제목은 공백만 입력할 수 없으며 최대 50자까지 허용합니다.
   */
  CONSTRAINT "note_chat_conversations_title_check"
    CHECK (
      char_length("title") <= 50
      AND char_length(btrim("title")) > 0
    )
);


/* ============================================================================
 * Note Chat Message
 * ============================================================================
 *
 * Conversation에 속한 User / Assistant Message를 저장합니다.
 *
 * content의 구체적인 JSON 구조는 애플리케이션 타입에서 관리하고,
 * DB에서는 JSON Object라는 조건만 보장합니다.
 *
 * sequence_number는 Conversation 내부의 메시지 순서를 나타냅니다.
 */
CREATE TABLE "public"."note_chat_messages" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "conversation_id" "uuid" NOT NULL,
  "role" "text" NOT NULL,
  "content" "jsonb" NOT NULL,
  "sequence_number" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  /*
   * Message Role은 user / assistant만 허용합니다.
   */
  CONSTRAINT "note_chat_messages_role_check"
    CHECK ("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])),

  /*
   * Message content는 JSON Object만 허용합니다.
   */
  CONSTRAINT "note_chat_messages_content_object_check"
    CHECK (jsonb_typeof("content") = 'object'),

  /*
   * Message 순번은 1부터 시작합니다.
   */
  CONSTRAINT "note_chat_messages_sequence_number_check"
    CHECK ("sequence_number" > 0)
);


/* ============================================================================
 * Note Chat Run
 * ============================================================================
 *
 * 하나의 User Message에 대한 AI 답변 생성 실행 이력을 저장합니다.
 *
 * 성공/실패 여부와 관계없이 Run을 보존하며,
 * 실행 당시 사용한 Prompt / Model / Source / Usage를 함께 저장합니다.
 */
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

  /*
   * Run 상태는 pending / running / succeeded / failed만 허용합니다.
   */
  CONSTRAINT "note_chat_runs_status_check"
    CHECK ("status" = ANY (ARRAY[
      'pending'::"text",
      'running'::"text",
      'succeeded'::"text",
      'failed'::"text"
    ])),

  /*
   * Source Snapshot은 JSON Array 형식으로 저장합니다.
   */
  CONSTRAINT "note_chat_runs_sources_array_check"
    CHECK (jsonb_typeof("sources") = 'array'),

  /*
   * Usage가 존재할 경우 JSON Object 형식이어야 합니다.
   */
  CONSTRAINT "note_chat_runs_usage_object_check"
    CHECK (("usage" IS NULL) OR jsonb_typeof("usage") = 'object'),

  /*
   * 관리자 메모는 최대 500자까지 허용합니다.
   */
  CONSTRAINT "note_chat_runs_memo_length_check"
    CHECK (("memo" IS NULL) OR char_length("memo") <= 500),

  /*
   * Run 상태별 필수 값의 일관성을 보장합니다.
   *
   * pending:
   * - 아직 시작/완료되지 않음
   * - Assistant Message 없음
   *
   * running:
   * - 시작 시각 존재
   * - 완료되지 않음
   * - Assistant Message 없음
   *
   * succeeded:
   * - 시작/완료 시각 존재
   * - Assistant Message 존재
   *
   * failed:
   * - 시작/완료 시각 존재
   * - Assistant Message 없음
   */
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


/* ============================================================================
 * Primary / Unique Constraints
 * ========================================================================== */

ALTER TABLE ONLY "public"."note_chat_conversations"
  ADD CONSTRAINT "note_chat_conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_pkey" PRIMARY KEY ("id");

/*
 * 하나의 Conversation 안에서 동일한 sequence_number를 중복 허용하지 않습니다.
 */
ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_conversation_sequence_key"
  UNIQUE ("conversation_id", "sequence_number");

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_pkey" PRIMARY KEY ("id");

/*
 * 하나의 Assistant Message는 하나의 Run에만 연결됩니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_assistant_message_id_key"
  UNIQUE ("assistant_message_id");


/* ============================================================================
 * Foreign Keys
 * ========================================================================== */

/*
 * 사용자 삭제 시 해당 사용자의 Conversation도 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."note_chat_conversations"
  ADD CONSTRAINT "note_chat_conversations_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."profiles"("id")
  ON DELETE CASCADE;

/*
 * Conversation 삭제 시 연결된 Message를 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."note_chat_messages"
  ADD CONSTRAINT "note_chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id")
  REFERENCES "public"."note_chat_conversations"("id")
  ON DELETE CASCADE;

/*
 * User Message 삭제 시 해당 Message의 Run도 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_user_message_id_fkey"
  FOREIGN KEY ("user_message_id")
  REFERENCES "public"."note_chat_messages"("id")
  ON DELETE CASCADE;

/*
 * Assistant Message 삭제 시 연결된 Run도 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_assistant_message_id_fkey"
  FOREIGN KEY ("assistant_message_id")
  REFERENCES "public"."note_chat_messages"("id")
  ON DELETE CASCADE;

/*
 * 실행 당시 사용한 AI 설정은 삭제될 수 있으므로
 * Run 자체를 삭제하지 않고 FK만 NULL 처리합니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_agent_id_fkey"
  FOREIGN KEY ("agent_id")
  REFERENCES "public"."ai_prompt_agents"("id")
  ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_prompt_version_id_fkey"
  FOREIGN KEY ("prompt_version_id")
  REFERENCES "public"."ai_prompt_versions"("id")
  ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_chat_model_config_id_fkey"
  FOREIGN KEY ("chat_model_config_id")
  REFERENCES "public"."ai_model_configs"("id")
  ON DELETE SET NULL;

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_embedding_model_config_id_fkey"
  FOREIGN KEY ("embedding_model_config_id")
  REFERENCES "public"."ai_model_configs"("id")
  ON DELETE SET NULL;


/* ============================================================================
 * Indexes
 * ========================================================================== */

/*
 * 사용자별 Conversation을 최근 활동 순으로 조회하기 위한 인덱스입니다.
 */
CREATE INDEX "note_chat_conversations_user_updated_at_idx"
  ON "public"."note_chat_conversations" (
    "user_id",
    "updated_at" DESC
  );

/*
 * Conversation 제목 부분 검색을 위한 trigram 인덱스입니다.
 */
CREATE INDEX "note_chat_conversations_title_trgm_idx"
  ON "public"."note_chat_conversations"
  USING "gin" ("title" "extensions"."gin_trgm_ops");

/*
 * Conversation의 Message를 sequence_number 순으로 조회하기 위한 인덱스입니다.
 */
CREATE INDEX "note_chat_messages_conversation_sequence_idx"
  ON "public"."note_chat_messages" (
    "conversation_id",
    "sequence_number"
  );

/*
 * User Message에 연결된 Run을 최근 생성 순으로 조회합니다.
 */
CREATE INDEX "note_chat_runs_user_message_created_at_idx"
  ON "public"."note_chat_runs" (
    "user_message_id",
    "created_at" DESC
  );

/*
 * 관리자 Run 조회에서 상태별 최근 실행 검색에 사용합니다.
 */
CREATE INDEX "note_chat_runs_status_created_at_idx"
  ON "public"."note_chat_runs" (
    "status",
    "created_at" DESC
  );

/*
 * Chat Model별 Run 조회에 사용합니다.
 */
CREATE INDEX "note_chat_runs_chat_model_config_created_at_idx"
  ON "public"."note_chat_runs" (
    "chat_model_config_id",
    "created_at" DESC
  );

/*
 * 전체 Run을 최근 실행 순으로 조회하는 데 사용합니다.
 */
CREATE INDEX "note_chat_runs_created_at_idx"
  ON "public"."note_chat_runs" ("created_at" DESC);


/* ============================================================================
 * Triggers
 * ========================================================================== */

/*
 * Conversation 제목이 실제로 변경된 경우에만 updated_at을 갱신합니다.
 */
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

/*
 * Message 수정 시 updated_at을 자동 갱신합니다.
 */
CREATE OR REPLACE TRIGGER "tr_note_chat_messages_updated_at"
  BEFORE UPDATE ON "public"."note_chat_messages"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();

/*
 * Run 수정 시 updated_at을 자동 갱신합니다.
 */
CREATE OR REPLACE TRIGGER "tr_note_chat_runs_updated_at"
  BEFORE UPDATE ON "public"."note_chat_runs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();


/* ============================================================================
 * Row Level Security
 * ========================================================================== */

ALTER TABLE "public"."note_chat_conversations"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."note_chat_messages"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."note_chat_runs"
  ENABLE ROW LEVEL SECURITY;


/*
 * 사용자는 자신의 Conversation만 조회할 수 있습니다.
 */
CREATE POLICY "note_chat_conversations_select_own"
  ON "public"."note_chat_conversations"
  FOR SELECT
  TO "authenticated"
  USING (
    "auth"."uid"() = "user_id"
  );

/*
 * 이메일 인증이 완료된 사용자는 자신의 Conversation만 생성할 수 있습니다.
 */
CREATE POLICY "note_chat_conversations_insert_own_confirmed"
  ON "public"."note_chat_conversations"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
    ("auth"."uid"() = "user_id")
    AND "public"."is_current_user_email_confirmed"()
  );

/*
 * 이메일 인증이 완료된 사용자는 자신의 Conversation만 수정할 수 있습니다.
 *
 * 실제 UPDATE 가능 컬럼은 아래 GRANT에서 title, updated_at으로 제한합니다.
 */
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

/*
 * 이메일 인증이 완료된 사용자는 자신의 Conversation만 삭제할 수 있습니다.
 *
 * Conversation 삭제 시 Message는 FK ON DELETE CASCADE로 삭제되고,
 * Message 삭제를 통해 연결된 Run도 함께 삭제됩니다.
 *
 * 따라서 authenticated 사용자에게
 * note_chat_messages / note_chat_runs의 직접 DELETE 권한은 부여하지 않습니다.
 */
CREATE POLICY "note_chat_conversations_delete_own_confirmed"
  ON "public"."note_chat_conversations"
  FOR DELETE
  TO "authenticated"
  USING (
    ("auth"."uid"() = "user_id")
    AND "public"."is_current_user_email_confirmed"()
  );

/*
 * 사용자는 자신이 소유한 Conversation에 속한 Message만 조회할 수 있습니다.
 */
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

/*
 * 사용자는 자신이 소유한 Conversation의 Message에 연결된 Run만 조회할 수 있습니다.
 */
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


/* ============================================================================
 * Table Privileges
 * ========================================================================== */

/*
 * 기본 권한을 모두 제거한 뒤 필요한 최소 권한만 다시 부여합니다.
 */
REVOKE ALL
  ON TABLE "public"."note_chat_conversations"
  FROM "anon", "authenticated";

REVOKE ALL
  ON TABLE "public"."note_chat_messages"
  FROM "anon", "authenticated";

REVOKE ALL
  ON TABLE "public"."note_chat_runs"
  FROM "anon", "authenticated";


/*
 * authenticated 사용자는 자신의 Conversation을 조회할 수 있습니다.
 */
GRANT SELECT
  ON TABLE "public"."note_chat_conversations"
  TO "authenticated";

/*
 * authenticated 사용자는 이메일 인증 및 RLS 조건을 만족할 경우
 * Conversation을 생성할 수 있습니다.
 */
GRANT INSERT
  ON TABLE "public"."note_chat_conversations"
  TO "authenticated";

/*
 * Conversation 직접 수정은 title과 updated_at 컬럼으로 제한합니다.
 */
GRANT UPDATE ("title", "updated_at")
  ON TABLE "public"."note_chat_conversations"
  TO "authenticated";

/*
 * authenticated 사용자는 RLS 조건을 만족하는 자신의 Conversation을
 * 삭제할 수 있습니다.
 */
GRANT DELETE
  ON TABLE "public"."note_chat_conversations"
  TO "authenticated";

/*
 * Message와 Run은 사용자 화면에서 조회만 허용합니다.
 * 생성·변경은 서버 실행 경로에서 처리합니다.
 */
GRANT SELECT
  ON TABLE "public"."note_chat_messages"
  TO "authenticated";

GRANT SELECT
  ON TABLE "public"."note_chat_runs"
  TO "authenticated";


/*
 * service_role은 Note Chat 실행 및 서버 관리 작업을 위해 전체 권한을 가집니다.
 */
GRANT ALL
  ON TABLE "public"."note_chat_conversations"
  TO "service_role";

GRANT ALL
  ON TABLE "public"."note_chat_messages"
  TO "service_role";

GRANT ALL
  ON TABLE "public"."note_chat_runs"
  TO "service_role";


/* ============================================================================
 * Trigger Function Privileges
 * ========================================================================== */

/*
 * Conversation updated_at 갱신 함수는 일반 사용자가 직접 실행할 수 없도록 합니다.
 */
REVOKE ALL
  ON FUNCTION "public"."update_note_chat_conversation_title_updated_at"()
  FROM PUBLIC, "anon", "authenticated";

/*
 * 서버 실행 경로에서는 해당 함수를 사용할 수 있도록 service_role에 권한을 줍니다.
 */
GRANT ALL
  ON FUNCTION "public"."update_note_chat_conversation_title_updated_at"()
  TO "service_role";


/* ============================================================================
 * Database Documentation
 * ========================================================================== */

COMMENT ON TABLE "public"."note_chat_conversations" IS
  '사용자와 노트 챗봇 사이의 하나의 대화';

COMMENT ON TABLE "public"."note_chat_messages" IS
  'Note Chat Conversation에 속한 User/Assistant Message';

COMMENT ON TABLE "public"."note_chat_runs" IS
  '하나의 User Message에 대한 AI 답변 생성 실행 이력';


COMMIT;
