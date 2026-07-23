"use client";

import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "../../types/filter";
import { getAdminFilterValidationError } from "../../utils/admin-filter";
import { AdminFilterInputRenderer } from "./AdminFilterInputRenderer";

interface AdminFilterEditorProps<TField extends string> {
  /** 현재 편집할 필터 정의 */
  filter: AdminFilterDefinition<TField>;

  /** Popover를 여는 Trigger 요소 */
  trigger: ReactElement;

  /** 현재 편집 중인 임시 필터 값 */
  value: AdminAppliedFilter<TField> | null;

  /** Popover의 열림 상태 */
  open: boolean;

  /** Popover의 열림 상태가 변경될 때 호출되는 함수 */
  onOpenChange: (open: boolean) => void;

  /** 임시 필터 값이 변경될 때 호출되는 함수 */
  onChange: (value: AdminAppliedFilter<TField>) => void;

  /** 사용자가 임시 필터 값을 적용할 때 호출되는 함수 */
  onApply: () => void;

  /** 사용자가 현재 필터를 삭제할 때 호출되는 함수 */
  onRemove: () => void;
}

/**
 * 관리자 목록 필터를 확인하고 수정하는 공통 Editor입니다.
 *
 * 전달받은 Trigger를 기준으로 Popover를 표시하며,
 * 필터 정의의 `type`에 따라 적절한 입력 컴포넌트를 자동으로 선택합니다.
 *
 * 상위 컴포넌트는 개별 입력 컴포넌트를 직접 선택하지 않고
 * 필터 정의와 현재 값만 전달합니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 필터 정의, Trigger, 현재 값 및 이벤트 처리 함수
 * @returns 관리자 필터 편집 Popover
 */
export function AdminFilterEditor<TField extends string>({
  filter,
  trigger,
  value,
  open,
  onOpenChange,
  onChange,
  onApply,
  onRemove,
}: AdminFilterEditorProps<TField>) {
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * 현재 필터를 삭제하고 Popover를 닫습니다.
   */
  function handleRemove() {
    onRemove();
    onOpenChange(false);
  }

  /**
   * 현재 임시 필터 값의 유효성을 검사한 뒤 적용하고
   * 유효한 경우에만 Popover를 닫습니다.
   */
  function handleApply() {
    const error = getAdminFilterValidationError(value);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
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
            <h3 className="text-sm font-semibold">{filter.label}</h3>
          </header>

          {/* 필터 type에 맞는 입력 컴포넌트를 자동으로 선택합니다. */}
          <div className="px-4 py-4">
            <AdminFilterInputRenderer
              filter={filter}
              value={value}
              onChange={(nextValue) => {
                setValidationError(null);
                onChange(nextValue);
              }}
            />
          </div>

          {validationError && (
            <p role="alert" className="text-sm text-destructive px-4 pb-4">
              {validationError}
            </p>
          )}

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
