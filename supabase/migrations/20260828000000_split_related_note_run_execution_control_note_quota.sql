-- Split Related Note Recommendation Execution Control from Run History
--
-- Related Notes 추천 실행에서 "기능 제어"와 "실행 기록"의 책임을 분리합니다.
--
-- 기존 구조:
--   related_note_recommendation_runs
--     - 실행 이력 저장
--     - 중복 실행 방지
--     - Note 단위 일일 실행 제한
--
-- 변경 후:
--   related_note_recommendation_execution_claims
--     - 중복 실행 방지
--     - 일일 실행 제한
--     - 실행 중(running) / 완료 상태 관리
--
--   related_note_recommendation_runs
--     - 실행 상세 이력과 관측/감사 정보만 저장
--
-- 이 migration은 다음 작업을 하나의 배포 단위로 수행합니다.
--
--   1. execution claim 테이블과 인덱스 생성
--   2. 기존 Run의 실행 제어 상태를 Claim으로 이관
--   3. RLS 설정
--   4. Claim 기반 실행 시작 RPC 생성
--   5. Claim 기반 일일 사용량 조회 RPC 생성
--   6. Claim 기반 실행 완료 RPC 생성
--   7. 권한 설정
--   8. 더 이상 사용하지 않는 기존 Run 기반 claim RPC 제거

-- ============================================================================
-- 1. Execution Claim 테이블 생성
-- ============================================================================
--
-- 각 Related Notes 추천 실행이 실제로 "실행 권한을 획득했는지"를 기록합니다.
-- Run과 달리 이 테이블은 기능 제어의 정본(source of truth)입니다.
--
-- 동일 사용자 / Note / source_updated_at 조합에서 running 또는 succeeded Claim이
-- 하나만 존재하도록 하여 동일한 Note 버전에 대한 중복 실행을 방지합니다.
--
CREATE TABLE "public"."related_note_recommendation_execution_claims" (
  "id" "uuid" DEFAULT gen_random_uuid() NOT NULL,
  "user_id" "uuid" NOT NULL,
  "note_id" "uuid" NOT NULL,
  "source_updated_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'running'::text NOT NULL,
  "claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "related_note_recommendation_execution_claims_status_check"
    CHECK (
      "status" IN (
        'running'::text,
        'succeeded'::text,
        'failed'::text,
        'stale'::text
      )
    ),
  CONSTRAINT "related_note_recommendation_execution_claims_completion_check"
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

-- 기본 키와 FK를 추가합니다.
-- Note 또는 사용자(Profile)가 삭제되면 해당 실행 제어 Claim도 함께 제거됩니다.

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_pkey"
  PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

-- running/succeeded 상태만 중복 방지 대상으로 봅니다.
-- failed/stale Claim은 이후 동일 source version 재실행을 허용해야 하므로 제외합니다.
CREATE UNIQUE INDEX "related_note_recommendation_execution_claims_active_uidx"
  ON "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "note_id",
    "source_updated_at"
  )
  WHERE "status" IN ('running'::text, 'succeeded'::text);

CREATE INDEX "related_note_recommendation_execution_claims_user_note_claimed_idx"
  ON "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "note_id",
    "claimed_at" DESC
  );

CREATE INDEX "related_note_recommendation_execution_claims_status_claimed_idx"
  ON "public"."related_note_recommendation_execution_claims" (
    "status",
    "claimed_at" DESC
  );

-- ============================================================================
-- 2. 기존 Run 상태를 Claim으로 이관
-- ============================================================================
--
-- 배포 직후 quota와 duplicate 판정이 초기화되지 않도록,
-- 기존 Run 중 실행 제어에 필요했던 상태를 새 Claim 테이블로 복사합니다.
--
/*
 * 이 마이그레이션 이전에는 related_note_recommendation_runs가
 * 중복 실행 방지와 일일 제한의 정본이었습니다.
 *
 * 새 execution claim 테이블을 빈 상태로 시작하면 배포 전 running/succeeded
 * Run이 중복 실행 방지와 quota 계산에서 사라지므로, 기능 제어에 필요한
 * 기존 Run 상태를 동일한 claim 형태로 이관합니다.
 *
 * source_updated_at이 없는 legacy Run은 Note version 단위 claim으로
 * 복원할 수 없으므로 이관하지 않습니다.
 */
INSERT INTO "public"."related_note_recommendation_execution_claims" (
  "user_id",
  "note_id",
  "source_updated_at",
  "status",
  "claimed_at",
  "completed_at"
)
SELECT
  "runs"."user_id",
  "runs"."note_id",
  "runs"."source_updated_at",
  "runs"."status",
  "runs"."started_at",
  "runs"."completed_at"
