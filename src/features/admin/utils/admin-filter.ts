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

/**
 * 관리자 필터 값의 유효성을 검사하고 오류 메시지를 반환합니다.
 *
 * 유효한 값이면 `null`을 반환합니다.
 *
 * @param filter 검사할 관리자 필터
 */
export function getAdminFilterValidationError(
  filter: AdminAppliedFilter | null,
): string | null {
  if (!filter) {
    return null;
  }

  switch (filter.type) {
    case "number-range": {
      const { min, max } = filter.value;

      if (min !== null && max !== null && min > max) {
        return "최솟값은 최댓값보다 클 수 없습니다.";
      }

      return null;
    }

    case "date-range": {
      const { from, to } = filter.value;

      /**
       * 잘못된 외부 데이터가 전달되는 경우를 방어합니다.
       */
      if (from !== null && to !== null && from > to) {
        return "시작일은 종료일보다 늦을 수 없습니다.";
      }

      return null;
    }

    default:
      return null;
  }
}
