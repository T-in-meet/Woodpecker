"use client";

import { Button } from "@/components/ui/button";
import { getAdminPagination } from "@/features/admin/utils/admin-pagination";

type RelatedNoteCandidatePaginationProps = {
  /** 현재 페이지 번호입니다. */
  page: number;

  /** 전체 후보 Note 개수입니다. */
  totalCount: number;

  /** 한 페이지에 표시할 후보 Note 개수입니다. */
  pageSize: number;

  /** 후보 목록을 다시 조회 중인지 여부입니다. */
  isFetching: boolean;

  /**
   * 페이지가 변경될 때 호출됩니다.
   *
   * @param page 이동할 페이지 번호
   */
  onPageChange: (page: number) => void;
};

/**
 * Related Note 후보 목록의 pagination을 표시합니다.
 *
 * 첫 페이지에서는 이전 버튼을, 마지막 페이지에서는 다음 버튼을 비활성화합니다.
 * 후보 목록을 다시 조회하는 동안에는 연속된 페이지 이동 요청을 막기 위해
 * 양쪽 이동 버튼을 비활성화합니다.
 *
 * 전체 페이지가 1개 이하이면 pagination을 표시하지 않습니다.
 *
 * @param props 현재 페이지와 페이지 이동 상태
 */
export function RelatedNoteCandidatePagination({
  page,
  totalCount,
  pageSize,
  isFetching,
  onPageChange,
}: RelatedNoteCandidatePaginationProps) {
  const pagination = getAdminPagination({
    currentPage: page,
    totalCount,
    pageSize,
    pageCount: 1,
  });

  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!pagination.hasPreviousPage || isFetching}
        onClick={() => {
          onPageChange(pagination.previousPage);
        }}
      >
        이전
      </Button>

      <span className="text-sm text-muted-foreground">
        {pagination.currentPage} / {pagination.totalPages}
      </span>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!pagination.hasNextPage || isFetching}
        onClick={() => {
          onPageChange(pagination.nextPage);
        }}
      >
        다음
      </Button>
    </div>
  );
}
