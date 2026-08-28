"use client";

import { CalendarDays } from "lucide-react";
import {
  type ChangeEvent,
  type FocusEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";

import {
  type DatePartsType,
  getDateParts,
  getNumericInput,
  toDateKey,
} from "../lib/time";

type ResponsiveDateInputProps = {
  value: string;
  min: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onValidityChange: (isValid: boolean) => void;
};

type DatePartType = keyof DatePartsType;

const DATE_PART_MAX_LENGTH = {
  year: 4,
  month: 2,
  day: 2,
} as const;

function getDateInputError(parts: DatePartsType, min: string) {
  const { year, month, day } = parts;

  if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
    return "연·월·일을 모두 입력해주세요.";
  }

  const dateKey = toDateKey(year, month, day);

  if (dateKey === null) {
    return "존재하지 않는 날짜입니다.";
  }

  if (dateKey < min) {
    return "오늘 이후 날짜를 입력해주세요.";
  }

  return null;
}

export function ResponsiveDateInput({
  value,
  min,
  disabled,
  onValueChange,
  onValidityChange,
}: ResponsiveDateInputProps) {
  const errorId = useId();
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const [parts, setParts] = useState(() => getDateParts(value));
  const [showError, setShowError] = useState(false);
  const error = getDateInputError(parts, min);

  useEffect(() => {
    setParts(getDateParts(value));
    setShowError(false);
  }, [value]);

  const handlePartChange = (
    part: DatePartType,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const maxLength = DATE_PART_MAX_LENGTH[part];
    const nextPartValue = getNumericInput(event.target.value, maxLength);
    const nextParts = { ...parts, [part]: nextPartValue };
    const nextError = getDateInputError(nextParts, min);

    setParts(nextParts);
    setShowError(false);
    onValidityChange(nextError === null);

    if (nextError === null) {
      const nextDateKey = toDateKey(
        nextParts.year,
        nextParts.month,
        nextParts.day,
      );

      if (nextDateKey !== null) {
        onValueChange(nextDateKey);
      }
    }

    if (nextPartValue.length !== maxLength) {
      return;
    }

    if (part === "year") {
      monthInputRef.current?.focus();
    } else if (part === "month") {
      dayInputRef.current?.focus();
    }
  };

  const handleGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget as Node)
    ) {
      return;
    }

    setShowError(error !== null);
  };

  const hasVisibleError = showError && error !== null;

  return (
    <div className="space-y-1">
      <div
        role="group"
        aria-label="날짜 입력"
        aria-describedby={hasVisibleError ? errorId : undefined}
        onBlur={handleGroupBlur}
        className="flex h-11 w-full items-center gap-1 rounded-lg border border-input bg-background px-2 shadow-sm"
      >
        <CalendarDays
          aria-hidden="true"
          className="ml-1 size-4 shrink-0 text-muted-foreground"
        />
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          aria-label="연도"
          aria-invalid={hasVisibleError}
          placeholder="YYYY"
          value={parts.year}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => handlePartChange("year", event)}
          className="h-8 w-14 border-0 px-1 text-center shadow-none focus-visible:bg-muted focus-visible:ring-0"
        />
        <span className="text-sm text-muted-foreground">/</span>
        <Input
          ref={monthInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="월"
          aria-invalid={hasVisibleError}
          placeholder="MM"
          value={parts.month}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => handlePartChange("month", event)}
          className="h-8 w-10 border-0 px-1 text-center shadow-none focus-visible:bg-muted focus-visible:ring-0"
        />
        <span className="text-sm text-muted-foreground">/</span>
        <Input
          ref={dayInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="일"
          aria-invalid={hasVisibleError}
          placeholder="DD"
          value={parts.day}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => handlePartChange("day", event)}
          className="h-8 w-10 border-0 px-1 text-center shadow-none focus-visible:bg-muted focus-visible:ring-0"
        />
      </div>

      {hasVisibleError ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
