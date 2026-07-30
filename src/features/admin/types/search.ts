/**
 * 관리자 목록 검색에서 선택할 수 있는 필드입니다.
 *
 * @template TField 실제 데이터 필드의 문자열 리터럴 타입
 */
export type AdminSearchField<TField extends string> = {
  /** 검색에 사용할 실제 데이터 필드 */
  value: TField;

  /** 사용자에게 표시할 검색 필드 이름 */
  label: string;
};

/**
 * 관리자 목록 검색의 현재 상태입니다.
 *
 * @template TField 검색 가능한 필드의 문자열 리터럴 타입
 */
export type AdminSearchValue<TField extends string> = {
  /** 현재 선택된 검색 필드 */
  field: TField;

  /** 현재 입력된 검색어 */
  query: string;
};
