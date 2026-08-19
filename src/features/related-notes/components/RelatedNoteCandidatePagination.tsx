"use client";

import { Button } from "@/components/ui/button";

type RelatedNoteCandidatePaginationProps = {
  /** 현재 페이지 번호입니다. */
  page: number;

  /** 전체 페이지 수입니다. */
  totalPages: number;

  /** 후보 목록을 다시 조회 중인지 여부입니다. */
  isFetching: boolean;

  /** 이전 페이지로 이동할 때 호출됩니다. */
  onPrevious: () => void;

  /** 다음 페이지로 이동할 때 호출됩니다. */
  onNext: () => void;
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
  totalPages,
  isFetching,
  onPrevious,
  onNext,
}: RelatedNoteCandidatePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={page <= 1 || isFetching}
        onClick={onPrevious}
      >
        이전
      </Button>

      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={page >= totalPages || isFetching}
        onClick={onNext}
      >
        다음
      </Button>
    </div>
  );
}
