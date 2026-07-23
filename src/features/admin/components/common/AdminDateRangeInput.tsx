"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useMemo } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AdminDateRangeFilterValue } from "@/features/admin/types/filter";
import { cn } from "@/lib/utils/cn";

interface AdminDateRangeInputProps {
  /**
   * 현재 선택된 날짜 범위입니다.
   */
  value: AdminDateRangeFilterValue;

  /**
   * 날짜 범위가 변경될 때 호출됩니다.
   */
  onChange: (value: AdminDateRangeFilterValue) => void;

  /**
   * 날짜가 선택되지 않았을 때 표시할 안내 문구입니다.
   *
   * @default "날짜 범위를 선택하세요."
   */
  placeholder?: string;

  /**
   * 날짜 범위 입력의 추가 클래스입니다.
   */
  className?: string;

  /**
   * 입력 비활성화 여부입니다.
   *
   * @default false
   */
  disabled?: boolean;
}

/**
 * 관리자 필터에서 사용하는 날짜 범위 입력입니다.
 *
 * 하나의 입력 버튼과 두 달이 좌우로 배치된 범위 선택 달력을 제공합니다.
 * 날짜 선택은 `react-day-picker`의 range 모드를 사용하며, 시작일과
 * 종료일을 하나의 날짜 범위 값으로 관리합니다.
 */
export function AdminDateRangeInput({
  value,
  onChange,
  placeholder = "날짜 범위를 선택하세요.",
  className,
  disabled = false,
}: AdminDateRangeInputProps) {
  /**
   * 관리자 필터의 `null` 기반 날짜 값을
   * react-day-picker의 DateRange 타입으로 변환합니다.
   */
  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (value.from === null) {
      return undefined;
    }

    return {
      from: value.from,
      ...(value.to !== null ? { to: value.to } : {}),
    };
  }, [value.from, value.to]);

  const formattedValue = useMemo(() => {
    if (value.from === null) {
      return null;
    }

    const formattedFrom = format(value.from, "yyyy.MM.dd", {
      locale: ko,
    });

    if (value.to === null) {
      return formattedFrom;
    }

    const formattedTo = format(value.to, "yyyy.MM.dd", {
      locale: ko,
    });

    return `${formattedFrom} ~ ${formattedTo}`;
  }, [value.from, value.to]);

  const statusMessage = useMemo(() => {
    if (value.from === null) {
      return "선택된 날짜가 없습니다.";
    }

    if (value.to === null) {
      return "시작일이 선택되었습니다. 종료일을 선택하세요.";
    }

    return "시작일과 종료일이 선택되었습니다.";
  }, [value.from, value.to]);

  /**
   * Calendar에서 선택된 날짜 범위를 관리자 필터 값으로 변환합니다.
   */
  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange({
        from: null,
        to: null,
      });

      return;
    }

    onChange({
      from: range.from,
      to: range.to ?? null,
    });
  };

  /**
   * 현재 선택된 날짜 범위를 모두 초기화합니다.
   */
  const handleClear = () => {
    onChange({
      from: null,
      to: null,
    });
  };

  const hasValue = value.from !== null || value.to !== null;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !formattedValue && "text-muted-foreground",
            )}
          >
            <CalendarDays className="mr-2 size-4 shrink-0" aria-hidden="true" />

            <span className="truncate">{formattedValue ?? placeholder}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
        >
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ko}
            autoFocus
            classNames={{
              /**
               * react-day-picker는 여러 달을 기본적으로 세로 방향으로
               * 배치할 수 있으므로 관리자 날짜 범위에서는 좌우로 고정합니다.
               */
              months: "flex flex-row gap-4",
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {statusMessage}
        </p>

        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleClear}
            className="h-8 shrink-0 px-2 text-xs"
          >
            선택 해제
          </Button>
        )}
      </div>
    </div>
  );
}
