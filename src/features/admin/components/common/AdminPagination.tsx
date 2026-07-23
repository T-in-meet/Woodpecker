"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { ADMIN_PAGINATION } from "../../constants/admin-pagination";
import type { AdminPaginationProps } from "../../types/pagination";
import { getAdminPagination } from "../../utils/admin-pagination";

/**
 * 관리자 목록에서 사용하는 공통 페이지네이션 컴포넌트다.
 *
 * 첫 페이지, 이전 페이지 그룹, 이전 페이지, 페이지 번호,
 * 다음 페이지, 다음 페이지 그룹, 마지막 페이지 이동을 지원한다.
 *
 * @param props 관리자 페이지네이션 속성
 * @param props.currentPage 현재 페이지 번호
 * @param props.totalCount 전체 데이터 개수
 * @param props.pageSize 한 페이지에 표시할 데이터 개수
 * @param props.pageCount 한 번에 표시할 페이지 번호 개수
 * @param props.onPageChange 페이지 변경 이벤트
 */
export function AdminPagination({
  currentPage,
  totalCount,
  pageSize,
  pageCount = ADMIN_PAGINATION.DEFAULT_PAGE_COUNT,
  onPageChange,
}: AdminPaginationProps) {
  const pagination = getAdminPagination({
    currentPage,
    totalCount,
    pageSize,
    pageCount,
  });

  /*
   * 데이터가 없으면 이동할 페이지가 없으므로
   * 페이지네이션 UI를 렌더링하지 않는다.
   */
  if (pagination.totalPages === ADMIN_PAGINATION.EMPTY_TOTAL_PAGES) {
    return null;
  }

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="페이지 이동"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        title="첫 페이지"
        aria-label="첫 페이지"
        disabled={!pagination.hasPreviousPage}
        onClick={() => {
          onPageChange(pagination.firstPage);
        }}
      >
        <SkipBack aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="이전 페이지 묶음"
        aria-label="이전 페이지 묶음"
        disabled={!pagination.hasPreviousPageGroup}
        onClick={() => {
          onPageChange(pagination.previousPageGroup);
        }}
      >
        <ChevronsLeft aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="이전 페이지"
        aria-label="이전 페이지"
        disabled={!pagination.hasPreviousPage}
        onClick={() => {
          onPageChange(pagination.previousPage);
        }}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      <div className="flex items-center gap-1">
        {pagination.pages.map((page) => {
          const isCurrentPage = page === pagination.currentPage;

          return (
            <Button
              key={page}
              type="button"
              variant={isCurrentPage ? "default" : "outline"}
              size="icon"
              aria-label={`${page}페이지`}
              aria-current={isCurrentPage ? "page" : undefined}
              disabled={isCurrentPage}
              onClick={() => {
                onPageChange(page);
              }}
            >
              {page}
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="다음 페이지"
        aria-label="다음 페이지"
        disabled={!pagination.hasNextPage}
        onClick={() => {
          onPageChange(pagination.nextPage);
        }}
      >
        <ChevronRight aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="다음 페이지 묶음"
        aria-label="다음 페이지 묶음"
        disabled={!pagination.hasNextPageGroup}
        onClick={() => {
          onPageChange(pagination.nextPageGroup);
        }}
      >
        <ChevronsRight aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="마지막 페이지"
        aria-label="마지막 페이지"
        disabled={!pagination.hasNextPage}
        onClick={() => {
          onPageChange(pagination.lastPage);
        }}
      >
        <SkipForward aria-hidden="true" />
      </Button>
    </nav>
  );
}
