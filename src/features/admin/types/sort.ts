/**
 * 관리자 목록에서 지원하는 정렬 방향입니다.
 */
export type AdminSortDirection = "asc" | "desc";

/**
 * 관리자 목록에 적용된 정렬 조건입니다.
 *
 * @template TField 정렬 가능한 필드의 문자열 리터럴 타입
 */
export interface AdminSort<TField extends string> {
  /** 정렬할 필드 */
  field: TField;

  /** 정렬 방향 */
  direction: AdminSortDirection;
}
