import type { AdminListToolbarFilters } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminSearchValue } from "@/features/admin/types/search";

import type { AdminSort } from "../../types/sort";

/** profiles.role DB 제약과 동일한 사용자 권한입니다. */
export type UserRole = "USER" | "ADMIN";

/** 관리자 사용자 목록에서 표시하는 가입 방법입니다. */
export type UserSignupMethod = "EMAIL" | "OAUTH";

/** 관리자 사용자 목록에서 표시하는 약관 동의 상태입니다. */
export type UserAgreementStatus = "COMPLETED" | "PARTIAL" | "NOT_AGREED";

/** 관리자 사용자 목록에서 검색 가능한 필드입니다. */
export type UserSearchField = "nickname" | "email";

/** 관리자 사용자 목록에서 필터링 가능한 필드입니다. */
export type UserFilterField =
  | "role"
  | "signupMethod"
  | "agreementStatus"
  | "createdAt";

/** 관리자 사용자 목록에서 정렬 가능한 필드입니다. */
export type UserSortField = "nickname" | "email" | "role" | "createdAt";

/**
 * 관리자 사용자 목록 Server Action에 전달하는 조회 조건입니다.
 */
export type AdminUserListQuery = {
  /** 1부터 시작하는 현재 페이지 번호 */
  page: number;

  /** 한 페이지에 조회할 row 개수 */
  pageSize: number;

  /** 공통 관리자 검색 toolbar에서 적용된 검색 조건 */
  search: AdminSearchValue<UserSearchField>;

  /** 공통 관리자 필터 toolbar에서 적용된 필터 조건 */
  filters: AdminListToolbarFilters<UserFilterField>;

  /** 공통 관리자 toolbar에서 적용된 정렬 조건 */
  sort: AdminSort<UserSortField>;
};

/**
 * 관리자 사용자 목록 테이블의 단일 row 표시 모델입니다.
 */
export type AdminUserListItem = {
  /** profiles.id */
  id: string;

  /** 사용자 닉네임 */
  nickname: string;

  /** 프로필 이미지 URL. 없으면 null */
  avatarUrl: string | null;

  /** canonical email */
  email: string;

  /** 사용자 권한 */
  role: UserRole;

  /** 가입 방법 */
  signupMethod: UserSignupMethod;

  /** 약관 동의 상태 */
  agreementStatus: UserAgreementStatus;

  /** 가입 시각 ISO 문자열 */
  createdAt: string;
};

/**
 * 관리자 사용자 목록 조회 결과입니다.
 */
export type AdminUserListResult = {
  /** 현재 페이지에 표시할 목록 row */
  items: AdminUserListItem[];

  /** 페이지네이션 계산에 필요한 메타데이터 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
