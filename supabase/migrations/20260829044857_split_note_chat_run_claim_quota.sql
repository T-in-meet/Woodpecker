BEGIN;

/* ============================================================================
 * Note Chat Execution Claims
 * ============================================================================
 *
 * Note Chat 실행 제어를 note_chat_runs에서 분리합니다.
 *
 * note_chat_runs는 실행 중 생성되는 관측/감사용 snapshot만 저장하고,
 * conversation 단위 in-flight 방지와 일일 quota 판정은 이 claim 테이블과
 * RPC가 담당합니다. 이 구조는 Related Notes의 execution claim 구조를
 * 기준으로 하되, Note Chat은 같은 conversation에서 다음 질문을 계속할 수
 * 있어야 하므로 succeeded claim을 중복 실행 차단 key로 사용하지 않습니다.
 */
/*
 * 실행 제어의 정본 테이블입니다.
 *
 * 한 번의 Note Chat 실행마다 Claim 한 건을 만들고,
 * 실행 중에는 running, 성공/실패/만료 시 terminal 상태로 전환합니다.
 * Run 테이블과 달리 "지금 실행 가능한가", "오늘 몇 회 사용했는가"를
 * 판단하기 위한 제어 데이터이므로 conversation_id와 상태/시각만 보관합니다.
 */
CREATE TABLE "public"."note_chat_execution_claims" (
  "id" "uuid" DEFAULT gen_random_uuid() NOT NULL,
  "user_id" "uuid" NOT NULL,
  "conversation_id" "uuid" NOT NULL,
  "status" text DEFAULT 'running'::text NOT NULL,
  "claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "note_chat_execution_claims_status_check"
    CHECK (
      "status" IN (
        'running'::text,
        'succeeded'::text,
        'failed'::text,
        'stale'::text
      )
    ),
  CONSTRAINT "note_chat_execution_claims_completion_check"
    CHECK (
      (
        "status" = 'running'::text
        AND "completed_at" IS NULL
      )
      OR (
        "status" IN ('succeeded'::text, 'failed'::text, 'stale'::text)
        AND "completed_at" IS NOT NULL
      )
    )
);

/*
 * 각 Claim은 독립적인 실행 제어 단위이므로 UUID 기본키를 사용합니다.
 */
ALTER TABLE ONLY "public"."note_chat_execution_claims"
  ADD CONSTRAINT "note_chat_execution_claims_pkey"
  PRIMARY KEY ("id");

/*
 * 사용자 삭제 시 해당 사용자의 실행 제어 이력도 함께 정리합니다.
 */
ALTER TABLE ONLY "public"."note_chat_execution_claims"
  ADD CONSTRAINT "note_chat_execution_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

/*
 * Conversation이 삭제되면 더 이상 해당 실행 제어 정보도 의미가 없으므로
 * Claim을 함께 삭제합니다.
 */
ALTER TABLE ONLY "public"."note_chat_execution_claims"
  ADD CONSTRAINT "note_chat_execution_claims_conversation_id_fkey"
  FOREIGN KEY ("conversation_id")
  REFERENCES "public"."note_chat_conversations"("id")
  ON DELETE CASCADE;

/*
 * 같은 conversation에서 동시에 두 답변이 생성되면 assistant message 순서가
 * 실행 완료 순서에 따라 뒤섞일 수 있습니다. 따라서 running claim은
 * conversation 단위로 하나만 허용합니다.
 *
 * succeeded claim은 일일 quota에는 포함하지만 active lock으로 유지하지
 * 않습니다. Related Notes와 달리 Note Chat conversation은 같은 resource에
 * 여러 turn을 계속 추가해야 하기 때문입니다.
 */
CREATE UNIQUE INDEX "note_chat_execution_claims_active_uidx"
  ON "public"."note_chat_execution_claims" (
    "user_id",
    "conversation_id"
  )
  WHERE "status" = 'running'::text;

/*
 * 사용자별 일일 quota 계산에서 claimed_at 범위를 자주 조회하므로
 * user_id + claimed_at 인덱스를 둡니다.
 */
CREATE INDEX "note_chat_execution_claims_user_claimed_idx"
  ON "public"."note_chat_execution_claims" (
    "user_id",
    "claimed_at" DESC
  );

/*
 * 운영/정리 과정에서 상태별 Claim과 오래된 Claim을 찾기 쉽게 하기 위한
 * 보조 인덱스입니다.
 */
CREATE INDEX "note_chat_execution_claims_status_claimed_idx"
  ON "public"."note_chat_execution_claims" (
    "status",
    "claimed_at" DESC
  );

/*
 * 기존 배포에서는 note_chat_runs가 실행 제어와 quota의 정본이었습니다.
 * 새 claim 테이블을 빈 상태로 시작하면 배포 직전의 running/pending 실행과
 * 당일 succeeded 실행이 quota 및 in-flight 판단에서 사라집니다.
 *
 * terminal Run은 quota 이력 보존을 위해 claim으로 이관합니다. failed는
 * 새 정책에서 quota 제외 대상이지만, 실행 제어 이력의 연속성을 위해 failed
 * claim으로 남깁니다.
 */
