"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { AdminFilterDefinition } from "../../types/filter";

interface AdminFilterAddProps<TField extends string> {
  /** 현재 관리자 목록에서 사용할 수 있는 전체 필터 정의 */
  filters: readonly AdminFilterDefinition<TField>[];

  /** 이미 적용되어 추가할 수 없는 필터 필드 목록 */
  appliedFields?: readonly TField[];

  /** 사용자가 추가할 필터를 선택했을 때 호출되는 함수 */
  onSelect: (filter: AdminFilterDefinition<TField>) => void;

  /** 필터 추가 버튼에 표시할 문구 */
  label?: string;
}

/**
 * 관리자 목록에 새로운 필터를 추가하기 위한 공통 컴포넌트입니다.
 *
 * 전체 필터 정의 중 아직 적용되지 않은 필터만 Dropdown Menu에 표시하며,
 * 사용자가 필터를 선택하면 해당 필터 정의를 상위 컴포넌트에 전달합니다.
 *
 * 이 컴포넌트는 필터 값 입력이나 적용 상태를 직접 관리하지 않습니다.
 * 선택된 필터의 Editor를 열거나 임시 값을 생성하는 동작은
 * 상위 컴포넌트에서 처리합니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 필터 정의와 선택 처리 함수
 * @returns 필터 추가 Dropdown Menu
 */
export function AdminFilterAdd<TField extends string>({
  filters,
  appliedFields = [],
  onSelect,
  label = "필터 추가",
}: AdminFilterAddProps<TField>) {
  /**
   * 이미 적용된 필터를 제외한 추가 가능한 필터 목록입니다.
   *
   * 동일한 필드를 중복으로 추가하지 않도록
   * 현재 적용된 필드 목록을 기준으로 필터링합니다.
   */
  const availableFilters = filters.filter(
    (filter) => !appliedFields.includes(filter.field),
  );

  /**
   * 선택된 필터 정의를 상위 컴포넌트에 전달합니다.
   *
   * @param filter 사용자가 선택한 필터 정의
   */
  function handleSelect(filter: AdminFilterDefinition<TField>) {
    onSelect(filter);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={availableFilters.length === 0}
        >
          <Plus aria-hidden="true" />

          {label}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {availableFilters.map((filter) => (
          <DropdownMenuItem
            key={filter.field}
            onSelect={() => handleSelect(filter)}
          >
            {filter.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
