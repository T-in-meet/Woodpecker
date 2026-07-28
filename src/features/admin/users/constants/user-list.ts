import type { AdminListConfig } from "@/features/admin/types/list";

import { AdminBadgeConfig } from "../../types/badge";
import type { AdminSort } from "../../types/sort";
import type {
  UserAgreementStatus,
  UserFilterField,
  UserRole,
  UserSearchField,
  UserSignupMethod,
  UserSortField,
} from "../types/user-list";

/**
 * 관리자 사용자 목록의 초기 정렬 조건입니다.
 */
const ADMIN_USER_INITIAL_SORT: AdminSort<UserSortField> = {
  field: "createdAt",
  direction: "desc",
};

/**
 * 관리자 사용자 목록에서 사용하는 검색, 필터, 페이지네이션 설정입니다.
 *
 * 공통 AdminListToolbar와 AdminPagination이 이 설정을 공유하므로,
 * 목록 조회 action의 query 타입과 항상 같은 필드 이름을 사용해야 합니다.
 */
export const ADMIN_USER_LIST_CONFIG = {
  search: {
    initialField: "nickname",
    fields: [
      {
        value: "nickname",
        label: "닉네임",
      },
      {
        value: "email",
        label: "이메일",
      },
    ],
  },

  filters: [
    {
      field: "role",
      label: "권한",
      type: "select",
      placeholder: "권한을 선택하세요.",
      options: [
        {
          value: "USER",
          label: "사용자",
        },
        {
          value: "ADMIN",
          label: "관리자",
        },
      ],
    },
    {
      field: "signupMethod",
      label: "가입 방법",
      type: "select",
      placeholder: "가입 방법을 선택하세요.",
      options: [
        {
          value: "EMAIL",
          label: "이메일",
        },
        {
          value: "OAUTH",
          label: "소셜 로그인",
        },
      ],
    },
    {
      field: "agreementStatus",
      label: "약관 동의",
      type: "multi-select",
      placeholder: "약관 동의 상태를 선택하세요.",
      options: [
        {
          value: "COMPLETED",
          label: "동의 완료",
        },
        {
          value: "PARTIAL",
          label: "일부 동의",
        },
        {
          value: "NOT_AGREED",
          label: "동의 안 함",
        },
      ],
    },
    {
      field: "createdAt",
      label: "가입일",
      type: "date-range",
      placeholder: "가입일 범위를 선택하세요.",
    },
  ],

  initialSort: ADMIN_USER_INITIAL_SORT,

  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<
  UserSearchField,
  UserFilterField,
  UserSortField
>;

export const USER_ROLE_BADGE_CONFIG = {
  USER: {
    label: "사용자",
    color: "gray",
  },
  ADMIN: {
    label: "관리자",
    color: "blue",
  },
} satisfies AdminBadgeConfig<UserRole>;

export const USER_SIGNUP_METHOD_BADGE_CONFIG = {
  EMAIL: {
    label: "이메일",
    color: "green",
  },
  OAUTH: {
    label: "소셜 로그인",
    color: "purple",
  },
} satisfies AdminBadgeConfig<UserSignupMethod>;

export const USER_AGREEMENT_STATUS_BADGE_CONFIG = {
  COMPLETED: {
    label: "동의 완료",
    color: "green",
  },
  PARTIAL: {
    label: "일부 동의",
    color: "yellow",
  },
  NOT_AGREED: {
    label: "동의 안 함",
    color: "red",
  },
} satisfies AdminBadgeConfig<UserAgreementStatus>;

/**
 * admin_user_list View에서 직접 정렬할 수 있는 컬럼입니다.
 */
type UserSortColumn = "nickname" | "canonical_email" | "role" | "created_at";

/**
 * 관리자 사용자 정렬 필드와 admin_user_list View 컬럼 간의 대응 관계입니다.
 */
export const ADMIN_USER_SORT_COLUMN: Record<UserSortField, UserSortColumn> = {
  nickname: "nickname",
  email: "canonical_email",
  role: "role",
  createdAt: "created_at",
};
