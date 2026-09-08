/*
 * Related Notes 추천 quota 정책값은 TypeScript 상수에서 주입받고,
 * DB 함수들은 전달받은 동일한 Note/User 한도를 원자적으로 적용합니다.
 *
 * stale Claim을 갱신하는 모든 경로는 날짜와 무관한 사용자 단위 advisory lock을
 * 먼저 획득하여 자정 경계에서도 같은 사용자의 Claim 갱신을 직렬화합니다.
 */

CREATE FUNCTION "public"."claim_related_note_recommendation_execution_v2"(
  "p_user_id" "uuid",
  "p_note_id" "uuid",
  "p_source_updated_at" timestamp with time zone,
  "p_note_daily_recommendation_limit" integer,
  "p_user_daily_recommendation_limit" integer
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

  IF "p_note_daily_recommendation_limit" IS NULL
     OR "p_note_daily_recommendation_limit" < 1 THEN
    RAISE EXCEPTION 'note daily recommendation limit must be positive';
  END IF;

  IF "p_user_daily_recommendation_limit" IS NULL
     OR "p_user_daily_recommendation_limit" < 1 THEN
    RAISE EXCEPTION 'user daily recommendation limit must be positive';
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

  -- 일일 범위는 KST 날짜를 기준으로 계산합니다.
  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;

  /*
   * 날짜가 바뀌어도 사용자 전체 stale 정리 범위는 같으므로,
   * 날짜를 포함하지 않은 사용자 lock으로 모든 Claim 갱신을 직렬화합니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "p_user_id"::text || '|related-notes-execution',
      0
    )
  );

  -- 같은 Note version의 duplicate 판정을 사용자 lock 안에서 직렬화합니다.
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
   * advisory lock 이후 Note 행을 잠그고 소유권과 source version을 검증합니다.
   * Claim INSERT까지 FOR SHARE를 유지하여 검증한 source snapshot을 보호합니다.
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

  -- 사용자 전체에서 3분을 초과한 running Claim을 먼저 stale로 종료합니다.
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

    -- 현재 Note의 running/succeeded Claim이 Note 한도를 소비합니다.
    SELECT count(*)
    INTO "v_note_daily_count"
    FROM "public"."related_note_recommendation_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."note_id" = "p_note_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running', 'succeeded');

    IF "v_note_daily_count" >= "p_note_daily_recommendation_limit" THEN
      RETURN QUERY SELECT 'daily_limit_exceeded'::text, NULL::"uuid";
      RETURN;
    END IF;

    -- 사용자의 모든 Note에서 running/succeeded Claim이 사용자 한도를 소비합니다.
    SELECT count(*)
    INTO "v_user_daily_count"
    FROM "public"."related_note_recommendation_execution_claims" AS "claims"
    WHERE "claims"."user_id" = "p_user_id"
      AND "claims"."claimed_at" >= "v_daily_start_at"
      AND "claims"."claimed_at" < "v_daily_end_at"
      AND "claims"."status" IN ('running', 'succeeded');

    IF "v_user_daily_count" >= "p_user_daily_recommendation_limit" THEN
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

/*
 * 구 앱이 사용하는 기존 Claim signature를 유지합니다.
 * Note 한도는 기존 인자를 전달하고 사용자 전체 한도는 기존 정책값 10을 적용합니다.
 */
CREATE OR REPLACE FUNCTION "public"."claim_related_note_recommendation_execution"(
  "p_user_id" "uuid",
  "p_note_id" "uuid",
  "p_source_updated_at" timestamp with time zone,
  "p_daily_recommendation_limit" integer
)
RETURNS TABLE ("status" text, "claim_id" "uuid")
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM "public"."claim_related_note_recommendation_execution_v2"(
    "p_user_id",
    "p_note_id",
    "p_source_updated_at",
    "p_daily_recommendation_limit",
    10
  );
$$;

CREATE OR REPLACE FUNCTION "public"."cleanup_related_note_recommendation_stale_execution_claims"(
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
  "v_cleaned_count" integer;
BEGIN
  -- 인증 여부와 필수 입력을 먼저 검증합니다.
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF "p_note_id" IS NULL THEN
    RAISE EXCEPTION 'note_id is required';
  END IF;

  -- Claim과 quota 경로가 사용하는 동일한 사용자 lock을 먼저 획득합니다.
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "v_user_id"::text || '|related-notes-execution',
      0
    )
  );

  -- 현재 사용자가 소유한 Note에 대해서만 cleanup을 허용합니다.
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."notes" AS "notes"
    WHERE "notes"."id" = "p_note_id"
      AND "notes"."user_id" = "v_user_id"
  ) THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- 조회 중인 Note에서 3분을 초과한 running Claim만 stale로 종료합니다.
  UPDATE "public"."related_note_recommendation_execution_claims" AS "claims"
  SET
    "status" = 'stale',
    "completed_at" = "v_now"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."note_id" = "p_note_id"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  GET DIAGNOSTICS "v_cleaned_count" = ROW_COUNT;

  RETURN "v_cleaned_count";
END;
$$;

CREATE FUNCTION "public"."get_related_note_recommendation_daily_usage_v2"(
  "p_note_id" "uuid",
  "p_note_daily_recommendation_limit" integer,
  "p_user_daily_recommendation_limit" integer
)
RETURNS TABLE (
  "can_request_for_note" boolean,
  "is_note_limit_reached" boolean,
  "is_user_limit_reached" boolean,
  "note_limit" integer,
  "user_used" integer,
  "user_limit" integer
)
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
  "v_note_daily_count" integer;
  "v_user_daily_count" integer;
  "v_is_note_limit_reached" boolean;
  "v_is_user_limit_reached" boolean;
