import { ADMIN_SORT_DIRECTION } from "../constants/admin-sort";
import type { AdminSortDirection } from "../types/sort";

/**
 * 현재 정렬 방향을 반대 방향으로 전환합니다.
 *
 * 오름차순은 내림차순으로,
 * 내림차순은 오름차순으로 변경합니다.
 *
 * @param direction 현재 정렬 방향
 * @returns 전환된 정렬 방향
 */
export function getNextAdminSortDirection(
  direction: AdminSortDirection,
): AdminSortDirection {
  return direction === ADMIN_SORT_DIRECTION.ASC
    ? ADMIN_SORT_DIRECTION.DESC
    : ADMIN_SORT_DIRECTION.ASC;
}
