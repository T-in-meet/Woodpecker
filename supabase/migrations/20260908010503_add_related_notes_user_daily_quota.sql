/*
 * Related Notes 추천의 사용자 전체 일일 quota를 효율적으로 집계합니다.
 *
 * 기존 user_id + note_id + claimed_at 인덱스는 Note별 quota에는 적합하지만,
 * 여러 Note에 걸친 사용자 전체 claimed_at 범위 조회에는 note_id가 중간에 있어
 * 그대로 재사용하기 어렵습니다. Note Chat과 같은 user_id + claimed_at 구조를
 * 추가하여 사용자 전체 quota와 stale 정리 경로를 지원합니다.
 */
CREATE INDEX "related_note_recommendation_execution_claims_user_claimed_idx"
  ON "public"."related_note_recommendation_execution_claims" (
    "user_id",
    "claimed_at" DESC
  );

/*
 * Related Notes 추천 실행 시작을 선점합니다.
 *
 * 기존 Note별 일일 quota와 source version 중복 실행 제어를 유지하면서,
 * KST 기준 사용자 전체 일일 10회 quota를 함께 적용합니다.
 *
 * Note Chat과 동일하게 사용자 + KST 날짜 advisory lock 아래에서 해당 사용자의
 * 만료 running Claim 전체를 먼저 stale로 정리한 뒤 quota를 계산합니다.
 */
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
  "v_note_daily_count" integer;
  "v_user_daily_count" integer;
  "v_user_daily_limit" constant integer := 10;
  "v_claim_id" "uuid";
BEGIN
  -- 필수 입력과 호출 사용자의 실행 자격을 먼저 검증합니다.
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

  -- ADMIN은 quota만 우회하고 stale 정리와 duplicate 제어는 그대로 적용합니다.
  SELECT EXISTS (
    SELECT 1
    FROM "public"."profiles" AS "profiles"
    WHERE "profiles"."id" = "p_user_id"
      AND "profiles"."role" = 'ADMIN'
  )
  INTO "v_is_admin";

  -- 모든 일일 범위와 직렬화 key는 KST 날짜를 기준으로 계산합니다.
  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;

  /*
   * Note Chat과 동일한 사용자 + KST 날짜 lock으로 사용자 전체 quota의
   * count와 Claim INSERT를 직렬화합니다. 이 lock은 기존 Note별 날짜 lock보다
   * 넓은 범위를 보호하므로 Note별 quota 경쟁 조건도 함께 방지합니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text
      || '|related-notes-execution|'
      || "v_kst_date"::text,
      0
    )
  );

  -- 기존 source version 단위 duplicate 판정을 같은 transaction에서 직렬화합니다.
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
   * Note 행을 잠근 상태에서 소유권과 source version을 검증합니다.
   *
   * advisory lock은 Claim 요청끼리만 직렬화하며 일반 Note UPDATE를 막지 못합니다.
   * 검증 후 Claim INSERT까지 FOR SHARE lock을 유지하여, 그 사이 updated_at이
   * 변경되어 이전 source version의 Claim이 생성되는 경쟁 조건을 방지합니다.
   */
  PERFORM "notes"."id"
  FROM "public"."notes" AS "notes"
  WHERE "notes"."id" = "p_note_id"
    AND "notes"."user_id" = "p_user_id"
    AND "notes"."updated_at" IS NOT DISTINCT FROM "p_source_updated_at"
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'stale'::text, NULL::"uuid";
    RETURN;
  END IF;

  /*
   * 사용자 전체 quota는 모든 Note의 running Claim을 집계하므로, 다른 Note에
   * 남은 orphan Claim도 quota를 계속 점유할 수 있습니다.
   *
   * 따라서 quota와 duplicate를 판정하기 전에 현재 사용자의 3분을 초과한
   * running Claim 전체를 source version 및 Note와 무관하게 stale로 종료합니다.
   */
  UPDATE "public"."related_note_recommendation_execution_claims" AS "claims"
  SET
    "status" = 'stale',
    "completed_at" = "v_now"
  WHERE "claims"."user_id" = "p_user_id"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  -- 같은 Note version의 유효한 실행 또는 성공 결과가 있으면 기존 Claim을 반환합니다.
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
    -- KST 자정부터 다음 자정 직전까지를 동일한 일일 quota 범위로 사용합니다.
    "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
    "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

    -- 기존 Note별 quota는 running과 succeeded Claim만 소비하도록 유지합니다.
    SELECT count(*)
    INTO "v_note_daily_count"
    FROM "public"."related_note_recommendation_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."note_id" = "p_note_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running', 'succeeded');

    IF "v_note_daily_count" >= "p_daily_recommendation_limit" THEN
      RETURN QUERY SELECT 'daily_limit_exceeded'::text, NULL::"uuid";
      RETURN;
    END IF;

    /*
     * Note Chat과 동일하게 사용자 전체의 running + succeeded Claim을 집계합니다.
     * failed와 stale은 quota를 소비하지 않으며, 사용자 전체 한도는 하루 10회입니다.
     */
    SELECT count(*)
    INTO "v_user_daily_count"
    FROM "public"."related_note_recommendation_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running', 'succeeded');

    IF "v_user_daily_count" >= "v_user_daily_limit" THEN
      RETURN QUERY SELECT 'daily_limit_exceeded'::text, NULL::"uuid";
      RETURN;
    END IF;
  END IF;

  -- 모든 실행 제어 조건을 통과한 요청만 새 running Claim을 생성합니다.
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

COMMENT ON INDEX
  "public"."related_note_recommendation_execution_claims_user_claimed_idx" IS
  'Related Notes 사용자 전체 일일 quota의 claimed_at 범위 조회를 지원하는 인덱스';

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) IS
  'Related Notes 추천 실행 시작을 claim하며 source version 중복, Note별 일일 quota, KST 기준 사용자 전체 일일 10회 quota를 판정합니다.';
