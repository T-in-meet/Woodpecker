import type { AdminSort } from "@/features/admin/types/sort";

import type { MockUser } from "../types/mock-user";
import type { ComponentPlaygroundSortField } from "../types/sort";

/**
 * Mock 사용자 목록을 지정된 필드와 방향에 따라 정렬합니다.
 *
 * 원본 배열을 변경하지 않고 새로운 배열을 반환하므로,
 * 상위 조회 로직에서 원본 데이터를 안전하게 재사용할 수 있습니다.
 *
 * @param users 정렬할 Mock 사용자 목록
 * @param sort 목록에 적용할 정렬 조건
 * @returns 정렬 조건이 적용된 새로운 Mock 사용자 목록
 */
export function sortMockUsers(
  users: MockUser[],
  sort: AdminSort<ComponentPlaygroundSortField>,
): MockUser[] {
  return [...users].sort((left, right) => {
    const compareResult = compareMockUsers(left, right, sort.field);

    return sort.direction === "asc" ? compareResult : -compareResult;
  });
}

/**
 * 두 Mock 사용자의 특정 필드 값을 비교합니다.
 *
 * 정렬 방향은 이 함수에서 처리하지 않고,
 * 필드별 오름차순 비교 결과만 반환합니다.
 *
 * @param left 비교할 첫 번째 Mock 사용자
 * @param right 비교할 두 번째 Mock 사용자
 * @param field 비교할 정렬 필드
 * @returns 음수, 0 또는 양수 형태의 비교 결과
 */
function compareMockUsers(
  left: MockUser,
  right: MockUser,
  field: ComponentPlaygroundSortField,
): number {
  switch (field) {
    case "id":
      return left.id - right.id;

    case "name":
      return left.name.localeCompare(right.name, "ko-KR");

    case "email":
      return left.email.localeCompare(right.email, "ko-KR");

    case "status":
      return left.status.localeCompare(right.status, "ko-KR");

    case "grade":
      return left.grade.localeCompare(right.grade, "ko-KR");

    case "score":
      return left.score - right.score;

    case "createdAt":
      return left.createdAt.getTime() - right.createdAt.getTime();

    default:
      return assertNever(field);
  }
}

/**
 * 판별 유니온의 모든 정렬 필드가 처리되었는지 검사합니다.
 *
 * 새로운 정렬 필드를 추가하고 비교 로직을 작성하지 않으면
 * TypeScript 오류가 발생합니다.
 *
 * @param value 처리되지 않아야 하는 정렬 필드
 * @returns 반환되지 않음
 */
function assertNever(value: never): never {
  throw new Error(`지원하지 않는 정렬 필드입니다: ${value}`);
}
