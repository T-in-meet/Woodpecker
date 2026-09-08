/*
 * 기존 Note 단위 정수 사용량 RPC를 Note 요청 가능 여부와 사용자 전체 사용량을
 * 함께 반환하는 quota 조회 RPC로 교체합니다.
 */
DROP FUNCTION "public"."get_related_note_recommendation_daily_usage"("uuid");

/*
 * 현재 인증 사용자의 Related Notes 일일 quota 상태를 조회합니다.
 *
 * Claim RPC와 동일한 사용자 + KST 날짜 advisory lock을 사용하고, 집계 전에
 * 사용자의 모든 Note에 남은 만료 running Claim을 stale로 정리합니다.
 */
CREATE FUNCTION "public"."get_related_note_recommendation_daily_usage"(
  "p_note_id" "uuid"
)
RETURNS TABLE (
  "can_request_for_note" boolean,
  "user_used" integer
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
  "v_note_daily_limit" constant integer := 1;
  "v_user_daily_limit" constant integer := 10;
BEGIN
  -- 인증 여부와 필수 입력을 먼저 검증합니다.
  IF "v_user_id" IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF "p_note_id" IS NULL THEN
    RAISE EXCEPTION 'note_id is required';
  END IF;

  /*
   * 현재 사용자가 소유한 Note만 quota를 조회할 수 있게 하고, 조회 transaction이
   * 끝날 때까지 Note 삭제 또는 소유권 관련 변경과 결과가 엇갈리지 않게 합니다.
   */
  PERFORM "notes"."id"
  FROM "public"."notes" AS "notes"
  WHERE "notes"."id" = "p_note_id"
    AND "notes"."user_id" = "v_user_id"
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'note not found';
  END IF;

  -- Claim RPC와 동일한 KST 날짜 범위를 계산합니다.
  "v_kst_date" := ("v_now" AT TIME ZONE 'Asia/Seoul')::date;
  "v_daily_start_at" := "v_kst_date"::timestamp AT TIME ZONE 'Asia/Seoul';
  "v_daily_end_at" := "v_daily_start_at" + interval '1 day';

  /*
   * Claim RPC와 같은 사용자 + KST 날짜 lock으로 stale 정리, quota 집계 및
   * 동시 Claim INSERT를 하나의 직렬화 경계에 둡니다.
   */
  PERFORM "pg_advisory_xact_lock"(
    "hashtextextended"(
      "v_user_id"::text
      || '|related-notes-execution|'
      || "v_kst_date"::text,
      0
    )
  );

  /*
   * 사용자 전체 quota는 모든 Note의 running Claim을 합산하므로, 특정 Note가
   * 아니라 현재 사용자의 만료 running Claim 전체를 먼저 stale로 종료합니다.
   */
  UPDATE "public"."related_note_recommendation_execution_claims" AS "claims"
  SET
    "status" = 'stale',
    "completed_at" = "v_now"
  WHERE "claims"."user_id" = "v_user_id"
    AND "claims"."status" = 'running'
    AND "claims"."claimed_at" < "v_now" - interval '3 minutes';

  /*
   * Claim RPC와 동일하게 오늘의 running + succeeded만 집계합니다.
   * 한 번의 조회에서 현재 Note 사용량과 사용자 전체 사용량을 함께 계산합니다.
   */
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

  -- 두 quota에 모두 여유가 있을 때만 현재 Note가 새 요청을 시작할 수 있습니다.
  RETURN QUERY SELECT
    "v_note_daily_count" < "v_note_daily_limit"
      AND "v_user_daily_count" < "v_user_daily_limit",
    "v_user_daily_count";
END;
$$;

REVOKE ALL ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage"("uuid")
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage"("uuid")
TO authenticated;

COMMENT ON FUNCTION
  "public"."get_related_note_recommendation_daily_usage"("uuid") IS
  '현재 인증 사용자의 만료된 Related Notes running Claim 전체를 stale로 정리한 뒤 KST 기준 현재 Note 요청 가능 여부와 사용자 전체 일일 사용량을 반환합니다.';
