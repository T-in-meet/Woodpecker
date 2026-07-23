/**
 * 관리자 페이지네이션에서 사용하는 공통 기본값이다.
 */
export const ADMIN_PAGINATION = {
  /** 첫 페이지 번호 */
  FIRST_PAGE: 1,

  /** 전체 페이지가 없을 때 사용하는 페이지 개수 */
  EMPTY_TOTAL_PAGES: 0,

  /** 한 페이지에 표시할 기본 데이터 개수 */
  DEFAULT_PAGE_SIZE: 20,

  /** 한 번에 표시할 기본 페이지 번호 개수 */
  DEFAULT_PAGE_COUNT: 10,
} as const;
