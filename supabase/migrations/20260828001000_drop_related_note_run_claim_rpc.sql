-- Drop Related Note Recommendation Run Claim RPC
--
-- run 기록 테이블은 실행 이력 저장만 담당해야 하므로,
-- related_note_recommendation_runs를 기능 제어에 사용하던 기존 claim RPC를 제거합니다.

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
