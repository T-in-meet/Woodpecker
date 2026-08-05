"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ADMIN_SELECT_DEFAULTS } from "../../constants/admin-select";
import type {
  AdminAppliedSelectFilter,
  AdminSelectFilterDefinition,
} from "../../types/filter";

type AdminSelectInputProps<TField extends string> = {
  /** 현재 값을 입력할 단일 선택 필터 정의 */
  filter: AdminSelectFilterDefinition<TField>;

  /** 현재 편집 중인 단일 선택 필터 값 */
  value: AdminAppliedSelectFilter<TField> | null;

  /** 선택된 값이 변경될 때 호출되는 함수 */
  onChange: (value: AdminAppliedSelectFilter<TField>) => void;
};

/**
 * 관리자 목록 필터에서 하나의 값을 선택하는 공통 입력 컴포넌트입니다.
 *
 * 필터 정의에 포함된 options를 Select 목록으로 표시하고,
 * 사용자가 항목을 선택하면 새로운 적용 필터 값을 상위 컴포넌트에 전달합니다.
 *
 * 이 컴포넌트는 `AdminFilterEditor` 내부에서 사용되므로
 * 별도의 Popover나 적용 상태를 관리하지 않습니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 필터 정의, 현재 값 및 값 변경 처리 함수
 * @returns 관리자 단일 선택 필터 입력
 */
export function AdminSelectInput<TField extends string>({
  filter,
  value,
  onChange,
}: AdminSelectInputProps<TField>) {
  /**
   * 선택된 옵션을 적용 필터 형식으로 변환해 전달합니다.
   *
   * @param optionValue 사용자가 선택한 실제 필터 값
   */
  function handleValueChange(optionValue: string) {
    onChange({
      field: filter.field,
      type: "select",
      value: optionValue,
    });
  }

  return (
    <div className="space-y-2">
      <Select value={value?.value ?? ""} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={filter.placeholder ?? "항목을 선택하세요."}
          />
        </SelectTrigger>

        <SelectContent {...ADMIN_SELECT_DEFAULTS.content}>
          {filter.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
