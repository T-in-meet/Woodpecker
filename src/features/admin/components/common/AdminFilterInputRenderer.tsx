import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
  AdminNumberRangeFilterValue,
} from "../../types/filter";
import { AdminDateRangeInput } from "./AdminDateRangeInput";
import { AdminMultiSelectInput } from "./AdminMultiSelectInput";
import { AdminNumberRangeInput } from "./AdminNumberRangeInput";
import { AdminSelectInput } from "./AdminSelectInput";

interface AdminFilterInputRendererProps<TField extends string> {
  /** 현재 편집할 필터 정의 */
  filter: AdminFilterDefinition<TField>;

  /** 현재 편집 중인 임시 필터 값 */
  value: AdminAppliedFilter<TField> | null;

  /** 임시 필터 값이 변경될 때 호출되는 함수 */
  onChange: (value: AdminAppliedFilter<TField>) => void;
}

/**
 * 필터 정의의 입력 방식에 따라 적절한 입력 컴포넌트를 선택합니다.
 *
 * 현재 단계에서는 실제 입력 컴포넌트를 렌더링하지 않고,
 * 각 필터 타입이 정상적으로 분기되는지만 확인합니다.
 *
 * 이후 Select, MultiSelect, NumberRange, DateRange 입력 컴포넌트를
 * 각 case에 순차적으로 연결합니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 필터 정의, 현재 값, 값 변경 처리 함수
 * @returns 필터 타입에 대응하는 입력 영역
 */
export function AdminFilterInputRenderer<TField extends string>({
  filter,
  value,
  onChange,
}: AdminFilterInputRendererProps<TField>) {
  switch (filter.type) {
    case "select": {
      const selectValue =
        value?.type === "select" && value.field === filter.field ? value : null;

      return (
        <AdminSelectInput
          filter={filter}
          value={selectValue}
          onChange={onChange}
        />
      );
    }

    case "multi-select": {
      const multiSelectValue =
        value?.type === "multi-select" && value.field === filter.field
          ? value
          : null;

      return (
        <AdminMultiSelectInput
          filter={filter}
          value={multiSelectValue}
          onChange={onChange}
        />
      );
    }

    case "number-range": {
      const numberRangeValue: AdminNumberRangeFilterValue =
        value?.type === "number-range"
          ? value.value
          : {
              min: null,
              max: null,
            };

      return (
        <AdminNumberRangeInput
          value={numberRangeValue}
          {...(filter.min !== undefined ? { min: filter.min } : {})}
          {...(filter.max !== undefined ? { max: filter.max } : {})}
          {...(filter.step !== undefined ? { step: filter.step } : {})}
          onValueChange={(nextValue) => {
            onChange({
              field: filter.field,
              type: filter.type,
              value: nextValue,
            });
          }}
        />
      );
    }

    case "date-range": {
      const dateRangeValue =
        value?.type === "date-range"
          ? value.value
          : {
              from: null,
              to: null,
            };

      return (
        <AdminDateRangeInput
          value={dateRangeValue}
          onChange={(nextValue) => {
            onChange({
              field: filter.field,
              type: "date-range",
              value: nextValue,
            });
          }}
        />
      );
    }

    default:
      return assertNever(filter);
  }
}

interface FilterInputPlaceholderProps<TField extends string> {
  /** 현재 분기된 필터 입력 방식 */
  label: string;

  /** 현재 필터 필드 */
  field: TField;

  /** 현재 임시 필터 값 */
  value: AdminAppliedFilter<TField> | null;

  /** 이후 실제 Input에서 사용할 값 변경 함수 */
  onChange: (value: AdminAppliedFilter<TField>) => void;
}

/**
 * 실제 필터 Input을 구현하기 전 사용하는 임시 표시 컴포넌트입니다.
 *
 * `value`와 `onChange`는 이후 실제 Input 연결을 위한 API를
 * 미리 확정하기 위해 전달받습니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 분기된 필터 정보
 * @returns 필터 Input Placeholder
 */
function FilterInputPlaceholder<TField extends string>({
  label,
  field,
  value,
  onChange,
}: FilterInputPlaceholderProps<TField>) {
  // 실제 Input 구현 전 API 형태를 유지하기 위해 참조합니다.
  void onChange;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      <p className="text-sm text-muted-foreground">필드: {field}</p>

      <p className="text-sm text-muted-foreground">
        현재 값: {value ? "설정됨" : "설정되지 않음"}
      </p>
    </div>
  );
}

/**
 * 판별 유니온의 모든 경우가 처리되었는지 검사합니다.
 *
 * 새로운 필터 타입을 추가하고 Renderer에 case를 작성하지 않으면
 * TypeScript 오류가 발생합니다.
 *
 * @param value 처리되지 않아야 하는 값
 * @returns 반환되지 않음
 */
function assertNever(value: never): never {
  throw new Error(`지원하지 않는 필터 타입입니다: ${JSON.stringify(value)}`);
}
