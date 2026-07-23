"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils/cn";

import type {
  AdminAppliedMultiSelectFilter,
  AdminMultiSelectFilterDefinition,
} from "../../types/filter";

interface AdminMultiSelectInputProps<TField extends string> {
  /** 현재 값을 입력할 다중 선택 필터 정의 */
  filter: AdminMultiSelectFilterDefinition<TField>;

  /** 현재 편집 중인 다중 선택 필터 값 */
  value: AdminAppliedMultiSelectFilter<TField> | null;

  /** 선택된 값이 변경될 때 호출되는 함수 */
  onChange: (value: AdminAppliedMultiSelectFilter<TField>) => void;
}

/**
 * 관리자 목록 필터에서 여러 값을 선택하는 공통 입력 컴포넌트입니다.
 *
 * 필터 정의에 포함된 options를 목록으로 표시하고,
 * 사용자가 항목을 선택하거나 해제할 때 새로운 적용 필터 값을 전달합니다.
 *
 * 이 컴포넌트는 `AdminFilterEditor`의 Popover 안에서 사용되므로
 * 별도의 Popover를 만들지 않습니다.
 *
 * @template TField 필터 필드의 문자열 리터럴 타입
 * @param props 필터 정의, 현재 값 및 값 변경 처리 함수
 * @returns 관리자 다중 선택 필터 입력 영역
 */
export function AdminMultiSelectInput<TField extends string>({
  filter,
  value,
  onChange,
}: AdminMultiSelectInputProps<TField>) {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedValues = value?.value ?? [];

  /**
   * 전달받은 항목의 선택 여부를 반전하고
   * 선택 후 검색어를 초기화합니다.
   *
   * 클릭과 Enter 선택 모두 CommandItem의 onSelect를 거치므로
   * 동일한 초기화 동작이 적용됩니다.
   *
   * @param optionValue 선택하거나 해제할 실제 필터 값
   */
  function toggleValue(optionValue: string) {
    const isSelected = selectedValues.includes(optionValue);

    const nextValues = isSelected
      ? selectedValues.filter((selectedValue) => selectedValue !== optionValue)
      : [...selectedValues, optionValue];

    onChange({
      field: filter.field,
      type: "multi-select",
      value: nextValues,
    });

    // 항목 선택 후 전체 목록을 다시 확인할 수 있도록 검색어를 비웁니다.
    setSearchQuery("");
  }

  return (
    <div className="space-y-3">
      <Command className="rounded-md border">
        <CommandInput
          value={searchQuery}
          placeholder={filter.placeholder ?? "항목을 검색하세요."}
          onValueChange={setSearchQuery}
        />

        <CommandList className="max-h-64">
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>

          <CommandGroup>
            {filter.options.map((option) => {
              const isSelected = selectedValues.includes(option.value);

              return (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  aria-pressed={isSelected}
                  onSelect={() => toggleValue(option.value)}
                >
                  {/* 선택 여부를 아이콘으로 명확하게 표시합니다. */}
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                    aria-hidden="true"
                  >
                    <Check
                      className={cn(
                        "size-3",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </span>

                  <span>{option.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>

      {/* 현재 선택된 항목 수를 간단히 확인할 수 있도록 표시합니다. */}
      <p className="text-xs text-muted-foreground">
        {selectedValues.length > 0
          ? `${selectedValues.length}개 선택됨`
          : "선택된 항목이 없습니다."}
      </p>
    </div>
  );
}
