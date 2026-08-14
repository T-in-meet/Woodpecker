/**
 * 검색 문자열을 대소문자 구분 없이 포함 여부로 비교합니다.
 *
 * @param value 검색 대상 값
 * @param query 사용자가 입력한 검색어
 * @returns 검색어가 비었거나 값에 포함되면 true
 */
export function includesSearch(value: string | null, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return (value ?? "").toLocaleLowerCase().includes(normalizedQuery);
}

/**
 * 공통 목록 결과로 페이지네이션합니다.
 *
 * @param items 전체 목록
 * @param page 요청 페이지
 * @param pageSize 페이지 크기
 * @returns 현재 페이지 항목과 페이지네이션 메타데이터
 */
export function paginateItems<TItem>(
  items: TItem[],
  page: number,
  pageSize: number,
) {
  const normalizedPage = Math.max(1, page);
  const from = (normalizedPage - 1) * pageSize;
  const pageItems = items.slice(from, from + pageSize);

  return {
    items: pageItems,
    pagination: {
      page: normalizedPage,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    },
  };
}

/**
 * 문자열 값 정렬 비교 결과를 계산합니다.
 *
 * @param left 왼쪽 값
 * @param right 오른쪽 값
 * @returns 정렬 비교 결과
 */
export function compareNullableString(
  left: string | null,
  right: string | null,
) {
  return (left ?? "").localeCompare(right ?? "");
}
