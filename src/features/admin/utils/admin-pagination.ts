import { ADMIN_PAGINATION } from "../constants/admin-pagination";
import type {
  AdminPagination,
  GetAdminPaginationParams,
} from "../types/pagination";

/**
 * 값을 지정된 최소값과 최대값 사이로 제한한다.
 *
 * @param value 제한할 값
 * @param min 허용할 최소값
 * @param max 허용할 최대값
 * @returns 최소값과 최대값 범위로 보정된 값
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 양의 정수로 사용할 페이지네이션 설정값을 보정한다.
 *
 * 유효하지 않은 값이 전달되면 지정된 기본값을 반환한다.
 *
 * @param value 보정할 값
 * @param fallback 유효하지 않은 값에 사용할 기본값
 * @returns 양의 정수로 보정된 값
 */
function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

/**
 * 전체 데이터 개수를 음수가 아닌 정수로 보정한다.
 *
 * @param totalCount 전체 데이터 개수
 * @returns 음수가 아닌 정수로 보정된 전체 데이터 개수
 */
function normalizeTotalCount(totalCount: number): number {
  if (!Number.isFinite(totalCount) || totalCount <= 0) {
    return 0;
  }

  return Math.floor(totalCount);
}

/**
 * 현재 페이지 그룹에 표시할 페이지 번호 배열을 생성한다.
 *
 * @param startPage 페이지 그룹의 시작 페이지
 * @param endPage 페이지 그룹의 마지막 페이지
 * @returns 시작 페이지부터 마지막 페이지까지의 페이지 번호 배열
 */
function createPages(startPage: number, endPage: number): number[] {
  return Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index,
  );
}

/**
 * 관리자 페이지네이션 정보를 계산한다.
 *
 * 서버에서는 목록 데이터와 전체 데이터 개수만 조회하고,
 * 페이지 그룹과 이동 대상 페이지는 이 함수에서 계산한다.
 *
 * @param params 페이지네이션 계산에 필요한 값
 * @param params.currentPage 현재 페이지 번호
 * @param params.totalCount 전체 데이터 개수
 * @param params.pageSize 한 페이지에 표시할 데이터 개수
 * @param params.pageCount 한 번에 표시할 페이지 번호 개수
 * @returns 페이지 번호와 페이지 이동 상태를 포함한 페이지네이션 정보
 */
export function getAdminPagination({
  currentPage,
  totalCount,
  pageSize,
  pageCount,
}: GetAdminPaginationParams): AdminPagination {
  const normalizedTotalCount = normalizeTotalCount(totalCount);

  const normalizedPageSize = normalizePositiveInteger(
    pageSize,
    ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
  );

  const normalizedPageCount = normalizePositiveInteger(
    pageCount,
    ADMIN_PAGINATION.DEFAULT_PAGE_COUNT,
  );

  const totalPages =
    normalizedTotalCount === 0
      ? ADMIN_PAGINATION.EMPTY_TOTAL_PAGES
      : Math.ceil(normalizedTotalCount / normalizedPageSize);

  /*
   * 데이터가 없으면 페이지 번호를 표시하지 않는다.
   * 이동 대상 페이지는 유효한 기본 페이지 번호인 첫 페이지로 유지한다.
   */
  if (totalPages === ADMIN_PAGINATION.EMPTY_TOTAL_PAGES) {
    return {
      currentPage: ADMIN_PAGINATION.FIRST_PAGE,
      totalPages,
      pages: [],
      firstPage: ADMIN_PAGINATION.FIRST_PAGE,
      lastPage: ADMIN_PAGINATION.FIRST_PAGE,
      previousPage: ADMIN_PAGINATION.FIRST_PAGE,
      nextPage: ADMIN_PAGINATION.FIRST_PAGE,
      previousPageGroup: ADMIN_PAGINATION.FIRST_PAGE,
      nextPageGroup: ADMIN_PAGINATION.FIRST_PAGE,
      hasPreviousPage: false,
      hasNextPage: false,
      hasPreviousPageGroup: false,
      hasNextPageGroup: false,
    };
  }

  const normalizedCurrentPage = normalizePositiveInteger(
    currentPage,
    ADMIN_PAGINATION.FIRST_PAGE,
  );

  const boundedCurrentPage = clamp(
    normalizedCurrentPage,
    ADMIN_PAGINATION.FIRST_PAGE,
    totalPages,
  );

  // 현재 페이지가 속한 페이지 그룹의 0부터 시작하는 인덱스를 계산한다.
  const pageGroupIndex = Math.floor(
    (boundedCurrentPage - ADMIN_PAGINATION.FIRST_PAGE) / normalizedPageCount,
  );

  // 현재 페이지 그룹에서 처음 표시할 페이지 번호를 계산한다.
  const groupStartPage =
    pageGroupIndex * normalizedPageCount + ADMIN_PAGINATION.FIRST_PAGE;

  // 마지막 그룹에서는 전체 페이지 개수를 초과하지 않도록 제한한다.
  const groupEndPage = Math.min(
    groupStartPage + normalizedPageCount - 1,
    totalPages,
  );

  const pages = createPages(groupStartPage, groupEndPage);

  const hasPreviousPage = boundedCurrentPage > ADMIN_PAGINATION.FIRST_PAGE;

  const hasNextPage = boundedCurrentPage < totalPages;

  const hasPreviousPageGroup = groupStartPage > ADMIN_PAGINATION.FIRST_PAGE;

  const hasNextPageGroup = groupEndPage < totalPages;

  return {
    currentPage: boundedCurrentPage,
    totalPages,
    pages,
    firstPage: ADMIN_PAGINATION.FIRST_PAGE,
    lastPage: totalPages,
    previousPage: hasPreviousPage
      ? boundedCurrentPage - 1
      : ADMIN_PAGINATION.FIRST_PAGE,
    nextPage: hasNextPage ? boundedCurrentPage + 1 : totalPages,

    /*
     * 이전 묶음은 이전 그룹의 시작 페이지로 이동한다.
     * 예: 11~20 그룹에서 이전 묶음을 누르면 1페이지로 이동한다.
     */
    previousPageGroup: hasPreviousPageGroup
      ? Math.max(
          groupStartPage - normalizedPageCount,
          ADMIN_PAGINATION.FIRST_PAGE,
        )
      : ADMIN_PAGINATION.FIRST_PAGE,

    // 다음 묶음은 다음 그룹의 시작 페이지로 이동한다.
    nextPageGroup: hasNextPageGroup ? groupEndPage + 1 : totalPages,
    hasPreviousPage,
    hasNextPage,
    hasPreviousPageGroup,
    hasNextPageGroup,
  };
}
