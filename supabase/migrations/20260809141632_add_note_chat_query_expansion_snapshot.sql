BEGIN;

/* ============================================================================
 * Note Chat Query Expansion Snapshot
 * ============================================================================
 *
 * 문맥 기반 질의 확장을 통해 생성된 실제 검색 질의를
 * Note Chat Run에 Snapshot으로 저장합니다.
 *
 * Run 생성 시점에는 확장 질의가 아직 존재하지 않으므로 NULL을 허용하며,
 * 질의 확장이 완료된 뒤 애플리케이션 실행 경로에서 현재 Run을 UPDATE합니다.
 */
ALTER TABLE "public"."note_chat_runs"
  ADD COLUMN "expanded_query" "text";

/*
 * 확장 질의가 저장된 경우에는 공백 문자열을 허용하지 않습니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_expanded_query_check"
  CHECK (
    "expanded_query" IS NULL
    OR char_length(btrim("expanded_query")) > 0
  );

COMMENT ON COLUMN "public"."note_chat_runs"."expanded_query" IS
  '문맥 기반 질의 확장을 통해 생성되어 노트 검색에 사용된 검색 질의 Snapshot';


/* ============================================================================
 * Admin Note Chat Run Detail
 * ============================================================================
 *
 * 관리자 Run 상세 화면에서 원본 사용자 질문과 실제 검색에 사용된
 * 확장 질의를 함께 확인할 수 있도록 기존 상세 View에 컬럼을 추가합니다.
 *
 * CREATE OR REPLACE VIEW에서는 기존 컬럼의 이름·순서·타입을 변경할 수 없으므로
 * expanded_query는 기존 컬럼 뒤에 추가합니다.
 */
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
  "embedding_models"."display_name" AS "embedding_model_display_name",
  "runs"."expanded_query"
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

COMMENT ON VIEW "public"."admin_note_chat_run_detail" IS
  '관리자 Note Chat Run 상세 조회를 위한 조회 전용 View';

REVOKE ALL ON TABLE "public"."admin_note_chat_run_detail"
FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."admin_note_chat_run_detail"
TO "service_role";

COMMIT;