FROM "public"."related_note_recommendation_runs" AS "runs"
WHERE "runs"."source_updated_at" IS NOT NULL
  AND "runs"."status" IN (
    'running'::text,
    'succeeded'::text,
    'failed'::text,
    'stale'::text
  )
ORDER BY "runs"."started_at" ASC
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. RLS 설정
-- ============================================================================
--
-- authenticated 사용자는 자신의 Claim만 조회할 수 있습니다.
-- Claim 생성/완료 RPC는 service_role만 실행하도록 별도 권한을 설정합니다.

ALTER TABLE "public"."related_note_recommendation_execution_claims"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "related_note_recommendation_execution_claims_select_own"
  ON "public"."related_note_recommendation_execution_claims"
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = "user_id");

-- ============================================================================
-- 4. 실행 시작 Claim RPC
-- ============================================================================
--
-- 실행 요청 하나를 실제로 시작할 수 있는지 DB transaction 안에서 판정합니다.
--
-- 주요 책임:
--   - 사용자 / Note / source version 유효성 검증
--   - 사용자별 Note 단위 일일 quota 직렬화
--   - 동일 Note 버전 실행 직렬화
--   - 오래된 running Claim stale 처리
--   - 동일 source version의 duplicate 방지
--   - 일반 사용자 일일 실행 제한 검사
--   - 최종 running Claim 생성
--
-- advisory transaction lock을 사용하므로 동시에 여러 요청이 들어와도
-- quota count와 Claim 생성이 경쟁 상태에 빠지지 않도록 합니다.
CREATE OR REPLACE FUNCTION "public"."claim_related_note_recommendation_execution"(
  "p_user_id" "uuid",
  "p_note_id" "uuid",
  "p_source_updated_at" timestamp with time zone,
  "p_daily_recommendation_limit" integer
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

  IF NOT EXISTS (
    SELECT 1
    FROM "public"."notes" AS "notes"
    WHERE "notes"."id" = "p_note_id"
      AND "notes"."user_id" = "p_user_id"
      AND "notes"."updated_at" IS NOT DISTINCT FROM "p_source_updated_at"
  ) THEN
    RETURN QUERY SELECT 'stale'::text, NULL::"uuid";
    RETURN;
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
      || '|related-notes-execution|'
      || "p_note_id"::text
      || '|'
      || "v_kst_date"::text,
      0
    )
  );

  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|related-notes-execution|'
      || "p_note_id"::text
      || '|'
      || "p_source_updated_at"::text,
      0
    )
  );

  /*
   * background 실행 함수는 maxDuration = 90(초)로 제한되어 있어,
   * 정상 실행이라도 provider 응답 지연 등으로 강제 종료되면
   * complete_related_note_recommendation_execution_claim 호출 없이 종료될 수 있습니다.
   *
   * 90초 + 여유 버퍼를 초과한 running claim은 더 이상 실제 실행 중인 것으로
   * 신뢰하지 않고 stale로 종료하여 동일 source version을 다시 claim할 수 있게 합니다.
   *
   * maxDuration 설정이 바뀌면 이 값도 함께 조정해야 합니다.
   */
  UPDATE "public"."related_note_recommendation_execution_claims" AS "claims"
  SET
    "status" = 'stale',
    "completed_at" = "v_now"
  WHERE "claims"."user_id" = "p_user_id"
    AND "claims"."note_id" = "p_note_id"
    AND "claims"."source_updated_at" IS NOT DISTINCT FROM "p_source_updated_at"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  SELECT "claims"."id"
  INTO "v_existing_claim_id"
  FROM "public"."related_note_recommendation_execution_claims" AS "claims"
  WHERE "claims"."user_id" = "p_user_id"
    AND "claims"."note_id" = "p_note_id"
    AND "claims"."source_updated_at" IS NOT DISTINCT FROM "p_source_updated_at"
    AND "claims"."status" IN ('running', 'succeeded')
  ORDER BY "claims"."claimed_at" DESC
  LIMIT 1;

  IF "v_existing_claim_id" IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicate'::text, "v_existing_claim_id";
    RETURN;
  END IF;

  IF NOT "v_is_admin" THEN
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    SELECT count(*)
    INTO "v_daily_count"
    FROM "public"."related_note_recommendation_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."note_id" = "p_note_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running', 'succeeded');

    IF "v_daily_count" >= "p_daily_recommendation_limit" THEN
      RETURN QUERY SELECT 'daily_limit_exceeded'::text, NULL::"uuid";
      RETURN;
    END IF;
  END IF;

  INSERT INTO "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "note_id",
    "source_updated_at",
    "status",
    "claimed_at"
  )
  VALUES (
    "p_user_id",
    "p_note_id",
    "p_source_updated_at",
    'running',
    "v_now"
  )
  RETURNING "id" INTO "v_claim_id";

  RETURN QUERY SELECT 'claimed'::text, "v_claim_id";
