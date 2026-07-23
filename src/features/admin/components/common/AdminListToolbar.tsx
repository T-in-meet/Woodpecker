import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface AdminListToolbarProps {
  /** 검색 영역 */
  search: ReactNode;

  /** 활성 필터 Badge 및 필터 추가 버튼 영역 */
  filters: ReactNode;

  /** Toolbar에 추가로 적용할 className */
  className?: string;
}

/**
 * 관리자 목록 페이지에서 사용하는 공통 Toolbar입니다.
 *
 * 검색 영역과 필터 영역을 일관된 레이아웃으로 배치하며,
 * 검색, 필터, 조회와 관련된 상태 및 비즈니스 로직은 담당하지 않습니다.
 *
 * ### Responsibilities
 * - 검색 영역 배치
 * - 필터 영역 배치
 * - 반응형 레이아웃 제공
 *
 * ### Does NOT
 * - 검색 상태 관리
 * - 필터 상태 관리
 * - Server Action 호출
 * - URL(Search Params) 동기화
 *
 * @param props Toolbar 구성 요소
 * @returns 관리자 목록 Toolbar
 */
export function AdminListToolbar({
  search,
  filters,
  className,
}: AdminListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 검색은 항상 상단에 고정하여 사용한다. */}
      <div className="w-full">{search}</div>

      {/* 
        필터는 사용자가 자유롭게 추가할 수 있으므로
        Badge가 증가하면 자연스럽게 다음 줄로 배치되도록 한다.
      */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="관리자 목록 필터"
      >
        {filters}
      </div>
    </div>
  );
}
