export const MOCK_USER_STATUSES = ["active", "inactive", "suspended"] as const;

export type MockUserStatus = (typeof MOCK_USER_STATUSES)[number];

export const MOCK_USER_ROLES = ["user", "editor", "manager", "admin"] as const;

export type MockUserRole = (typeof MOCK_USER_ROLES)[number];

export const MOCK_USER_GRADES = ["basic", "premium", "vip"] as const;

export type MockUserGrade = (typeof MOCK_USER_GRADES)[number];

/**
 * Component Playground에서 검색, 필터, 페이지네이션 동작을
 * 확인하기 위해 사용하는 Mock 사용자 타입입니다.
 */
export interface MockUser {
  id: number;

  name: string;

  email: string;

  /**
   * Multi-select 필터 실험에 사용합니다.
   */
  status: MockUserStatus;

  /**
   * Multi-select 필터 실험에 사용합니다.
   */
  roles: MockUserRole[];

  /**
   * Select 필터 실험에 사용합니다.
   */
  grade: MockUserGrade;

  /**
   * Number range 필터 실험에 사용합니다.
   */
  score: number;

  /**
   * Date range 필터 실험에 사용합니다.
   */
  createdAt: Date;
}