END;
$$;

-- ============================================================================
-- 5. 일일 사용량 조회 RPC
-- ============================================================================
--
-- 현재 인증 사용자가 특정 Note에서 오늘 사용한 Related Notes AI 추천 횟수를
-- 실행 시작 Claim RPC의 일일 quota와 동일한 기준으로 조회합니다.
--
-- 일일 범위는 KST 기준이며, running/succeeded Claim만 사용량에 포함합니다.
-- failed/stale Claim은 실행 시작 Claim RPC와 동일하게 사용량에서 제외합니다.
CREATE OR REPLACE FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "p_note_id" "uuid"
)
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

  IF "p_note_id" IS NULL THEN
    RAISE EXCEPTION 'note_id is required';
  END IF;

  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
  "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
  "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

  SELECT count(*)
  INTO "v_daily_count"
  FROM "public"."related_note_recommendation_execution_claims" AS "claims"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."note_id" = "p_note_id"
    AND "claims"."claimed_at" >= "v_daily_start_at"
    AND "claims"."claimed_at" < "v_daily_end_at"
    AND "claims"."status" IN ('running', 'succeeded');

  RETURN "v_daily_count";
END;
$$;

-- ============================================================================
-- 6. 실행 완료 Claim RPC
-- ============================================================================
--
-- running Claim만 succeeded / failed / stale 중 하나의 최종 상태로 전환합니다.
-- 이미 완료된 Claim을 다시 완료하려 하면 예외를 발생시켜 상태 전이를 명확하게 유지합니다.
CREATE OR REPLACE FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
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

  IF "p_status" NOT IN ('succeeded'::text, 'failed'::text, 'stale'::text) THEN
    RAISE EXCEPTION 'execution claim completion status is invalid';
  END IF;

  UPDATE "public"."related_note_recommendation_execution_claims"
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

-- ============================================================================
-- 7. 권한 설정
-- ============================================================================
--
-- authenticated 사용자는 자신의 Claim을 SELECT만 할 수 있고,
-- 생성/상태 변경은 service_role을 통해서만 수행하도록 제한합니다.
--
-- 일일 사용량 조회 RPC는 현재 인증 사용자의 Claim만 집계하므로
-- authenticated 사용자에게 실행 권한을 부여합니다.
REVOKE ALL ON TABLE "public"."related_note_recommendation_execution_claims"
  FROM anon, authenticated;
GRANT SELECT ON TABLE "public"."related_note_recommendation_execution_claims"
  TO authenticated;
GRANT ALL ON TABLE "public"."related_note_recommendation_execution_claims"
  TO service_role;

REVOKE ALL ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) TO service_role;

REVOKE ALL ON FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "uuid"
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "uuid"
) TO authenticated;

REVOKE ALL ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) TO service_role;

COMMENT ON TABLE "public"."related_note_recommendation_execution_claims" IS
  'Related Notes 추천의 중복 실행 방지와 사용자별 Note 단위 일일 제한을 위한 기능 제어 claim입니다. 실행 상세 기록은 related_note_recommendation_runs에 별도로 저장합니다.';

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) IS
  'Related Notes 추천 실행 시작을 claim합니다. run 기록 테이블에 의존하지 않고 stale, duplicate, 사용자별 Note 단위 daily limit을 판정합니다.';

COMMENT ON FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "uuid"
) IS
  '현재 인증 사용자의 특정 Note에 대한 KST 기준 Related Notes 일일 추천 사용량을 execution claim에서 조회합니다.';

COMMENT ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) IS
  'running 상태의 Related Notes 추천 실행 claim을 최종 상태로 완료합니다.';

-- ============================================================================
-- 8. 기존 Run 기반 Claim RPC 제거
-- ============================================================================
--
-- 새 Claim 테이블과 Claim RPC가 기능 제어의 정본이 되었으므로,
-- related_note_recommendation_runs를 직접 생성하면서 quota/duplicate를 판정하던
-- 기존 claim_related_note_recommendation_run RPC는 제거합니다.
--
-- 이 함수가 남아 있으면 두 실행 제어 경로가 공존해 책임 경계가 다시 흐려질 수 있으므로
-- 새 구조 설치와 같은 migration 안에서 제거합니다.
--
DROP FUNCTION IF EXISTS "public"."claim_related_note_recommendation_run"(
  "uuid",
  "uuid",
  timestamp with time zone,
  "uuid",
  "uuid",
  "uuid",
  "uuid",
  integer
);