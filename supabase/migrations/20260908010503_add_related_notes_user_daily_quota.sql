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

COMMENT ON INDEX
  "public"."related_note_recommendation_execution_claims_user_claimed_idx" IS
  'Related Notes 사용자 전체 일일 quota의 claimed_at 범위 조회를 지원하는 인덱스';
