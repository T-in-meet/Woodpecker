import type { AdminBadgeConfig } from "@/features/admin/types/badge";

import type {
  MockUserGrade,
  MockUserRole,
  MockUserStatus,
} from "../types/mock-user";

/**
 * 관리자 사용자 상태별 배지 설정입니다.
 */
export const USER_STATUS_BADGE_CONFIG = {
  active: {
    label: "활성",
    color: "green",
  },
  inactive: {
    label: "비활성",
    color: "gray",
  },
  suspended: {
    label: "정지",
    color: "red",
  },
} satisfies AdminBadgeConfig<MockUserStatus>;

/**
 * 관리자 사용자 등급별 배지 설정입니다.
 */
export const USER_GRADE_BADGE_CONFIG = {
  basic: {
    label: "베이직",
    color: "gray",
  },
  premium: {
    label: "프리미엄",
    color: "blue",
  },
  vip: {
    label: "VIP",
    color: "purple",
  },
} satisfies AdminBadgeConfig<MockUserGrade>;

/**
 * 관리자 사용자 역할별 배지 설정입니다.
 */
export const USER_ROLE_BADGE_CONFIG = {
  user: {
    label: "사용자",
    color: "gray",
  },
  editor: {
    label: "에디터",
    color: "blue",
  },
  manager: {
    label: "매니저",
    color: "green",
  },
  admin: {
    label: "관리자",
    color: "purple",
  },
} satisfies AdminBadgeConfig<MockUserRole>;
