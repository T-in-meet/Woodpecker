"use client";

import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";

import { AdminNumberRangeFilterValue } from "../../types/filter";

interface AdminNumberRangeInputProps {
  /**
   * 현재 입력된 최소값과 최대값입니다.
   */
  value: AdminNumberRangeFilterValue;

  /**
   * 최소값 또는 최대값이 변경될 때 호출됩니다.
   */
  onValueChange: (value: AdminNumberRangeFilterValue) => void;

  /**
   * 입력할 수 있는 전체 범위의 최솟값입니다.
   */
  min?: number;

  /**
   * 입력할 수 있는 전체 범위의 최댓값입니다.
   */
  max?: number;

  /**
   * 숫자 입력의 증감 단위입니다.
   */
  step?: number;
}

/**
 * 관리자 필터에서 숫자의 최소값과 최대값을 입력하는 컴포넌트입니다.
 *
 * 입력 중에는 최소값이 최대값보다 큰 상태도 허용합니다.
 * 범위의 유효성 검증은 필터를 적용하는 시점에 별도로 처리합니다.
 */
export function AdminNumberRangeInput({
  value,
  onValueChange,
  min,
  max,
  step,
}: AdminNumberRangeInputProps) {
  /**
   * HTML Input의 문자열 값을 필터에서 사용하는 숫자 값으로 변환합니다.
   *
   * 빈 문자열은 입력값이 제거된 상태이므로 `null`로 반환합니다.
   */
  const parseInputValue = (inputValue: string): number | null => {
    if (inputValue === "") {
      return null;
    }

    return Number(inputValue);
  };

  const handleMinChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange({
      ...value,
      min: parseInputValue(event.currentTarget.value),
    });
  };

  const handleMaxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange({
      ...value,
      max: parseInputValue(event.currentTarget.value),
    });
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
      <div className="space-y-1.5">
        <label htmlFor="admin-number-range-min" className="text-sm font-medium">
          최소값
        </label>

        <Input
          id="admin-number-range-min"
          type="number"
          value={value.min ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder="최소값"
          onChange={handleMinChange}
        />
      </div>

      <span className="pb-2.5 text-sm text-muted-foreground" aria-hidden="true">
        ~
      </span>

      <div className="space-y-1.5">
        <label htmlFor="admin-number-range-max" className="text-sm font-medium">
          최대값
        </label>

        <Input
          id="admin-number-range-max"
          type="number"
          value={value.max ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder="최대값"
          onChange={handleMaxChange}
        />
      </div>
    </div>
  );
}