INSERT INTO "public"."note_chat_execution_claims" (
  "user_id",
  "conversation_id",
  "status",
  "claimed_at",
  "completed_at"
)
SELECT
  "conversations"."user_id",
  "conversations"."id",
  "runs"."status",
  COALESCE("runs"."started_at", "runs"."created_at"),
  "runs"."completed_at"
FROM "public"."note_chat_runs" AS "runs"
JOIN "public"."note_chat_messages" AS "messages"
  ON "messages"."id" = "runs"."user_message_id"
JOIN "public"."note_chat_conversations" AS "conversations"
  ON "conversations"."id" = "messages"."conversation_id"
WHERE "runs"."status" IN ('succeeded'::text, 'failed'::text);

/*
 * pending/running legacy Run은 active 실행 제어 상태로 이관합니다.
 * 동일 conversation에 여러 legacy active Run이 있으면 가장 최근 것만
 * running claim으로 복원합니다. 오래된 중복 pending/running Run은 이미
 * 새 구조로 정확히 제어할 수 없으므로, active lock을 과도하게 만들지 않기
 * 위해 제외합니다.
 */
INSERT INTO "public"."note_chat_execution_claims" (
  "user_id",
  "conversation_id",
  "status",
  "claimed_at"
)
SELECT DISTINCT ON ("conversations"."user_id", "conversations"."id")
  "conversations"."user_id",
  "conversations"."id",
  'running'::text,
  COALESCE("runs"."started_at", "runs"."created_at")
FROM "public"."note_chat_runs" AS "runs"
JOIN "public"."note_chat_messages" AS "messages"
  ON "messages"."id" = "runs"."user_message_id"
JOIN "public"."note_chat_conversations" AS "conversations"
  ON "conversations"."id" = "messages"."conversation_id"
WHERE "runs"."status" IN ('pending'::text, 'running'::text)
ORDER BY
  "conversations"."user_id",
  "conversations"."id",
  COALESCE("runs"."started_at", "runs"."created_at") DESC;

/*
 * Claim은 사용자별 실행 제어 데이터이므로 RLS를 활성화합니다.
 * 클라이언트는 자신의 Claim만 읽을 수 있고,
 * 생성/상태 전환 같은 제어 작업은 service_role RPC를 통해서만 수행합니다.
 */
ALTER TABLE "public"."note_chat_execution_claims"
  ENABLE ROW LEVEL SECURITY;

/*
 * 인증 사용자는 자신의 Claim 상태만 조회할 수 있습니다.
 * 쓰기 정책은 만들지 않아 클라이언트의 직접 변경을 막습니다.
 */
CREATE POLICY "note_chat_execution_claims_select_own"
  ON "public"."note_chat_execution_claims"
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = "user_id");

/*
 * Note Chat 실행 시작을 선점하는 RPC입니다.
 *
 * 주요 책임:
 * 1. 사용자/Conversation 유효성 검증
 * 2. 동일 Conversation의 중복 실행 방지
 * 3. 오래된 running Claim을 stale로 정리
 * 4. KST 기준 일일 quota 검사
 * 5. 새 running Claim 생성
 *
 * 이 함수가 성공적으로 'claimed'를 반환한 뒤에만 실제 AI 실행을 시작합니다.
 */
