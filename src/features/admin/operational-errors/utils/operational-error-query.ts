import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 관리자 운영 오류 목록 조회에 사용하는 기본 Supabase Query를 생성합니다.
 *
 * 운영 오류 목록 조회에서 사용하는 QueryBuilder 타입을
 * 필터 및 검색 유틸과 동일하게 유지하기 위해 공통으로 사용합니다.
 *
 * @param supabase 관리자 Supabase Client
 * @returns 운영 오류 목록 조회 QueryBuilder
 */
export function createOperationalErrorListQuery(
  supabase: ReturnType<typeof createAdminClient>,
) {
  return supabase
    .from("operational_errors")
    .select(
      "id, feature, operation, stage, error_code, severity, status, message, user_id, fingerprint, occurrence_count, last_seen_at, created_at",
      { count: "exact" },
    );
}

/**
 * 관리자 운영 오류 목록 QueryBuilder 타입입니다.
 */
export type OperationalErrorListQueryBuilder = ReturnType<
  typeof createOperationalErrorListQuery
>;
