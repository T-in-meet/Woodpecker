/*
 * Related Notes quota/claim v2 전환이 안정화되어 legacy rollback window를 닫습니다.
 * 이 migration 이후에는 legacy RPC가 필요한 구 앱으로 단순 rollback할 수 없으며,
 * 구 앱을 다시 배포하려면 제거한 RPC 계약도 함께 복원해야 합니다.
 *
 * execution Claim 테이블과 기존 Claim 데이터, 사용자 전체 quota 인덱스,
 * cleanup/complete RPC 및 v2 RPC 권한은 그대로 유지합니다.
 */

DROP FUNCTION IF EXISTS public.claim_related_note_recommendation_execution(
  uuid,
  uuid,
  timestamptz,
  integer
);

DROP FUNCTION IF EXISTS public.get_related_note_recommendation_daily_usage(uuid);

/*
 * legacy Claim과 v2 Claim의 동시 실행을 직렬화하던 Note + KST 날짜 lock만
 * 제거합니다. 사용자 lock과 동일 source version lock을 포함한 나머지 실행,
 * quota, stale, 소유권 계약은 기존 v2 정의를 그대로 유지합니다.
 */
CREATE OR REPLACE FUNCTION "public"."claim_related_note_recommendation_execution_v2"(
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