BEGIN
  -- 인증 여부와 필수 입력 및 quota 정책값을 먼저 검증합니다.
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF "p_note_id" IS NULL THEN
    RAISE EXCEPTION 'note_id is required';
  END IF;

  IF "p_note_daily_recommendation_limit" IS NULL
     OR "p_note_daily_recommendation_limit" < 1 THEN
    RAISE EXCEPTION 'note daily recommendation limit must be positive';
  END IF;

  IF "p_user_daily_recommendation_limit" IS NULL
     OR "p_user_daily_recommendation_limit" < 1 THEN
    RAISE EXCEPTION 'user daily recommendation limit must be positive';
  END IF;

  -- Claim과 cleanup 경로가 사용하는 동일한 사용자 lock을 먼저 획득합니다.
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "v_user_id"::text || '|related-notes-execution',
      0
    )
  );

  -- quota 조회는 Note 행을 잠그지 않고 소유권만 검증합니다.
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."notes" AS "notes"
    WHERE "notes"."id" = "p_note_id"
      AND "notes"."user_id" = "v_user_id"
  ) THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- Claim RPC와 동일한 KST 날짜 범위를 계산합니다.
  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
  "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
  "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

  -- 사용자 전체에서 3분을 초과한 running Claim을 먼저 stale로 종료합니다.
  UPDATE "public"."related_note_recommendation_execution_claims" AS "claims"
  SET
    "status" = 'stale',
    "completed_at" = "v_now"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  -- 오늘의 running/succeeded Claim을 Note 및 사용자 범위로 함께 집계합니다.
  SELECT
    count(*) FILTER (WHERE "claims"."note_id" = "p_note_id"),
    count(*)
  INTO
    "v_note_daily_count",
    "v_user_daily_count"
  FROM "public"."related_note_recommendation_execution_claims" AS "claims"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."claimed_at" >= "v_daily_start_at"
    AND "claims"."claimed_at" < "v_daily_end_at"
    AND "claims"."status" IN ('running', 'succeeded');

  -- UI가 동일한 서버 판정 결과를 사용하도록 한도별 도달 상태를 명시합니다.
  "v_is_note_limit_reached" :=
    "v_note_daily_count" >= "p_note_daily_recommendation_limit";
  "v_is_user_limit_reached" :=
    "v_user_daily_count" >= "p_user_daily_recommendation_limit";

  RETURN QUERY SELECT
    NOT "v_is_note_limit_reached" AND NOT "v_is_user_limit_reached",
    "v_is_note_limit_reached",
    "v_is_user_limit_reached",
    "p_note_daily_recommendation_limit",
    "v_user_daily_count",
    "p_user_daily_recommendation_limit";
END;
$$;

/*
 * 구 앱이 사용하는 기존 quota signature와 두 필드 반환 계약을 유지합니다.
 * 기존 정책값인 Note 1회, 사용자 전체 10회를 v2에 전달합니다.
 */
CREATE OR REPLACE FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "p_note_id" "uuid"
)
RETURNS TABLE (
  "can_request_for_note" boolean,
  "user_used" integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    "quota"."can_request_for_note",
    "quota"."user_used"
  FROM "public"."get_related_note_recommendation_daily_usage_v2"(
    "p_note_id",
    1,
    10
  ) AS "quota";
$$;

REVOKE ALL ON FUNCTION "public"."claim_related_note_recommendation_execution_v2"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer,
  integer
) FROM PUBLIC, anon, authenticated;

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

GRANT EXECUTE ON FUNCTION "public"."claim_related_note_recommendation_execution_v2"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer,
  integer
) TO service_role;

REVOKE ALL ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage"("uuid")
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage"("uuid")
TO authenticated;

REVOKE ALL ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage_v2"("uuid", integer, integer)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage_v2"("uuid", integer, integer)
TO authenticated;

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_execution_v2"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer,
  integer
) IS
  'Related Notes 추천 실행을 claim하며 주입된 Note/User 일일 quota, source version 중복 및 stale 상태를 사용자 단위 lock에서 판정합니다.';

COMMENT ON FUNCTION "public"."claim_related_note_recommendation_execution"(
  "uuid",
  "uuid",
  timestamp with time zone,
  integer
) IS
  '구 앱 호환용 Related Notes Claim wrapper이며 기존 Note 한도와 사용자 전체 기본 한도 10을 v2 RPC에 전달합니다.';

COMMENT ON FUNCTION "public"."cleanup_related_note_recommendation_stale_execution_claims"(
  "uuid"
) IS
  '현재 인증 사용자의 특정 Note에서 만료된 running Claim을 사용자 단위 lock 안에서 stale로 정리합니다.';

COMMENT ON FUNCTION "public"."get_related_note_recommendation_daily_usage_v2"(
  "uuid",
  integer,
  integer
) IS
  '현재 인증 사용자의 만료된 running Claim을 정리하고 주입된 Note/User 한도에 대한 요청 가능 여부, 도달 상태와 사용량을 반환합니다.';

COMMENT ON FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "uuid"
) IS
  '구 앱 호환용 Related Notes quota wrapper이며 기존 Note 1회/User 10회 정책과 두 필드 반환 계약을 유지합니다.';
