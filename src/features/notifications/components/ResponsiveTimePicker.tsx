"use client";

import { Clock } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

import {
  clampTimePart,
  getNumericInput,
  getTimeParts,
  padTimePart,
  type PeriodType,
  toTimeValue,
} from "../lib/time";

type ResponsiveTimePickerProps = {
  value: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onValidityChange: (isValid: boolean) => void;
};

type TimePart = "hour" | "minute";

export function ResponsiveTimePicker({
  value,
  disabled,
  onValueChange,
  onValidityChange,
}: ResponsiveTimePickerProps) {
  const errorId = useId();
  const initialParts = getTimeParts(value);
  const [period, setPeriod] = useState<PeriodType>(initialParts.period);
  const [hourValue, setHourValue] = useState(initialParts.hour);
  const [minuteValue, setMinuteValue] = useState(initialParts.minute);
  const [error, setError] = useState<string | null>(null);
  const nativeTimeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextParts = getTimeParts(value);
    setPeriod(nextParts.period);
    setHourValue(nextParts.hour);
    setMinuteValue(nextParts.minute);
    setError(null);
  }, [value]);

  const commitTime = (
    nextPeriod: PeriodType,
    nextHour: string,
    nextMinute: string,
  ) => {
    const nextTime = toTimeValue(nextPeriod, nextHour, nextMinute);
    const isValid = nextTime !== null && nextTime !== "";

    onValidityChange(isValid);

    if (isValid) {
      onValueChange(nextTime);
    }
  };

  const handlePeriodChange = (nextPeriod: PeriodType) => {
    setPeriod(nextPeriod);
    commitTime(nextPeriod, hourValue, minuteValue);
  };

  const handleNativeTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "") {
      onValidityChange(false);
      return;
    }

    onValidityChange(true);
    onValueChange(event.target.value);
  };

  const openNativeTimePicker = () => {
    const nativeTimeInput = nativeTimeInputRef.current;

    if (!nativeTimeInput) {
      return;
    }

    try {
      nativeTimeInput.showPicker();
      return;
    } catch {
      nativeTimeInput.focus();
      nativeTimeInput.click();
    }
  };

  const handlePartChange = (
    part: TimePart,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextValue = getNumericInput(event.target.value);

    if (part === "hour") {
      setHourValue(nextValue);
      if (nextValue.length === 2) {
        commitTime(period, nextValue, minuteValue);
      } else {
        onValidityChange(false);
      }
      return;
    }

    setMinuteValue(nextValue);
    if (nextValue.length === 2) {
      commitTime(period, hourValue, nextValue);
    } else {
      onValidityChange(false);
    }
  };

  const handlePartBlur = (part: TimePart) => {
    const currentParts = getTimeParts(value);
    const currentValue = part === "hour" ? hourValue : minuteValue;
    const normalizedValue =
      part === "hour"
        ? clampTimePart(currentValue, 1, 12)
        : clampTimePart(currentValue, 0, 59);

    if (normalizedValue === "") {
      const fallbackValue =
        part === "hour" ? currentParts.hour : currentParts.minute;

      if (part === "hour") {
        setHourValue(fallbackValue);
      } else {
        setMinuteValue(fallbackValue);
      }

      setError(fallbackValue === "" ? "시·분을 모두 입력해주세요." : null);
      onValidityChange(fallbackValue !== "");
      return;
    }

    setError(null);

    if (part === "hour") {
      setHourValue(normalizedValue);
      commitTime(period, normalizedValue, minuteValue);
    } else {
      setMinuteValue(normalizedValue);
      commitTime(period, hourValue, normalizedValue);
    }
  };

  const handlePartKeyDown = (
    part: TimePart,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    const isHour = part === "hour";
    const min = isHour ? 1 : 0;
    const max = isHour ? 12 : 59;
    const currentValue = Number(isHour ? hourValue : minuteValue);
    const fallbackValue = isHour ? 1 : 0;
    const delta = event.key === "ArrowUp" ? 1 : -1;
    const nextNumber = Math.min(
      max,
      Math.max(
        min,
        (Number.isFinite(currentValue) ? currentValue : fallbackValue) + delta,
      ),
    );
    const nextValue = padTimePart(nextNumber);

    if (isHour) {
      setHourValue(nextValue);
      commitTime(period, nextValue, minuteValue);
    } else {
      setMinuteValue(nextValue);
      commitTime(period, hourValue, nextValue);
    }
  };

  return (
    <div className="space-y-1">
      <div
        role="group"
        aria-label="알림 시간 입력"
        aria-describedby={error ? errorId : undefined}
        className="flex h-11 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-2 shadow-sm sm:gap-2"
      >
        <Clock
          aria-hidden="true"
          className="ml-1 size-4 shrink-0 text-muted-foreground"
        />

        <div className="flex shrink-0 rounded-md bg-muted p-0.5">
          {(["am", "pm"] as const).map((optionPeriod) => {
            const isSelected = period === optionPeriod;
            const label = optionPeriod === "am" ? "오전" : "오후";

            return (
              <button
                key={optionPeriod}
                type="button"
                aria-label={`${label} 선택`}
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => handlePeriodChange(optionPeriod)}
                className={cn(
                  "h-7 cursor-pointer rounded px-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2 disabled:cursor-not-allowed disabled:opacity-50",
                  isSelected
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Input
          type="text"
          inputMode="numeric"
          maxLength={2}
          aria-label="시"
          value={hourValue}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => handlePartChange("hour", event)}
          onBlur={() => handlePartBlur("hour")}
          onKeyDown={(event) => handlePartKeyDown("hour", event)}
          className="h-8 w-10 border-0 px-1 text-center shadow-none focus-visible:bg-muted focus-visible:ring-0 sm:w-11"
        />
        <span className="text-sm font-semibold text-muted-foreground">:</span>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={2}
          aria-label="분"
          value={minuteValue}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => handlePartChange("minute", event)}
          onBlur={() => handlePartBlur("minute")}
          onKeyDown={(event) => handlePartKeyDown("minute", event)}
          className="h-8 w-10 border-0 px-1 text-center shadow-none focus-visible:bg-muted focus-visible:ring-0 sm:w-11"
        />
        <Input
          ref={nativeTimeInputRef}
          type="time"
          step={60}
          tabIndex={-1}
          value={value}
          disabled={disabled}
          onChange={handleNativeTimeChange}
          data-testid="native-time-input"
          className="sr-only"
        />
        <button
          type="button"
          aria-label="시간 선택하기"
          disabled={disabled}
          onClick={openNativeTimePicker}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Clock className="size-4" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
