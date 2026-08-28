-- Add Related Note Recommendation Execution Claims
--
-- Related Notes 추천 실행 제어를 실행 기록 테이블에서 분리합니다.
-- related_note_recommendation_runs는 관측/감사용 기록만 담당하고,
-- 중복 실행 방지와 일일 제한은 이 claim 테이블과 RPC가 담당합니다.

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

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_pkey"
  PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."related_note_recommendation_execution_claims"
  ADD CONSTRAINT "related_note_recommendation_execution_claims_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "related_note_recommendation_execution_claims_active_uidx"
  ON "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "note_id",
    "source_updated_at"
  )
  WHERE "status" IN ('running'::text, 'succeeded'::text);

CREATE INDEX "related_note_recommendation_execution_claims_user_claimed_idx"
  ON "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "claimed_at" DESC
  );

CREATE INDEX "related_note_recommendation_execution_claims_status_claimed_idx"
  ON "public"."related_note_recommendation_execution_claims" (
    "status",
    "claimed_at" DESC
  );

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

ALTER TABLE "public"."related_note_recommendation_execution_claims"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "related_note_recommendation_execution_claims_select_own"
  ON "public"."related_note_recommendation_execution_claims"
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = "user_id");

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

REVOKE ALL ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) TO service_role;

COMMENT ON TABLE "public"."related_note_recommendation_execution_claims" IS
  'Related Notes 추천의 중복 실행 방지와 일일 제한을 위한 기능 제어 claim입니다. 실행 상세 기록은 related_note_recommendation_runs에 별도로 저장합니다.';

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) IS
  'Related Notes 추천 실행 시작을 claim합니다. run 기록 테이블에 의존하지 않고 stale, duplicate, daily limit을 판정합니다.';

COMMENT ON FUNCTION "public"."complete_related_note_recommendation_execution_claim"(
  "uuid",
  text
) IS
  'running 상태의 Related Notes 추천 실행 claim을 최종 상태로 완료합니다.';
