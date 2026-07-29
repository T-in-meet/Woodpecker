/**
 * 관리자 목록 필터에서 지원하는 입력 방식입니다.
 *
 * 새로운 필터 입력 방식이 필요해지면 이 타입과
 * 관련된 필터 정의 및 적용 값 타입을 함께 확장합니다.
 */
export type AdminFilterType =
  | "select"
  | "multi-select"
  | "date-range"
  | "number-range";

/**
 * Select 계열 필터에서 사용하는 선택 항목입니다.
 *
 * @template TValue 필터가 실제로 사용하는 문자열 값 타입
 */
export type AdminFilterOption<TValue extends string = string> = {
  /** 필터 상태와 조회 조건에 사용되는 실제 값 */
  value: TValue;

  /** 사용자에게 표시되는 항목 이름 */
  label: string;
};

/**
 * 날짜 범위 필터의 값입니다.
 *
 * 값이 지정되지 않은 시작일과 종료일은 `null`로 표현합니다.
 * 이를 통해 시작일 또는 종료일만 지정하는 부분 범위를 지원합니다.
 */
export type AdminDateRangeFilterValue = {
  /** 조회 범위의 시작일 */
  from: Date | null;

  /** 조회 범위의 종료일 */
  to: Date | null;
};

/**
 * 숫자 범위 필터의 값입니다.
 *
 * 값이 지정되지 않은 최솟값과 최댓값은 `null`로 표현합니다.
 * 이를 통해 최솟값 또는 최댓값만 지정하는 부분 범위를 지원합니다.
 */
export type AdminNumberRangeFilterValue = {
  /** 조회 범위의 최솟값 */
  min: number | null;

  /** 조회 범위의 최댓값 */
  max: number | null;
};

/**
 * 모든 관리자 필터 정의가 공통으로 가지는 속성입니다.
 *
 * 필터 정의는 사용자가 추가할 수 있는 필터의 종류를 설명하며,
 * 아직 실제 필터 값이 적용된 상태를 의미하지는 않습니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TType 필터 입력 방식
 */
type AdminFilterDefinitionBase<
  TField extends string,
  TType extends AdminFilterType,
> = {
  /** 조회 조건에서 필터를 식별할 때 사용하는 필드 */
  field: TField;

  /** 사용자에게 표시되는 필터 이름 */
  label: string;

  /** 필터 값을 입력하는 방식 */
  type: TType;

  /** 필터 입력 영역에 표시할 선택적 안내 문구 */
  placeholder?: string;
};

/**
 * 단일 선택 필터의 정의입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TValue 선택 가능한 값의 문자열 리터럴 타입
 */
export type AdminSelectFilterDefinition<
  TField extends string = string,
  TValue extends string = string,
> = AdminFilterDefinitionBase<TField, "select"> & {
  /** 단일 선택 필터에서 제공하는 항목 목록 */
  options: readonly AdminFilterOption<TValue>[];
};

/**
 * 다중 선택 필터의 정의입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TValue 선택 가능한 값의 문자열 리터럴 타입
 */
export type AdminMultiSelectFilterDefinition<
  TField extends string = string,
  TValue extends string = string,
> = AdminFilterDefinitionBase<TField, "multi-select"> & {
  /** 다중 선택 필터에서 제공하는 항목 목록 */
  options: readonly AdminFilterOption<TValue>[];
};

/**
 * 날짜 범위 필터의 정의입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminDateRangeFilterDefinition<TField extends string = string> =
  AdminFilterDefinitionBase<TField, "date-range">;

/**
 * 숫자 범위 필터의 정의입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminNumberRangeFilterDefinition<TField extends string = string> =
  AdminFilterDefinitionBase<TField, "number-range"> & {
    /** 사용자가 입력할 수 있는 최솟값 */
    min?: number;

    /** 사용자가 입력할 수 있는 최댓값 */
    max?: number;

    /** 숫자 Input의 증감 간격 */
    step?: number;
  };

/**
 * 관리자 목록에서 제공할 수 있는 필터 정의입니다.
 *
 * `type` 속성을 기준으로 각 필터에 필요한 설정을 구분하는
 * 판별 유니온입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminFilterDefinition<TField extends string = string> =
  | AdminSelectFilterDefinition<TField>
  | AdminMultiSelectFilterDefinition<TField>
  | AdminDateRangeFilterDefinition<TField>
  | AdminNumberRangeFilterDefinition<TField>;

/**
 * 실제로 적용된 필터가 공통으로 가지는 속성입니다.
 *
 * 필터 정의와 달리 적용된 필터에는 사용자가 확정한 값이 포함됩니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TType 필터 입력 방식
 * @template TValue 필터에 저장되는 값
 */
type AdminAppliedFilterBase<
  TField extends string,
  TType extends AdminFilterType,
  TValue,
> = {
  /** 적용된 필터를 식별하는 필드 */
  field: TField;

  /** 적용된 필터의 입력 방식 */
  type: TType;

  /** 사용자가 적용한 필터 값 */
  value: TValue;
};

/**
 * 실제로 적용된 단일 선택 필터입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TValue 선택된 값의 문자열 리터럴 타입
 */
export type AdminAppliedSelectFilter<
  TField extends string = string,
  TValue extends string = string,
> = AdminAppliedFilterBase<TField, "select", TValue>;

/**
 * 실제로 적용된 다중 선택 필터입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @template TValue 선택된 값의 문자열 리터럴 타입
 */
export type AdminAppliedMultiSelectFilter<
  TField extends string = string,
  TValue extends string = string,
> = AdminAppliedFilterBase<TField, "multi-select", TValue[]>;

/**
 * 실제로 적용된 날짜 범위 필터입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminAppliedDateRangeFilter<TField extends string = string> =
  AdminAppliedFilterBase<TField, "date-range", AdminDateRangeFilterValue>;

/**
 * 실제로 적용된 숫자 범위 필터입니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminAppliedNumberRangeFilter<TField extends string = string> =
  AdminAppliedFilterBase<TField, "number-range", AdminNumberRangeFilterValue>;

/**
 * 관리자 목록에 실제로 적용된 필터입니다.
 *
 * `type`에 따라 `value`의 타입이 자동으로 구분됩니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 */
export type AdminAppliedFilter<TField extends string = string> =
  | AdminAppliedSelectFilter<TField>
  | AdminAppliedMultiSelectFilter<TField>
  | AdminAppliedDateRangeFilter<TField>
  | AdminAppliedNumberRangeFilter<TField>;
