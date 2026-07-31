import type {
  AdminUserListItem,
  UserAgreementStatus,
  UserRole,
  UserSignupMethod,
} from "../types/user-list";

/**
 * admin_user_list View에서 조회한 사용자 row입니다.
 *
 * Supabase가 View 컬럼을 nullable 타입으로 생성하므로
 * 실제 목록 모델로 변환하기 전에 필수 값을 확인합니다.
 */
export type AdminUserListRow = {
  id: string | null;
  nickname: string | null;
  avatar_url: string | null;
  canonical_email: string | null;
  role: string | null;
  signup_method: string | null;
  agreement_status: string | null;
  created_at: string | null;
};

/**
 * admin_user_list View 조회 결과를 관리자 사용자 목록 표시 모델로 변환합니다.
 *
 * @param rows admin_user_list View에서 조회한 row 목록
 * @returns 관리자 사용자 목록 테이블에서 사용하는 표시 모델
 */
export function mapUserRows(
  rows: readonly AdminUserListRow[],
): AdminUserListItem[] {
  return rows.map(mapUserRow);
}

/**
 * admin_user_list View의 단일 row를 관리자 사용자 목록 표시 모델로 변환합니다.
 */
function mapUserRow(row: AdminUserListRow): AdminUserListItem {
  if (
    !row.id ||
    !row.nickname ||
    !row.role ||
    !row.agreement_status ||
    !row.created_at
  ) {
    throw new Error("Admin user list row contains missing required values.");
  }

  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    email: row.canonical_email,
    role: row.role as UserRole,
    signupMethod: (row.signup_method ?? "UNKNOWN") as UserSignupMethod,
    agreementStatus: row.agreement_status as UserAgreementStatus,
    createdAt: row.created_at,
  };
}