CREATE OR REPLACE FUNCTION "public"."claim_note_chat_execution"(
  "p_user_id" "uuid",
  "p_conversation_id" "uuid",
  "p_daily_execution_limit" integer
)
RETURNS TABLE ("status" text, "claim_id" "uuid")
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  "v_existing_claim_id" "uuid";
  "v_is_admin" boolean;
  "v_now" timestamp with time zone := clock_timestamp();
  "v_kst_date" date;
  "v_daily_start_at" timestamp with time zone;
  "v_daily_end_at" timestamp with time zone;
  "v_daily_count" integer;
  "v_claim_id" "uuid";
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF "p_conversation_id" IS NULL THEN
    RAISE EXCEPTION 'conversation_id is required';
  END IF;

  IF "p_daily_execution_limit" IS NULL OR "p_daily_execution_limit" < 1 THEN
    RAISE EXCEPTION 'daily execution limit must be positive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "auth"."users" AS "users"
    WHERE "users"."id" = "p_user_id"
      AND "users"."email_confirmed_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "public"."note_chat_conversations" AS "conversations"
    WHERE "conversations"."id" = "p_conversation_id"
      AND "conversations"."user_id" = "p_user_id"
  ) THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  /*
   * ADMIN은 기존 정책대로 일일 quota를 우회합니다.
   * 다만 동일 Conversation의 중복 실행 방지는 관리자에게도 동일하게 적용됩니다.
   */
  SELECT EXISTS (
    SELECT 1
    FROM "public"."profiles" AS "profiles"
    WHERE "profiles"."id" = "p_user_id"
      AND "profiles"."role" = 'ADMIN'
  )
  INTO "v_is_admin";

  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;

  /*
   * 동일 사용자의 같은 KST 날짜 claim을 직렬화하여 quota count와 claim
   * INSERT 사이의 경쟁 조건을 제거합니다. 관리자는 quota를 우회하지만 같은
   * lock 규칙을 유지해 role 변경 경계에서도 실행 순서를 단순하게 만듭니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|note-chat-execution|'
      || "v_kst_date"::text,
      0
    )
  );

  /*
   * conversation 단위 실행 선점을 직렬화합니다. unique index만으로도
   * 최종 중복 INSERT는 막을 수 있지만, 명시적인 lock을 사용하면 duplicate
   * 상태를 예외가 아닌 정상 RPC 결과로 일관되게 반환할 수 있습니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|note-chat-execution|'
      || "p_conversation_id"::text,
      0
    )
  );

  /*
  * quota는 사용자 단위로 running + succeeded Claim을 계산하므로,
  * 다른 Conversation에서 orphan된 running Claim도 quota를 계속 점유할 수 있습니다.
  *
  * 따라서 quota 계산 전에 현재 사용자의 만료된 running Claim 전체를
  * stale로 종료합니다.
  *
  * Conversation 중복 실행 판정은 아래에서 별도로 현재 conversation_id만
  * 기준으로 수행합니다.
  */
  UPDATE "public"."note_chat_execution_claims" AS "claims"
  SET "status" = 'stale',
      "completed_at" = "v_now"
  WHERE "claims"."user_id" = "p_user_id"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  /*
   * stale 정리 이후에도 현재 Conversation에 running Claim이 남아 있으면
   * 실제 실행을 새로 시작하지 않고 duplicate 상태로 기존 Claim ID를 돌려줍니다.
   */
  SELECT "claims"."id"
  INTO "v_existing_claim_id"
  FROM "public"."note_chat_execution_claims" AS "claims"
  WHERE "claims"."user_id" = "p_user_id"
    AND "claims"."conversation_id" = "p_conversation_id"
    AND "claims"."status" = 'running'
  ORDER BY "claims"."claimed_at" DESC
  LIMIT 1;

  IF "v_existing_claim_id" IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicate'::text, "v_existing_claim_id";
    RETURN;
  END IF;

  IF NOT "v_is_admin" THEN
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    /*
     * Note Chat quota는 최종 claim 상태를 기준으로 단순하게 계산합니다.
     * running은 현재 사용자 요청이 비용을 발생시킬 수 있으므로 포함하고,
     * succeeded는 성공한 일일 사용량이므로 포함합니다.
     * failed/stale은 사용자가 성공 응답을 얻지 못했거나 만료된 실행이므로
     * quota에서 제외합니다.
     */
    SELECT count(*)
    INTO "v_daily_count"
    FROM "public"."note_chat_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running'::text, 'succeeded'::text);

    IF "v_daily_count" >= "p_daily_execution_limit" THEN
      RETURN QUERY SELECT 'daily_limit_exceeded'::text, NULL::"uuid";
      RETURN;
    END IF;
  END IF;

  /*
   * 모든 검사를 통과한 경우에만 실제 실행 선점 상태인 running Claim을 만듭니다.
   * 이 시점부터 성공/실패 완료 처리 전까지 같은 Conversation의 새 실행은 막힙니다.
   */
  INSERT INTO "public"."note_chat_execution_claims" (
    "user_id",
    "conversation_id",
    "status",
    "claimed_at"
  )
  VALUES (
    "p_user_id",
    "p_conversation_id",
    'running',
    "v_now"
  )
  RETURNING "id" INTO "v_claim_id";

  RETURN QUERY SELECT 'claimed'::text, "v_claim_id";
END;
$$;

/*
 * 현재 인증 사용자의 KST 기준 Note Chat 일일 사용량을 조회합니다.
 *
 * 실제 quota 판정과 동일하게 running + succeeded Claim만 사용량에 포함하고,
 * failed/stale Claim은 제외합니다.
 *
 * ADMIN은 애플리케이션 query 계층에서 이 RPC를 호출하지 않으므로,
 * 이 함수는 현재 인증 사용자의 실제 Claim 사용량만 반환합니다.
 */
CREATE OR REPLACE FUNCTION "public"."get_note_chat_daily_usage"()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  "v_user_id" "uuid" := (SELECT auth.uid());
  "v_now" timestamp with time zone := clock_timestamp();
  "v_kst_date" date;
  "v_daily_start_at" timestamp with time zone;
  "v_daily_end_at" timestamp with time zone;
  "v_daily_count" integer;
