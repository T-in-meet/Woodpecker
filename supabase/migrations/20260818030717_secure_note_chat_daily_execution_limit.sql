BEGIN;

-- ============================================================================
-- Note Chat 질문 생성 RPC
-- ============================================================================
--
-- Note Chat 일일 실행 제한을 Run 생성과 동일한 DB 트랜잭션 안에서 검증합니다.
--
-- 서버가 인증된 사용자 ID와 일일 실행 제한값, quota 우회 여부를 전달합니다.
-- 일반 사용자는 동일 사용자·동일 KST 날짜의 Run 생성 요청을
-- advisory transaction lock으로 직렬화하여 count 조회와 Run 생성 사이의
-- 경쟁 조건을 방지합니다.
--
-- 관리자는 운영 및 AI 기능 검증을 위해 일일 실행 제한을 적용하지 않습니다.
-- 관리자 여부는 서버에서 검증한 뒤 p_bypass_daily_execution_limit으로 전달합니다.
--
-- 이 RPC는 service_role에서만 실행하도록 권한을 제한합니다.
CREATE OR REPLACE FUNCTION "public"."create_note_chat_question"(
  "p_user_id" "uuid",
  "p_conversation_id" "uuid",
  "p_content" "jsonb",
  "p_daily_execution_limit" integer,
  "p_bypass_daily_execution_limit" boolean,
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
  "v_next_sequence_number" integer;
  "v_user_message_id" "uuid";
  "v_run_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
  "v_daily_start_at" timestamp with time zone;
  "v_daily_end_at" timestamp with time zone;
  "v_daily_count" integer;
  "v_kst_date" date;
BEGIN
  -- service_role 호출 시 auth.uid()를 사용할 수 없으므로
  -- 서버가 전달한 사용자 ID가 반드시 존재해야 합니다.
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  -- 일일 실행 제한값은 서버에서 전달하며,
  -- 관리자 bypass 여부와 관계없이 1 이상의 유효한 값만 허용합니다.
  IF "p_daily_execution_limit" IS NULL OR "p_daily_execution_limit" < 1 THEN
    RAISE EXCEPTION 'daily execution limit must be positive';
  END IF;

  -- quota 우회 여부는 서버가 명시적으로 전달해야 합니다.
  IF "p_bypass_daily_execution_limit" IS NULL THEN
    RAISE EXCEPTION 'daily execution limit bypass flag is required';
  END IF;

  -- service_role은 RLS를 우회하므로 RPC 내부에서도
  -- 전달받은 사용자가 실제로 이메일 인증을 완료했는지 다시 검증합니다.
  IF NOT EXISTS (
    SELECT 1
    FROM "auth"."users" AS "users"
    WHERE "users"."id" = "p_user_id"
      AND "users"."email_confirmed_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF "p_conversation_id" IS NULL THEN
    RAISE EXCEPTION 'conversation_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  -- 일반 사용자에게만 일일 실행 제한을 적용합니다.
  --
  -- 관리자 계정은 운영 및 AI 기능 검증을 위해 quota 검사를 건너뜁니다.
  -- bypass 여부는 service_role RPC를 호출하는 서버가 관리자 권한을
  -- 확인한 뒤 전달하며 클라이언트는 이 RPC를 직접 실행할 수 없습니다.
  IF NOT "p_bypass_daily_execution_limit" THEN
    -- 일일 실행 횟수는 Asia/Seoul 기준으로 계산합니다.
    -- 현재 실행 시각이 속한 KST 날짜의 시작 시각과 다음 날 시작 시각을
    -- timestamptz 범위로 변환하여 Run 생성 시각과 비교합니다.
    "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    -- 동일 사용자·동일 KST 날짜의 Note Chat Run 생성을 직렬화합니다.
    --
    -- count 조회와 Run INSERT가 서로 다른 동시 요청에서 함께 통과하여
    -- 일일 실행 제한을 초과하는 경쟁 조건을 방지합니다.
    --
    -- pg_advisory_xact_lock은 현재 트랜잭션 범위에서만 유지되며
    -- RPC가 commit 또는 rollback되면 자동으로 해제됩니다.
    PERFORM "pg_advisory_xact_lock"(
      "hashtextextended"(
        "p_user_id"::text
        || '|note-chat|'
        || "v_kst_date"::text,
        0
      )
    );

    -- Run에는 사용자 ID가 직접 저장되지 않으므로
    -- User Message와 Conversation을 따라가 해당 사용자의 오늘 Run을 계산합니다.
    --
    -- Run 상태와 관계없이 생성된 모든 Run을
    -- 일일 사용량에 포함합니다.
    SELECT count(*)
    INTO "v_daily_count"
    FROM "public"."note_chat_runs" AS "runs"
    JOIN "public"."note_chat_messages" AS "messages"
      ON "messages"."id" = "runs"."user_message_id"
    JOIN "public"."note_chat_conversations" AS "conversations"
      ON "conversations"."id" = "messages"."conversation_id"
    WHERE "conversations"."user_id" = "p_user_id"
      AND "runs"."created_at" >= "v_daily_start_at"
      AND "runs"."created_at" < "v_daily_end_at";

    -- 제한에 도달한 경우 Message와 Run을 생성하지 않고
    -- Route가 429 응답으로 변환할 수 있는 전용 SQLSTATE를 발생시킵니다.
    IF "v_daily_count" >= "p_daily_execution_limit" THEN
      RAISE EXCEPTION 'DAILY_EXECUTION_LIMIT_EXCEEDED'
        USING ERRCODE = 'WP002';
    END IF;
  END IF;

  -- service_role은 RLS를 우회하므로 전달받은 Conversation이
  -- 실제로 p_user_id 사용자의 소유인지 RPC 내부에서 다시 검증합니다.
  --
  -- 동시에 Conversation row를 잠가 같은 대화의 sequence_number 계산과
  -- Message 생성을 직렬화합니다.
  PERFORM 1
  FROM "public"."note_chat_conversations"
  WHERE "id" = "p_conversation_id"
    AND "user_id" = "p_user_id"
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


-- ============================================================================
-- Note Chat 사용자 질문 수정 RPC
-- ============================================================================
--
-- 기존 User Message를 수정하고 이후 대화를 제거한 뒤 새 Pending Run을 생성합니다.
--
-- 질문 수정 역시 새로운 AI Run을 생성하므로 새 질문과 동일한 일일 quota를
-- 적용하며, 일반 사용자는 동일 사용자·동일 KST 날짜 advisory transaction lock을
-- 사용해 count 조회와 Run 생성을 원자적으로 보호합니다.
--
-- 관리자는 운영 및 AI 기능 검증을 위해 일일 quota 검사를 건너뜁니다.
--
-- 이 RPC 역시 service_role에서만 실행하도록 권한을 제한합니다.
CREATE OR REPLACE FUNCTION "public"."update_note_chat_user_message"(
  "p_user_id" "uuid",
  "p_message_id" "uuid",
  "p_content" "jsonb",
  "p_daily_execution_limit" integer,
  "p_bypass_daily_execution_limit" boolean,
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
  "v_conversation_id" "uuid";
  "v_sequence_number" integer;
  "v_run_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
  "v_daily_start_at" timestamp with time zone;
  "v_daily_end_at" timestamp with time zone;
  "v_daily_count" integer;
  "v_kst_date" date;
BEGIN
  -- service_role 호출 시 auth.uid()를 사용할 수 없으므로
  -- 서버가 전달한 사용자 ID가 반드시 존재해야 합니다.
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  -- 일일 실행 제한값은 서버에서 전달하며,
  -- 관리자 bypass 여부와 관계없이 1 이상의 유효한 값만 허용합니다.
  IF "p_daily_execution_limit" IS NULL OR "p_daily_execution_limit" < 1 THEN
    RAISE EXCEPTION 'daily execution limit must be positive';
  END IF;

  -- quota 우회 여부는 서버가 명시적으로 전달해야 합니다.
  IF "p_bypass_daily_execution_limit" IS NULL THEN
    RAISE EXCEPTION 'daily execution limit bypass flag is required';
  END IF;

  -- service_role은 RLS를 우회하므로 RPC 내부에서도
  -- 전달받은 사용자가 실제로 이메일 인증을 완료했는지 다시 검증합니다.
  IF NOT EXISTS (
    SELECT 1
    FROM "auth"."users" AS "users"
    WHERE "users"."id" = "p_user_id"
      AND "users"."email_confirmed_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF "p_message_id" IS NULL THEN
    RAISE EXCEPTION 'message_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  -- 일반 사용자에게만 일일 실행 제한을 적용합니다.
  --
  -- 관리자 계정은 운영 및 AI 기능 검증을 위해 quota 검사를 건너뜁니다.
  IF NOT "p_bypass_daily_execution_limit" THEN
    -- 새 질문 생성과 동일하게 Asia/Seoul 날짜를 기준으로
    -- 현재 일일 사용량 조회 범위를 계산합니다.
    "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    -- 동일 사용자·동일 KST 날짜의 Run 생성 요청을 직렬화합니다.
    --
    -- 새 질문과 질문 수정 RPC가 동일한 advisory key 규칙을 사용하므로
    -- 서로 다른 Conversation에서 동시에 실행되더라도 하나의 사용자 일일 quota를
    -- 기준으로 순차적으로 count 검사와 Run 생성을 수행합니다.
    PERFORM "pg_advisory_xact_lock"(
      "hashtextextended"(
        "p_user_id"::text
        || '|note-chat|'
        || "v_kst_date"::text,
        0
      )
    );

    -- 질문 수정으로 생성되는 Run도 새 질문 Run과 동일하게
    -- 사용자 전체 Conversation의 오늘 실행 횟수에 포함합니다.
    SELECT count(*)
    INTO "v_daily_count"
    FROM "public"."note_chat_runs" AS "runs"
    JOIN "public"."note_chat_messages" AS "messages"
      ON "messages"."id" = "runs"."user_message_id"
    JOIN "public"."note_chat_conversations" AS "conversations"
      ON "conversations"."id" = "messages"."conversation_id"
    WHERE "conversations"."user_id" = "p_user_id"
      AND "runs"."created_at" >= "v_daily_start_at"
      AND "runs"."created_at" < "v_daily_end_at";

    -- 제한에 도달한 경우 기존 Message 수정 및 이후 Message 삭제를 수행하기 전에
    -- 전용 SQLSTATE를 발생시켜 RPC 전체를 종료합니다.
    IF "v_daily_count" >= "p_daily_execution_limit" THEN
      RAISE EXCEPTION 'DAILY_EXECUTION_LIMIT_EXCEEDED'
        USING ERRCODE = 'WP002';
    END IF;
  END IF;

  -- service_role은 RLS를 우회하므로 수정 대상 Message가 User 역할이며
  -- 실제로 p_user_id 사용자의 Conversation에 속하는지 RPC 내부에서 검증합니다.
  --
  -- Message와 Conversation을 함께 잠가 이후 수정·삭제 작업이
  -- 동일 Conversation의 다른 변경과 충돌하지 않도록 합니다.
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
    AND "conversations"."user_id" = "p_user_id"
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


-- ============================================================================
-- 기존 RPC 정리
-- ============================================================================

-- 새 service_role 전용 RPC로 대체된 기존 6-argument signature를 제거합니다.
--
-- 기존 RPC는 사용자 ID와 일일 실행 제한값을 인자로 받지 않아
-- 현재 quota 검증 및 소유권 검증 경로를 사용할 수 없습니다.
-- 더 이상 호출되지 않는 구 signature를 남겨두지 않고 함수 자체를 제거합니다.
DROP FUNCTION IF EXISTS "public"."create_note_chat_question"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
);

DROP FUNCTION IF EXISTS "public"."update_note_chat_user_message"(
  "uuid", "jsonb", "uuid", "uuid", "uuid", "uuid"
);


-- ============================================================================
-- RPC 실행 권한
-- ============================================================================

-- 새로운 질문 생성 RPC는 서버가 검증한 사용자 ID, 일일 제한값 및
-- 관리자 quota 우회 여부를 전달해야 하므로 service_role에서만 실행할 수 있습니다.
REVOKE ALL ON FUNCTION "public"."create_note_chat_question"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  boolean,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
) FROM PUBLIC, "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_note_chat_question"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  boolean,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
) TO "service_role";

-- 새로운 질문 수정 RPC 역시 동일한 이유로 service_role에만 실행 권한을 부여합니다.
REVOKE ALL ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  boolean,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
) FROM PUBLIC, "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  boolean,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
) TO "service_role";

COMMIT;