/**
 * 관리자 목록 페이지네이션 설정입니다.
 */
export type AdminPaginationConfig = {
  /** 한 페이지에 표시할 데이터 개수 */
  pageSize: number;

  /**
   * 데스크톱에서 한 번에 표시할 페이지 번호 개수
   *
   * @defaultValue ADMIN_PAGINATION.DEFAULT_PAGE_COUNT
   */
  pageCount?: number;
};

/**
 * 관리자 페이지네이션 계산에 필요한 입력값입니다.
 */
export type GetAdminPaginationParams = {
  /** 현재 페이지 번호. 1부터 시작합니다. */
  currentPage: number;

  /** 전체 데이터 개수 */
  totalCount: number;

  /** 한 페이지에 표시할 데이터 개수 */
  pageSize: number;

  /** 한 번에 표시할 페이지 번호 개수 */
  pageCount: number;
};

/**
 * 관리자 페이지네이션에서 사용할 계산 결과입니다.
 */
export type AdminPagination = {
  /** 범위가 보정된 현재 페이지 번호 */
  currentPage: number;

  /** 전체 페이지 개수 */
  totalPages: number;

  /** 현재 페이지 그룹에 표시할 페이지 번호 목록 */
  pages: number[];

  /** 첫 번째 페이지 번호 */
  firstPage: number;

  /** 마지막 페이지 번호 */
  lastPage: number;

  /** 현재 페이지의 이전 페이지 번호 */
  previousPage: number;

  /** 현재 페이지의 다음 페이지 번호 */
  nextPage: number;

  /** 이전 페이지 그룹으로 이동할 때 사용할 페이지 번호 */
  previousPageGroup: number;

  /** 다음 페이지 그룹으로 이동할 때 사용할 페이지 번호 */
  nextPageGroup: number;

  /** 이전 페이지로 이동할 수 있는지 여부 */
  hasPreviousPage: boolean;

  /** 다음 페이지로 이동할 수 있는지 여부 */
  hasNextPage: boolean;

  /** 이전 페이지 그룹으로 이동할 수 있는지 여부 */
  hasPreviousPageGroup: boolean;

  /** 다음 페이지 그룹으로 이동할 수 있는지 여부 */
  hasNextPageGroup: boolean;
};

/**
 * 관리자 페이지네이션 컴포넌트의 API입니다.
 */
export type AdminPaginationProps = {
  /** 현재 페이지 번호. 1부터 시작합니다. */
  currentPage: number;

  /** 전체 데이터 개수 */
  totalCount: number;

  /** 페이지네이션 표시 설정 */
  config: AdminPaginationConfig;

  /**
   * 페이지가 변경될 때 호출됩니다.
   *
   * @param page 이동할 페이지 번호
   */
  onPageChange(page: number): void;
};
