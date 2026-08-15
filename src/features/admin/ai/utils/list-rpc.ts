import type { AdminAppliedFilter } from "@/features/admin/types/filter";
import {
  nextDayIsoString,
  startOfDayIsoString,
} from "@/features/admin/utils/query";

/**
 * 다중 선택 필터 값을 RPC 배열 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns 선택된 값 배열 또는 null
 */
export function getMultiSelectRpcValues<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): string[] | null {
  if (!filter || filter.type !== "multi-select" || filter.value.length === 0) {
    return null;
  }

  return filter.value;
}

/**
 * 단일 선택 boolean 필터 값을 RPC 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns boolean 값 또는 null
 */
export function getSelectBooleanRpcValue<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): boolean | null {
  if (!filter || filter.type !== "select") {
    return null;
  }

  if (filter.value === "true") {
    return true;
  }

  if (filter.value === "false") {
    return false;
  }

  return null;
}

/**
 * 숫자 범위 필터의 최소값을 RPC 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns 최소값 또는 null
 */
export function getNumberRangeRpcMin<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): number | null {
  if (!filter || filter.type !== "number-range") {
    return null;
  }

  return filter.value.min;
}

/**
 * 숫자 범위 필터의 최대값을 RPC 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns 최대값 또는 null
 */
export function getNumberRangeRpcMax<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): number | null {
  if (!filter || filter.type !== "number-range") {
    return null;
  }

  return filter.value.max;
}

/**
 * 날짜 범위 필터의 시작 시각을 RPC 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns 시작일 00:00 ISO 문자열 또는 null
 */
export function getDateRangeRpcFrom<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): string | null {
  if (!filter || filter.type !== "date-range" || filter.value.from === null) {
    return null;
  }

  return startOfDayIsoString(filter.value.from);
}

/**
 * 날짜 범위 필터의 종료 시각을 RPC 파라미터로 변환합니다.
 *
 * @param filter 변환할 필터
 * @returns 종료일 다음 날 00:00 ISO 문자열 또는 null
 */
export function getDateRangeRpcTo<TField extends string>(
  filter: AdminAppliedFilter<TField> | undefined,
): string | null {
  if (!filter || filter.type !== "date-range" || filter.value.to === null) {
    return null;
  }

  return nextDayIsoString(filter.value.to);
}
