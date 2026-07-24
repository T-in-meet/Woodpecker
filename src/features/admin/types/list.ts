import type { AdminFilterDefinition } from "@/features/admin/types/filter";
import type { AdminPaginationConfig } from "@/features/admin/types/pagination";
import type { AdminSearchField } from "@/features/admin/types/search";
import type { AdminSort } from "@/features/admin/types/sort";

/**
 * 관리자 목록 검색 설정입니다.
 *
 * @template TSearchField 검색 가능한 필드의 문자열 리터럴 타입
 */
export interface AdminListSearchConfig<TSearchField extends string> {
  /** 목록 진입 시 최초로 선택할 검색 필드 */
  initialField: TSearchField;

  /** 사용자가 선택할 수 있는 검색 필드 목록 */
  fields: readonly AdminSearchField<TSearchField>[];
}

/**
 * 관리자 목록 화면에서 사용하는 공통 설정입니다.
 *
 * @template TSearchField 검색 가능한 필드의 문자열 리터럴 타입
 * @template TFilterField 필터 가능한 필드의 문자열 리터럴 타입
 * @template TSortField 정렬 가능한 필드의 문자열 리터럴 타입
 */
export interface AdminListConfig<
  TSearchField extends string,
  TFilterField extends string,
  TSortField extends string,
> {
  /** 목록 검색 설정 */
  search: AdminListSearchConfig<TSearchField>;

  /** 목록에서 추가할 수 있는 필터 정의 */
  filters: readonly AdminFilterDefinition<TFilterField>[];

  /** 목록 진입 시 적용할 초기 정렬 조건 */
  initialSort: AdminSort<TSortField>;

  /** 목록 페이지네이션 설정 */
  pagination: AdminPaginationConfig;
}
