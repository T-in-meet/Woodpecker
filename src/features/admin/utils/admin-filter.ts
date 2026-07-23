import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "@/features/admin/types/filter";

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

/**
 * 필터 종류에 맞는 미설정 상태의 적용 필터를 생성합니다.
 *
 * 공통 초기화 동작에서 각 입력 컴포넌트의 값을 직접 다루지 않고,
 * 필터 정의의 `type`을 기준으로 올바른 초기값을 생성하기 위해 사용합니다.
 *
 * @template TField 관리자 필터 필드 타입
 * @param filter 초기화할 필터 정의
 * @returns 필터 종류에 맞는 빈 적용 필터
 */
export function createEmptyAdminAppliedFilter<TField extends string>(
  filter: AdminFilterDefinition<TField>,
): AdminAppliedFilter<TField> {
  switch (filter.type) {
    case "select":
      return {
        field: filter.field,
        type: "select",
        value: "",
      };

    case "multi-select":
      return {
        field: filter.field,
        type: "multi-select",
        value: [],
      };

    case "number-range":
      return {
        field: filter.field,
        type: "number-range",
        value: {
          min: null,
          max: null,
        },
      };

    case "date-range":
      return {
        field: filter.field,
        type: "date-range",
        value: {
          from: null,
          to: null,
        },
      };
  }
}

/**
 * 현재 필터 값의 설정 상태를 사용자에게 표시할 문구로 반환합니다.
 *
 * 필터 입력 컴포넌트마다 상태 문구를 중복해서 작성하지 않고,
 * Editor에서 일관된 상태 안내를 표시하기 위해 사용합니다.
 *
 * @template TField 관리자 필터 필드 타입
 * @param filter 현재 필터 정의
 * @param value 현재 임시 필터 값
 * @returns 필터 종류와 값에 맞는 상태 문구
 */
export function getAdminFilterStatusMessage<TField extends string>(
  filter: AdminFilterDefinition<TField>,
  value: AdminAppliedFilter<TField> | null,
): string {
  switch (filter.type) {
    case "select": {
      const selectedValue = value?.type === "select" ? value.value : "";

      return selectedValue
        ? "1개 항목이 선택되었습니다."
        : "선택된 항목이 없습니다.";
    }

    case "multi-select": {
      const selectedValues = value?.type === "multi-select" ? value.value : [];

      return selectedValues.length > 0
        ? `${selectedValues.length}개 항목이 선택되었습니다.`
        : "선택된 항목이 없습니다.";
    }

    case "number-range": {
      const range =
        value?.type === "number-range"
          ? value.value
          : {
              min: null,
              max: null,
            };

      if (range.min !== null && range.max !== null) {
        return "최솟값과 최댓값이 입력되었습니다.";
      }

      if (range.min !== null) {
        return "최솟값이 입력되었습니다.";
      }

      if (range.max !== null) {
        return "최댓값이 입력되었습니다.";
      }

      return "입력된 숫자 범위가 없습니다.";
    }

    case "date-range": {
      const range =
        value?.type === "date-range"
          ? value.value
          : {
              from: null,
              to: null,
            };

      if (range.from !== null && range.to !== null) {
        return "시작일과 종료일이 선택되었습니다.";
      }

      if (range.from !== null) {
        return "시작일이 선택되었습니다.";
      }

      if (range.to !== null) {
        return "종료일이 선택되었습니다.";
      }

      return "선택된 날짜가 없습니다.";
    }
  }
}
