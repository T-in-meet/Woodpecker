import type { AdminAppliedFilter } from "../types/filter";

/**
 * 적용 필터에 실제 조회 조건으로 사용할 값이 존재하는지 확인합니다.
 *
 * 필터 객체가 존재하더라도 빈 문자열, 빈 배열,
 * 시작값과 종료값이 모두 비어 있는 범위는 미설정으로 처리합니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param filter 확인할 적용 필터
 * @returns 실제 조회에 사용할 값이 존재하면 true
 */
export function hasAdminFilterValue<TField extends string>(
  filter: AdminAppliedFilter<TField>,
): boolean {
  switch (filter.type) {
    case "select":
      return filter.value.length > 0;

    case "multi-select":
      return filter.value.length > 0;

    case "number-range":
      return filter.value.min !== null || filter.value.max !== null;

    case "date-range":
      return filter.value.from !== null || filter.value.to !== null;
  }
}
