"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

import { ADMIN_SORT_DIRECTION } from "../../constants/admin-sort";
import type { AdminSort } from "../../types/sort";
import { getNextAdminSortDirection } from "../../utils/admin-sort";

interface AdminSortableTableHeadProps<TField extends string> {
  /** 헤더에 표시할 내용 */
  children: ReactNode;

  /** 현재 헤더가 담당하는 정렬 필드 */
  field: TField;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<TField> | null;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<TField>) => void;

  /** 정렬 기능 비활성화 여부 */
  disabled?: boolean;

  /** TableHead에 추가할 className */
  className?: string;
}

/**
 * 관리자 테이블에서 정렬 기능을 제공하는 공통 헤더입니다.
 *
 * 현재 정렬 필드가 아닌 헤더를 선택하면 오름차순 정렬을 적용하고,
 * 현재 정렬 중인 헤더를 다시 선택하면 정렬 방향을 전환합니다.
 *
 * 헤더 내용과 정렬 아이콘에는 `shrink-0`을 적용하여
 * 테이블 너비가 좁아져도 각 요소가 줄어들지 않도록 합니다.
 *
 * @template TField 정렬 가능한 필드의 문자열 리터럴 타입
 * @param props 정렬 가능한 테이블 헤더 속성
 * @param props.children 헤더에 표시할 내용
 * @param props.field 현재 헤더가 담당하는 정렬 필드
 * @param props.sort 현재 적용된 정렬 조건
 * @param props.onSortChange 정렬 조건 변경 이벤트
 * @param props.disabled 정렬 기능 비활성화 여부
 * @param props.className TableHead에 추가할 className
 */
export function AdminSortableTableHead<TField extends string>({
  children,
  field,
  sort,
  onSortChange,
  disabled = false,
  className,
}: AdminSortableTableHeadProps<TField>) {
  const isCurrentField = sort?.field === field;

  const handleSortChange = () => {
    const direction = isCurrentField
      ? getNextAdminSortDirection(sort.direction)
      : ADMIN_SORT_DIRECTION.ASC;

    onSortChange({
      field,
      direction,
    });
  };

  return (
    <TableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto w-fit shrink-0 px-0 hover:bg-transparent"
        disabled={disabled}
        onClick={handleSortChange}
      >
        <span className="shrink-0">{children}</span>

        {!isCurrentField && (
          <ArrowUpDown className="shrink-0" aria-hidden="true" />
        )}

        {isCurrentField && sort.direction === ADMIN_SORT_DIRECTION.ASC && (
          <ArrowUp className="shrink-0" aria-hidden="true" />
        )}

        {isCurrentField && sort.direction === ADMIN_SORT_DIRECTION.DESC && (
          <ArrowDown className="shrink-0" aria-hidden="true" />
        )}
      </Button>
    </TableHead>
  );
}
