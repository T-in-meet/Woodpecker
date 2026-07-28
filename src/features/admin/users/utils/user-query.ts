import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PostgREST ilike 패턴에서 와일드카드로 해석되는 문자를 이스케이프합니다.
 *
 * `%`와 `_`가 검색 와일드카드로 동작하지 않고
 * 사용자가 입력한 문자 자체로 검색되도록 변환합니다.
 *
 * @param value 검색에 사용할 원본 문자열
 * @returns PostgREST ilike 조건에 안전하게 사용할 문자열
 */
export function escapePostgrestLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

/**
 * 날짜 범위 필터의 시작일을 해당 일자의 00:00 ISO 문자열로 변환합니다.
 *
 * @param value 변환할 날짜
 * @returns 해당 일자의 시작 시각을 나타내는 ISO 문자열
 */
export function startOfDayIsoString(value: Date | string): string {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

/**
 * 날짜 범위 필터의 종료일을 다음 날 00:00 ISO 문자열로 변환합니다.
 *
 * 종료일 전체를 포함하기 위해 `created_at < 다음 날 00:00` 조건에 사용합니다.
 *
 * @param value 변환할 종료 날짜
 * @returns 다음 날의 시작 시각을 나타내는 ISO 문자열
 */
export function nextDayIsoString(value: Date | string): string {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);

  return date.toISOString();
}

/**
 * 관리자 사용자 목록 조회에 사용하는 기본 Supabase Query를 생성합니다.
 *
 * admin_user_list View 목록 조회에서 사용하는 QueryBuilder 타입을
 * filter/sort 유틸과 동일하게 유지하기 위해 공통으로 사용합니다.
 *
 * @param supabase 관리자 Supabase Client
 * @returns 관리자 사용자 목록 조회 QueryBuilder
 */
export function createAdminUserListQuery(
  supabase: ReturnType<typeof createAdminClient>,
) {
  return supabase
    .from("admin_user_list")
    .select(
      "id, nickname, avatar_url, canonical_email, role, signup_method, agreement_status, created_at",
      { count: "exact" },
    );
}

/**
 * 관리자 사용자 목록 조회에 사용하는 Supabase QueryBuilder 타입입니다.
 */
export type AdminUserListQueryBuilder = ReturnType<
  typeof createAdminUserListQuery
>;
