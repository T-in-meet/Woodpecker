/**
 * 관리자 목록 페이지네이션에서 사용하는 공통 설정입니다.
 */
export const ADMIN_PAGINATION = {
  /** 기본 페이지 번호 표시 개수 */
  DEFAULT_PAGE_COUNT: 10,

  /** 모바일에서 표시할 페이지 번호 개수 */
  MOBILE_PAGE_COUNT: 3,

  /** 데이터가 없을 때의 전체 페이지 수 */
  EMPTY_TOTAL_PAGES: 0,
} as const;
