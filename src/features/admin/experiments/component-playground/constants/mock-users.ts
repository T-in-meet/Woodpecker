import type {
  MockUser,
  MockUserRole,
  MockUserStatus,
} from "../types/mock-user";

const USER_COUNT = 237;

const USER_STATUSES = [
  "active",
  "inactive",
  "suspended",
] as const satisfies readonly MockUserStatus[];

const USER_ROLE_GROUPS = [
  ["user"],
  ["user", "editor"],
  ["user", "manager"],
  ["user", "admin"],
] as const satisfies readonly (readonly MockUserRole[])[];

/**
 * 사용자 순번에 따라 순환하는 상태 값을 반환한다.
 */
function getMockUserStatus(index: number): MockUserStatus {
  return USER_STATUSES[index % USER_STATUSES.length] ?? USER_STATUSES[0];
}

/**
 * 사용자 순번에 따라 순환하는 역할 목록을 반환한다.
 *
 * readonly 튜플을 MockUser의 변경 가능한 배열 타입에 맞게 복사한다.
 */
function getMockUserRoles(index: number): MockUserRole[] {
  const roles =
    USER_ROLE_GROUPS[index % USER_ROLE_GROUPS.length] ?? USER_ROLE_GROUPS[0];

  return [...roles];
}

/**
 * 사용자 순번을 기준으로 서로 다른 생성일을 만든다.
 *
 * Date range 필터에서 다양한 날짜 범위를 확인할 수 있도록
 * 2025년 1월 1일부터 하루씩 증가하는 날짜를 사용한다.
 */
function createMockUserCreatedAt(index: number) {
  const createdAt = new Date("2025-01-01T00:00:00.000Z");

  createdAt.setUTCDate(createdAt.getUTCDate() + index);

  return createdAt;
}

/**
 * 검색, 필터, 페이지네이션 컴포넌트의 동작 확인에 사용하는
 * Playground 전용 Mock 사용자 데이터다.
 *
 * - name, email: 검색
 * - status: Select
 * - roles: Multi-select
 * - score: Number range
 * - createdAt: Date range
 */
export const MOCK_USERS: MockUser[] = Array.from(
  { length: USER_COUNT },
  (_, index) => {
    const userNumber = index + 1;

    return {
      id: userNumber,
      name: `사용자 ${userNumber}`,
      email: `user${userNumber}@example.com`,
      status: getMockUserStatus(index),
      roles: getMockUserRoles(index),
      score: (index * 7) % 101,
      createdAt: createMockUserCreatedAt(index),
    };
  },
);