BEGIN
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
  "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
  "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

  /*
   * claim_note_chat_execution()의 일일 quota 계산과 동일한 기준을 사용합니다.
   *
   * running은 현재 비용을 발생시킬 수 있는 실행이므로 포함하고,
   * succeeded는 정상적으로 사용된 실행이므로 포함합니다.
   * failed/stale은 일일 quota에서 제외합니다.
   */
  SELECT count(*)
  INTO "v_daily_count"
  FROM "public"."note_chat_execution_claims" AS "claims"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."claimed_at" >= "v_daily_start_at"
    AND "claims"."claimed_at" < "v_daily_end_at"
    AND "claims"."status" IN ('running'::text, 'succeeded'::text);

  RETURN "v_daily_count";
END;
$$;


/*
 * 실패하거나 만료된 Note Chat 실행의 Claim을 종료합니다.
 *
 * 성공 실행은 이 함수에서 처리하지 않습니다.
 * 성공은 Assistant Message 저장과 Claim succeeded 전환이 하나의 transaction으로
 * 확정되어야 하므로 complete_note_chat_execution_success()를 사용합니다.
 *
 * 이 함수는 실패 cleanup 또는 stale 정리처럼 "성공하지 않은 실행"을
 * terminal 상태로 만드는 용도입니다.
 */
CREATE OR REPLACE FUNCTION "public"."complete_note_chat_execution_claim"(
  "p_claim_id" "uuid",
  "p_status" text
)
RETURNS "uuid"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  "v_completed_claim_id" "uuid";
BEGIN
  IF "p_claim_id" IS NULL THEN
    RAISE EXCEPTION 'claim_id is required';
  END IF;

  /*
   * succeeded는 의도적으로 허용하지 않습니다.
   * succeeded를 여기서 독립적으로 처리하면 Assistant Message 저장과
   * Claim 성공 전환이 서로 다른 transaction으로 나뉠 수 있기 때문입니다.
   */
  IF "p_status" NOT IN ('failed'::text, 'stale'::text) THEN
    RAISE EXCEPTION 'execution claim completion status is invalid';
  END IF;

  /*
   * failed/stale 전환은 남아 있는 running Claim을 종료해
   * Conversation의 active lock과 quota 점유를 해제하는 정리 작업입니다.
   *
   * Run은 감사 기록이므로 Run 갱신이 실패하더라도 Claim 정리는 별도로 시도합니다.
   */
  UPDATE "public"."note_chat_execution_claims"
  SET
    "status" = "p_status",
    "completed_at" = clock_timestamp()
  WHERE "id" = "p_claim_id"
    AND "status" = 'running'
  RETURNING "id" INTO "v_completed_claim_id";

  IF "v_completed_claim_id" IS NULL THEN
    RAISE EXCEPTION 'running execution claim not found';
  END IF;

  RETURN "v_completed_claim_id";
END;
$$;


/* ============================================================================
 * Note Chat Runs as Audit Records
 * ========================================================================== */

/*
 * Run 컬럼 구성이 바뀌므로 기존 View를 먼저 제거한 뒤 아래에서 다시 생성합니다.
 * View가 기존 usage 컬럼을 참조한 상태에서는 해당 컬럼을 안전하게 삭제할 수 없습니다.
 */
DROP VIEW IF EXISTS "public"."admin_note_chat_run_detail";

/*
 * Run은 이제 실행 제어가 아니라 감사/관측 기록만 담당합니다.
 * 각 AI 단계의 usage와 비용을 독립적으로 저장해 어느 단계에서
 * 얼마의 토큰/비용이 발생했는지 사후 분석할 수 있도록 합니다.
 */
ALTER TABLE "public"."note_chat_runs"
  ADD COLUMN "query_expansion_usage" "jsonb",
  ADD COLUMN "query_embedding_usage" "jsonb",
  ADD COLUMN "answer_generation_usage" "jsonb",
  ADD COLUMN "query_expansion_cost_usd" numeric,
  ADD COLUMN "query_embedding_cost_usd" numeric,
  ADD COLUMN "answer_generation_cost_usd" numeric,
  ADD COLUMN "total_cost_usd" numeric GENERATED ALWAYS AS (
    COALESCE("query_expansion_cost_usd", 0)
    + COALESCE("query_embedding_cost_usd", 0)
    + COALESCE("answer_generation_cost_usd", 0)
  ) STORED,
  ADD COLUMN "failure_message" "text";

/*
 * 기존 aggregate usage는 production 로직에서 직접 의존하지 않고,
 * query expansion / query embedding / answer generation을 구분할 수 없어
 * Related Notes와 같은 단계별 usage/cost 기록으로 대체합니다.
 */
ALTER TABLE "public"."note_chat_runs"
  DROP CONSTRAINT IF EXISTS "note_chat_runs_usage_object_check";

