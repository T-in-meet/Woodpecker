/**
 * 관리자 목록 페이지네이션에서 사용하는 공통 설정입니다.
 */
export const ADMIN_PAGINATION = {
  /** 페이지 번호의 시작값 */
  FIRST_PAGE: 1,

  /** 한 페이지에 표시할 기본 데이터 개수 */
  DEFAULT_PAGE_SIZE: 10,

  /** 데스크톱에서 한 번에 표시할 기본 페이지 번호 개수 */
  DEFAULT_PAGE_COUNT: 10,

  /** 모바일에서 한 번에 표시할 페이지 번호 개수 */
  MOBILE_PAGE_COUNT: 3,

  /** 데이터가 없을 때의 전체 페이지 수 */
  EMPTY_TOTAL_PAGES: 0,
} as const;
