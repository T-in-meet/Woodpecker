"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AdminFilterEditorProps {
  /** 사용자에게 표시할 필터 이름 */
  label: string;

  /** Popover를 여는 Trigger 요소 */
  trigger: ReactNode;

  /** 필터 값을 입력하는 영역 */
  children: ReactNode;

  /** Popover의 열림 상태 */
  open: boolean;

  /** Popover의 열림 상태가 변경될 때 호출되는 함수 */
  onOpenChange: (open: boolean) => void;

  /** 사용자가 필터 값을 적용할 때 호출되는 함수 */
  onApply: () => void;

  /** 사용자가 현재 필터를 삭제할 때 호출되는 함수 */
  onRemove: () => void;
}

/**
 * 관리자 목록 필터를 확인하고 수정하는 공통 Editor입니다.
 *
 * 전달받은 Trigger를 기준으로 Popover를 표시하며,
 * 필터 이름, 입력 영역, 삭제 버튼, 적용 버튼을 제공합니다.
 *
 * 실제 필터 입력 UI는 `children`으로 전달받습니다.
 *
 * @param props Trigger, 필터 이름, 입력 영역 및 이벤트 처리 함수
 * @returns 관리자 필터 편집 Popover
 */
export function AdminFilterEditor({
  label,
  trigger,
  children,
  open,
  onOpenChange,
  onApply,
  onRemove,
}: AdminFilterEditorProps) {
  /**
   * 현재 필터를 삭제하고 Popover를 닫습니다.
   */
  function handleRemove() {
    onRemove();
    onOpenChange(false);
  }

  /**
   * 현재 필터 값을 적용하고 Popover를 닫습니다.
   */
  function handleApply() {
    onApply();
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex flex-col">
          {/* 현재 편집 중인 필터 이름을 표시합니다. */}
          <header className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">{label}</h3>
          </header>

          {/* 필터 종류에 맞는 입력 컴포넌트가 렌더링됩니다. */}
          <div className="px-4 py-4">{children}</div>

          {/* 삭제와 적용 동작은 모든 필터 Editor에서 공통으로 제공합니다. */}
          <footer className="flex items-center justify-between border-t px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              삭제
            </Button>

            <Button type="button" size="sm" onClick={handleApply}>
              적용
            </Button>
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  );
}