ALTER TABLE "public"."note_chat_runs"
  DROP COLUMN IF EXISTS "usage";

/*
 * Provider usage snapshot은 JSON object만 허용합니다.
 * 잘못된 scalar/array 값이 Run 감사 기록에 들어오는 것을 DB 수준에서 막습니다.
 */
ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_query_expansion_usage_object_check"
  CHECK (
    ("query_expansion_usage" IS NULL)
    OR jsonb_typeof("query_expansion_usage") = 'object'
  );

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_query_embedding_usage_object_check"
  CHECK (
    ("query_embedding_usage" IS NULL)
    OR jsonb_typeof("query_embedding_usage") = 'object'
  );

ALTER TABLE ONLY "public"."note_chat_runs"
  ADD CONSTRAINT "note_chat_runs_answer_generation_usage_object_check"
  CHECK (
    ("answer_generation_usage" IS NULL)
    OR jsonb_typeof("answer_generation_usage") = 'object'
  );


/* ============================================================================
 * User Message RPCs
 * ========================================================================== */

/*
 * 새 User Message를 Conversation 끝에 추가합니다.
 *
 * quota / 실행 선점은 이 함수의 책임이 아닙니다.
 * 애플리케이션은 먼저 claim_note_chat_execution()으로 실행권을 획득한 뒤
 * 이 RPC를 호출합니다.
 */
CREATE OR REPLACE FUNCTION "public"."create_note_chat_question"(
  "p_user_id" "uuid",
  "p_conversation_id" "uuid",
  "p_content" "jsonb"
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_next_sequence_number" integer;
  "v_user_message_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

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

  /*
   * Claim RPC가 quota와 in-flight를 먼저 선점하지만, 이 RPC도 service_role
   * 호출을 받으므로 conversation 소유권을 다시 확인합니다.
   *
   * conversation row lock은 sequence_number 계산과 message INSERT 사이를
   * 직렬화하여 같은 대화 안에서 메시지 순서가 중복되지 않게 합니다.
   */
  PERFORM 1
  FROM "public"."note_chat_conversations"
  WHERE "id" = "p_conversation_id"
    AND "user_id" = "p_user_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  /*
   * Conversation row lock을 잡은 상태에서 현재 최대 sequence_number의 다음 값을
   * 계산하여 동일 Conversation 내 메시지 순서를 직렬화합니다.
   */
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

  /*
   * Message가 추가되면 Conversation 자체도 최근 활동 대상으로 갱신합니다.
   */
  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "p_conversation_id";

  RETURN "v_user_message_id";
END;
$$;

/*
 * 기존 User Message를 수정하고 그 이후 대화 history를 잘라냅니다.
 *
 * 중간 질문을 수정하면 그 질문 이후의 Assistant/User Message는 더 이상
 * 새 질문 내용과 일관되지 않으므로 모두 삭제합니다.
 * quota / Claim 선점은 이 RPC 밖에서 별도로 처리합니다.
 */
CREATE OR REPLACE FUNCTION "public"."update_note_chat_user_message"(
  "p_user_id" "uuid",
  "p_message_id" "uuid",
  "p_content" "jsonb"
)
RETURNS TABLE ("user_message_id" "uuid", "conversation_id" "uuid")
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_conversation_id" "uuid";
  "v_sequence_number" integer;
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

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

  /*
   * 수정 대상 message와 conversation을 함께 잠급니다.
   * 이후 메시지 삭제, target message 수정, conversation updated_at 갱신이
   * 하나의 대화 history 절단 작업으로 원자적으로 처리되어야 하기 때문입니다.
   */
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

  /*
   * 수정 대상 이후에 생성된 모든 메시지는 이전 질문 내용을 기반으로 한 결과이므로
   * sequence_number 기준으로 제거합니다.
   */
  DELETE FROM "public"."note_chat_messages" AS "messages"
  WHERE "messages"."conversation_id" = "v_conversation_id"
    AND "messages"."sequence_number" > "v_sequence_number";

  UPDATE "public"."note_chat_messages"
  SET
    "content" = "p_content",
    "updated_at" = "v_now"
  WHERE "id" = "p_message_id";

  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "v_conversation_id";

  RETURN QUERY SELECT "p_message_id", "v_conversation_id";
END;
$$;

/*
 * 이전 구현은 질문 생성 RPC가 quota / Run 생성까지 함께 담당했습니다.
 * 새 구조에서는 Claim / Run / Message 책임을 분리했으므로 구 시그니처를 제거합니다.
 */
DROP FUNCTION IF EXISTS "public"."create_note_chat_question"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
);

DROP FUNCTION IF EXISTS "public"."update_note_chat_user_message"(
  "uuid",
  "uuid",
  "jsonb",
  integer,
  "uuid",
  "uuid",
  "uuid",
  "uuid"
);


/* ============================================================================
 * Assistant Message Persistence
 * ========================================================================== */

