import { createAdminClient } from "@/lib/supabase/admin";

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
