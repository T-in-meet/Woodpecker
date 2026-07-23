"use client";

import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

interface AdminDateRangeInputProps {
  /** 현재 선택된 시작일과 종료일 */
  value: DateRange | undefined;

  /** 시작일 또는 종료일이 변경될 때 호출되는 함수 */
  onChange: (value: DateRange | undefined) => void;
}

/**
 * 관리자 필터에서 시작일과 종료일을 각각 선택하는 날짜 범위 입력입니다.
 *
 * 시작일과 종료일은 서로 독립된 Popover와 Calendar를 사용하며,
 * 불완전한 날짜 범위도 입력 중간 상태로 허용합니다.
 */
export function AdminDateRangeInput({
  value,
  onChange,
}: AdminDateRangeInputProps) {
  const hasValue = Boolean(value?.from || value?.to);

  /**
   * 선택된 날짜를 관리자 화면용 문자열로 변환합니다.
   */
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  /**
   * 시작일을 변경하고 기존 종료일은 유지합니다.
   */
  function handleFromChange(from: Date | undefined) {
    if (!from && !value?.to) {
      onChange(undefined);
      return;
    }

    onChange({
      from,
      ...(value?.to ? { to: value.to } : {}),
    });
  }

  /**
   * 종료일을 변경하고 기존 시작일은 유지합니다.
   */
  function handleToChange(to: Date | undefined) {
    if (!value?.from && !to) {
      onChange(undefined);
      return;
    }

    onChange({
      from: value?.from,
      ...(to ? { to } : {}),
    });
  }

  /**
   * 선택된 시작일과 종료일을 모두 제거합니다.
   */
  function handleClear() {
    onChange(undefined);
  }

  /**
   * 현재 날짜 범위 선택 상태를 사용자에게 표시할 문구로 반환합니다.
   */
  function getSelectionStatus(): string {
    if (value?.from && value.to) {
      return "시작일과 종료일이 선택되었습니다.";
    }

    if (value?.from) {
      return "시작일이 선택되었습니다.";
    }

    if (value?.to) {
      return "종료일이 선택되었습니다.";
    }

    return "선택된 날짜가 없습니다.";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "min-w-30 justify-start text-left font-normal",
                !value?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              <span className="truncate">
                {value?.from ? formatDate(value.from) : "시작일"}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={value?.from}
              onSelect={handleFromChange}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">~</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "min-w-30 justify-start text-left font-normal",
                !value?.to && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 size-4" />

              <span className="truncate">
                {value?.to ? formatDate(value.to) : "종료일"}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={value?.to}
              onSelect={handleToChange}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{getSelectionStatus()}</p>

        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={handleClear}
          >
            선택 해제
          </Button>
        )}
      </div>
    </div>
  );
}