/*
 * Assistant Message INSERT의 실제 저장 로직을 담당하는 내부 helper입니다.
 *
 * 이 함수는 complete_note_chat_execution_success()에서 재사용하기 위해 유지하지만,
 * 애플리케이션이 직접 호출해서는 안 됩니다.
 *
 * Assistant Message만 독립적으로 저장하면 Claim이 running으로 남을 수 있으므로
 * 외부 성공 경로는 반드시 complete_note_chat_execution_success()를 통해
 * Message 저장과 Claim succeeded 전환을 함께 확정해야 합니다.
 */
CREATE OR REPLACE FUNCTION "public"."create_note_chat_assistant_message"(
  "p_user_id" "uuid",
  "p_user_message_id" "uuid",
  "p_content" "jsonb"
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_conversation_id" "uuid";
  "v_next_sequence_number" integer;
  "v_assistant_message_id" "uuid";
  "v_now" timestamp with time zone := clock_timestamp();
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF "p_user_message_id" IS NULL THEN
    RAISE EXCEPTION 'user_message_id is required';
  END IF;

  IF "p_content" IS NULL OR jsonb_typeof("p_content") <> 'object' THEN
    RAISE EXCEPTION 'content must be a JSON object';
  END IF;

  /*
   * 대상 User Message의 소유권을 검증하고 관련 Conversation을 잠급니다.
   * 이후 sequence_number 계산과 INSERT를 같은 lock 범위에서 처리하여
   * 동일 Conversation의 메시지 순서가 충돌하지 않도록 합니다.
   */
  SELECT "messages"."conversation_id"
  INTO "v_conversation_id"
  FROM "public"."note_chat_messages" AS "messages"
  JOIN "public"."note_chat_conversations" AS "conversations"
    ON "conversations"."id" = "messages"."conversation_id"
  WHERE "messages"."id" = "p_user_message_id"
    AND "messages"."role" = 'user'
    AND "conversations"."user_id" = "p_user_id"
  FOR UPDATE OF "messages", "conversations";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user message not found';
  END IF;

  /*
   * Conversation row lock을 명시적으로 유지해 Assistant Message append와
   * Conversation updated_at 갱신을 같은 직렬화 경계 안에서 처리합니다.
   */
  PERFORM 1
  FROM "public"."note_chat_conversations"
  WHERE "id" = "v_conversation_id"
  FOR UPDATE;

  /*
   * 현재 Conversation의 마지막 Message 다음 sequence_number를 계산합니다.
   */
  SELECT COALESCE(MAX("messages"."sequence_number"), 0) + 1
  INTO "v_next_sequence_number"
  FROM "public"."note_chat_messages" AS "messages"
  WHERE "messages"."conversation_id" = "v_conversation_id";

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

  UPDATE "public"."note_chat_conversations"
  SET "updated_at" = "v_now"
  WHERE "id" = "v_conversation_id";

  RETURN "v_assistant_message_id";
END;
$$;

/*
 * Note Chat의 기능적 성공을 하나의 transaction으로 확정합니다.
 *
 * Assistant Message 저장과 Claim의 running -> succeeded 전환을 별도
 * transaction으로 처리하면, Message는 저장됐지만 Claim은 running으로 남는
 * 불일치가 발생할 수 있습니다.
 *
 * 따라서 두 변경을 이 RPC 안에서 함께 처리합니다. Claim 전환이 실패하면
 * 예외로 인해 앞서 생성한 Assistant Message도 함께 rollback됩니다.
 *
 * Run은 실행 제어가 아닌 감사 기록이므로 이 transaction에 포함하지 않습니다.
 * Run 성공 기록은 애플리케이션에서 별도 best-effort로 처리합니다.
 */
CREATE OR REPLACE FUNCTION "public"."complete_note_chat_execution_success"(
  "p_user_id" "uuid",
  "p_claim_id" "uuid",
  "p_user_message_id" "uuid",
  "p_content" "jsonb"
)
RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  "v_claim_conversation_id" "uuid";
  "v_message_conversation_id" "uuid";
  "v_assistant_message_id" "uuid";
  "v_completed_claim_id" "uuid";
BEGIN
  IF "p_user_id" IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF "p_claim_id" IS NULL THEN
    RAISE EXCEPTION 'claim_id is required';
  END IF;

  IF "p_user_message_id" IS NULL THEN
    RAISE EXCEPTION 'user_message_id is required';
  END IF;

  /*
   * Claim이 현재 사용자의 running 실행인지 먼저 확인합니다.
   * 이후 user_message가 이 Claim과 같은 conversation에 속하는지도 검증하여
   * 서로 다른 실행의 Claim과 Message가 잘못 결합되는 것을 막습니다.
   */
  SELECT "claims"."conversation_id"
  INTO "v_claim_conversation_id"
  FROM "public"."note_chat_execution_claims" AS "claims"
  WHERE "claims"."id" = "p_claim_id"
    AND "claims"."user_id" = "p_user_id"
    AND "claims"."status" = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'running execution claim not found';
  END IF;

  /*
   * User Message가 Claim과 같은 Conversation에 속하는지 확인합니다.
   * Claim의 user_id는 위에서 이미 검증했고, 실제 Message 저장 helper에서도
   * Conversation 소유권을 다시 확인합니다.
   */
  SELECT "messages"."conversation_id"
  INTO "v_message_conversation_id"
  FROM "public"."note_chat_messages" AS "messages"
  WHERE "messages"."id" = "p_user_message_id"
    AND "messages"."role" = 'user';

  IF "v_message_conversation_id" IS NULL
    OR "v_message_conversation_id" <> "v_claim_conversation_id" THEN
    RAISE EXCEPTION 'claim does not match user message conversation';
  END IF;

  /*
   * 기존 Assistant Message 저장 로직을 재사용합니다.
   * PostgreSQL 함수 호출은 별도 transaction을 만들지 않으므로,
   * 아래 Claim 상태 전환과 같은 transaction 안에서 실행됩니다.
   */
  "v_assistant_message_id" := "public"."create_note_chat_assistant_message"(
    "p_user_id",
    "p_user_message_id",
    "p_content"
  );

   /*
   * 성공을 확정하면서 active conversation Claim을 해제합니다.
   *
   * 그 사이 Claim이 stale 등 다른 상태로 바뀌었다면 UPDATE 결과가 0건이 되고
   * 아래에서 예외를 발생시킵니다. 그러면 Assistant Message INSERT도 함께
   * rollback되어 기능 결과와 실행 제어 상태가 서로 어긋나지 않습니다.
   */
  UPDATE "public"."note_chat_execution_claims"
  SET
    "status" = 'succeeded',
    "completed_at" = clock_timestamp()
  WHERE "id" = "p_claim_id"
    AND "status" = 'running'
  RETURNING "id" INTO "v_completed_claim_id";

  IF "v_completed_claim_id" IS NULL THEN
    RAISE EXCEPTION 'running execution claim not found';
  END IF;

  RETURN "v_assistant_message_id";
END;
$$;

/*
 * 기존 완료 RPC는 Assistant Message 생성과 Run 감사 기록을 한 transaction에
 * 묶었습니다. 이제 Assistant Message는 기능 결과 저장 RPC가 담당하고,
 * Run은 best-effort 감사 기록으로 애플리케이션에서 갱신하므로 제거합니다.
 */
DROP FUNCTION IF EXISTS "public"."complete_note_chat_run_success"(
  "uuid",
  "jsonb",
  "jsonb",
  "jsonb"
);

DROP FUNCTION IF EXISTS "public"."complete_note_chat_run_failure"(
  "uuid",
  "jsonb"
);


/* ============================================================================
 * Admin Run Views
 * ============================================================================
 *
 * 관리자 화면에서 한 번의 Note Chat Run과 관련 사용자/Conversation/Prompt/Model/
 * Message 정보를 한 번에 조회할 수 있도록 감사용 상세 View를 다시 구성합니다.
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
  "runs"."query_expansion_usage",
  "runs"."query_embedding_usage",
  "runs"."answer_generation_usage",
  "runs"."query_expansion_cost_usd",
  "runs"."query_embedding_cost_usd",
  "runs"."answer_generation_cost_usd",
  "runs"."total_cost_usd",
  "runs"."failure_message",
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

/*
 * 관리자 Run 상세 View는 일반 클라이언트에 노출하지 않고
 * 서버의 service_role 조회만 허용합니다.
 */
REVOKE ALL ON TABLE "public"."admin_note_chat_run_detail"
FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."admin_note_chat_run_detail"
TO "service_role";

/*
 * Claim 테이블 직접 쓰기는 service_role에만 허용합니다.
 * authenticated 사용자는 RLS 정책을 통해 자신의 Claim을 SELECT만 할 수 있습니다.
 */
REVOKE ALL ON TABLE "public"."note_chat_execution_claims"
  FROM anon, authenticated;
GRANT SELECT ON TABLE "public"."note_chat_execution_claims"
  TO authenticated;
GRANT ALL ON TABLE "public"."note_chat_execution_claims"
  TO service_role;

/*
 * 실행 선점과 quota 판정은 클라이언트가 임의 호출/조작하지 못하도록
 * 서버(service_role)에서만 실행할 수 있게 제한합니다.
 */
REVOKE ALL ON FUNCTION "public"."claim_note_chat_execution"(
  "uuid",
  "uuid",
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."claim_note_chat_execution"(
  "uuid",
  "uuid",
  integer
) TO service_role;

/*
 * Note Chat 일일 사용량은 현재 로그인한 사용자가 자신의 사용량을
 * 화면에서 확인하기 위한 조회 RPC이므로 authenticated에만 허용합니다.
 *
 * 함수 내부에서 auth.uid()를 사용해 조회 대상을 현재 사용자로 고정합니다.
 */
REVOKE ALL ON FUNCTION "public"."get_note_chat_daily_usage"()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "public"."get_note_chat_daily_usage"()
TO authenticated;

/*
 * 실패/stale Claim 종료 역시 서버의 실행 lifecycle 코드에서만 수행합니다.
 */
REVOKE ALL ON FUNCTION "public"."complete_note_chat_execution_claim"(
  "uuid",
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."complete_note_chat_execution_claim"(
  "uuid",
  text
) TO service_role;

REVOKE ALL ON FUNCTION "public"."create_note_chat_question"(
  "uuid",
  "uuid",
  "jsonb"
) FROM PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."create_note_chat_question"(
  "uuid",
  "uuid",
  "jsonb"
) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid",
  "uuid",
  "jsonb"
) FROM PUBLIC, "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."update_note_chat_user_message"(
  "uuid",
  "uuid",
  "jsonb"
) TO "service_role";

/*
 * Assistant Message 단독 저장은 외부 RPC 경로로 허용하지 않습니다.
 *
 * 성공 실행은 Message 저장과 Claim succeeded 전환이 원자적으로 완료되어야 하므로
 * 애플리케이션은 complete_note_chat_execution_success()만 호출합니다.
 *
 * 이 helper는 complete_note_chat_execution_success() 내부에서만 재사용합니다.
 */
REVOKE ALL ON FUNCTION "public"."create_note_chat_assistant_message"(
  "uuid",
  "uuid",
  "jsonb"
) FROM PUBLIC, "anon", "authenticated", "service_role";

/*
 * Note Chat 성공 확정의 유일한 외부 RPC입니다.
 * 서버 코드만 호출할 수 있도록 service_role에만 EXECUTE 권한을 부여합니다.
 */
REVOKE ALL ON FUNCTION "public"."complete_note_chat_execution_success"(
  "uuid",
  "uuid",
  "uuid",
  "jsonb"
) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."complete_note_chat_execution_success"(
  "uuid",
  "uuid",
  "uuid",
  "jsonb"
) TO "service_role";

/*
 * 아래 COMMENT 문은 DB schema introspection / 관리자 도구에서도
 * 각 객체의 역할을 확인할 수 있도록 메타데이터 설명을 남깁니다.
 */
COMMENT ON TABLE "public"."note_chat_execution_claims" IS
  'Note Chat conversation 단위 중복 실행 방지와 일일 제한을 위한 기능 제어 claim입니다. 실행 상세 기록은 note_chat_runs에 별도로 저장합니다.';

COMMENT ON COLUMN "public"."note_chat_runs"."query_expansion_usage" IS
  'Query Expansion Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."note_chat_runs"."query_embedding_usage" IS
  'Note 검색 질의 embedding Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."note_chat_runs"."answer_generation_usage" IS
  'Answer Generation Provider 호출의 token usage snapshot';

COMMENT ON COLUMN "public"."note_chat_runs"."total_cost_usd" IS
  '계산 가능한 단계별 estimated cost를 합산한 총 USD 비용';

COMMENT ON COLUMN "public"."note_chat_runs"."failure_message" IS
  'failed 상태로 완료된 실행의 실패 메시지';

COMMENT ON FUNCTION "public"."claim_note_chat_execution"(
  "uuid",
  "uuid",
  integer
) IS
  'Note Chat 실행 시작을 conversation 단위로 claim합니다. run 기록 테이블에 의존하지 않고 duplicate와 daily limit을 판정합니다.';

COMMENT ON FUNCTION "public"."complete_note_chat_execution_claim"(
  "uuid",
  text
) IS
  '실패하거나 만료된 running Note Chat execution claim을 failed 또는 stale로 종료합니다. 성공 완료는 complete_note_chat_execution_success에서 처리합니다.';

COMMENT ON FUNCTION "public"."create_note_chat_assistant_message"(
  "uuid",
  "uuid",
  "jsonb"
) IS
  'Note Chat Assistant Message 저장 내부 helper입니다. 외부 성공 경로에서는 직접 호출하지 않고 complete_note_chat_execution_success에서 Claim 성공 전환과 함께 사용합니다.';

COMMENT ON FUNCTION "public"."complete_note_chat_execution_success"(
  "uuid",
  "uuid",
  "uuid",
  "jsonb"
) IS
  'Note Chat 실행 성공을 Assistant Message 저장과 Claim succeeded 전환을 하나의 transaction으로 확정합니다. Run 감사 기록은 별도 best-effort 경로에서 처리합니다.';

COMMENT ON FUNCTION "public"."get_note_chat_daily_usage"() IS
  '현재 인증 사용자의 KST 기준 Note Chat 일일 사용량을 execution claim에서 조회합니다.';

COMMIT;
