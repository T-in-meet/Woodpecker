"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, Info, Loader2, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS } from "@/lib/constants/notifications";

import {
  setNotificationScheduleAction,
  setNotificationTimeAction,
} from "../actions";
import {
  addDaysToDateKey,
  clampTimePart,
  fromDateKey,
  getKstDateKey,
  getKstTimeValue,
  getNumericInput,
  getTimeParts,
  type PeriodType,
  toDateKey,
  toInputTime,
  toTimeValue,
} from "../lib/time";

type NotificationSchedulePickerProps = {
  noteId: string;
  /** 사용자가 지정한 알림 시각(`notification_time_of_day`). 없으면 기본 일정을 따른다. */
  initialTime: string | null;
  /** 다음 알림이 실제로 나갈 시각. 달력의 초기 선택 날짜가 된다. */
  initialScheduledAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 빠른 선택 칩. 달력을 열지 않고 끝나는 흔한 경우를 먼저 처리한다. */
const QUICK_OFFSETS = [
  { label: "오늘", days: 0 },
  { label: "내일", days: 1 },
  { label: "3일 뒤", days: 3 },
  { label: "다음 주", days: 7 },
] as const;

function formatScheduleLabel(dateKey: string, time: string) {
  const date = fromDateKey(dateKey);

  if (!date || time === "") {
    return null;
  }

  const { period, hour, minute } = getTimeParts(time);
  const periodLabel = period === "am" ? "오전" : "오후";

  return `${format(date, "M월 d일 (E)", { locale: ko })} ${periodLabel} ${hour}:${minute}`;
}

/**
 * 다음 복습 일정(=알림 시각) 변경 다이얼로그. 트리거는 갖지 않고 열림 상태를 밖에서 받는다.
 * 노트 상세에서는 관리 메뉴(`NoteManageMenu`)의 항목으로 열린다.
 *
 * 날짜를 옮기면 이번 회차의 복습 일정 자체가 이동한다. 이후 회차는 복습을 마친
 * 시점을 기준으로 다시 잡히므로 여기서 손대지 않는다.
 */
export function NotificationSchedulePicker({
  noteId,
  initialTime,
  initialScheduledAt,
  open,
  onOpenChange,
}: NotificationSchedulePickerProps) {
  const inputBaseId = useId();
  const labelId = `${inputBaseId}-label`;
  const hourInputId = `${inputBaseId}-hour`;
  const minuteInputId = `${inputBaseId}-minute`;
  const nativeTimeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const todayKey = getKstDateKey(new Date());
  const lastSelectableKey = addDaysToDateKey(
    todayKey,
    MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS,
  );

  const savedDateKey = initialScheduledAt
    ? getKstDateKey(new Date(initialScheduledAt))
    : todayKey;
  const savedTime = initialScheduledAt
    ? getKstTimeValue(initialScheduledAt)
    : toInputTime(initialTime);
  const savedTimeParts = getTimeParts(savedTime);

  const [dateKey, setDateKey] = useState(savedDateKey);
  const [period, setPeriod] = useState<PeriodType>(savedTimeParts.period);
  const [hourValue, setHourValue] = useState(savedTimeParts.hour);
  const [minuteValue, setMinuteValue] = useState(savedTimeParts.minute);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSavedOverride = toInputTime(initialTime).length > 0;
  const timeValue = toTimeValue(period, hourValue, minuteValue);
  const hasChanges =
    timeValue === null || timeValue !== savedTime || dateKey !== savedDateKey;
  const periodLabel = period === "am" ? "오전" : "오후";
  const scheduleLabel =
    timeValue === null || timeValue === ""
      ? null
      : formatScheduleLabel(dateKey, timeValue);

  const resetDraft = () => {
    setDateKey(savedDateKey);
    setPeriod(savedTimeParts.period);
    setHourValue(savedTimeParts.hour);
    setMinuteValue(savedTimeParts.minute);
  };

  // 여는 주체가 밖(`NoteManageMenu`)이라 열 때는 Radix가 onOpenChange를 호출하지 않는다.
  // 열림 자체를 신호로 삼아야 "열 때 초안 초기화"가 닫힘 경로에 의존하지 않는다.
  // 저장 직후 effect가 다시 돌아 성공 메시지를 지우지 않도록 저장된 값은 ref로 읽는다.
  const savedRef = useRef({ dateKey: savedDateKey, time: savedTime });
  savedRef.current = { dateKey: savedDateKey, time: savedTime };

  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage(null);
    setError(null);
    setDateKey(savedRef.current.dateKey);
    const nextTimeParts = getTimeParts(savedRef.current.time);
    setPeriod(nextTimeParts.period);
    setHourValue(nextTimeParts.hour);
    setMinuteValue(nextTimeParts.minute);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    setMessage(null);
    setError(null);
    resetDraft();
  };

  const togglePeriod = () => {
    setPeriod((currentPeriod) => (currentPeriod === "am" ? "pm" : "am"));
  };

  const handlePeriodKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight"
    ) {
      return;
    }

    event.preventDefault();
    togglePeriod();
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (timeValue === null || timeValue === "") {
      setError("알림 시간이 올바르지 않습니다.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await setNotificationScheduleAction(
          noteId,
          dateKey,
          timeValue,
        );

        if (!result.success) {
          setError(result.error);
          return;
        }

        setMessage(
          `${formatScheduleLabel(dateKey, timeValue)}에 알림을 보냅니다.`,
        );
        router.refresh();
      } catch {
        setError(
          "알림 일정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    });
  };

  const handleClear = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await setNotificationTimeAction(noteId, null);

        if (!result.success) {
          setError(result.error);
          return;
        }

        setMessage("기본 복습 일정을 사용합니다.");
        router.refresh();
      } catch {
        setError(
          "알림 일정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    });
  };

  const handleNativeTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    const nextTimeParts = getTimeParts(event.target.value);
    setPeriod(nextTimeParts.period);
    setHourValue(nextTimeParts.hour);
    setMinuteValue(nextTimeParts.minute);
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }

    setMessage(null);
    setError(null);
    setDateKey(toDateKey(date));
  };

  // 날짜 키는 항상 이 컴포넌트가 만든 값이라 파싱이 실패할 일은 없지만,
  // 달력은 undefined를 받지 않으므로 오늘로 떨어뜨린다.
  const today = new Date();
  const selectedDate = fromDateKey(dateKey) ?? today;
  const firstSelectable = fromDateKey(todayKey) ?? today;
  const lastSelectable = fromDateKey(lastSelectableKey) ?? today;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>다음 복습 일정 변경</DialogTitle>
            <DialogDescription className="mt-2">
              현재 설정:{" "}
              {formatScheduleLabel(savedDateKey, savedTime) ??
                "기본 복습 예정 시간"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_OFFSETS.map((offset) => {
                const offsetKey = addDaysToDateKey(todayKey, offset.days);

                return (
                  <Button
                    key={offset.label}
                    type="button"
                    variant={dateKey === offsetKey ? "secondary" : "outline"}
                    size="xs"
                    disabled={isPending}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      setDateKey(offsetKey);
                    }}
                  >
                    {offset.label}
                  </Button>
                );
              })}
            </div>

            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              defaultMonth={selectedDate}
              locale={ko}
              disabled={[
                { before: firstSelectable },
                { after: lastSelectable },
              ]}
              className="w-full rounded-md border border-input"
            />

            <div className="space-y-2">
              <Label id={labelId} htmlFor={hourInputId}>
                알림 시간
              </Label>
              <div
                role="group"
                aria-labelledby={labelId}
                className="flex w-full items-center gap-2 rounded-md border border-input bg-background p-1 shadow-sm"
              >
                <button
                  type="button"
                  aria-label={`오전 오후 전환, 현재 ${periodLabel}`}
                  aria-pressed={period === "pm"}
                  disabled={isPending}
                  onClick={togglePeriod}
                  onKeyDown={handlePeriodKeyDown}
                  className="h-8 w-16 cursor-pointer rounded-md bg-muted px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {periodLabel}
                </button>
                <Input
                  id={hourInputId}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="시"
                  placeholder="시"
                  value={hourValue}
                  disabled={isPending}
                  onBlur={() =>
                    setHourValue((currentValue) =>
                      clampTimePart(currentValue, 1, 12),
                    )
                  }
                  onChange={(event) =>
                    setHourValue(getNumericInput(event.target.value))
                  }
                  className="h-8 w-16 border-0 text-center shadow-none focus-visible:ring-0"
                />
                <span className="text-sm font-semibold text-muted-foreground">
                  :
                </span>
                <Input
                  id={minuteInputId}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="분"
                  placeholder="분"
                  value={minuteValue}
                  disabled={isPending}
                  onBlur={() =>
                    setMinuteValue((currentValue) =>
                      clampTimePart(currentValue, 0, 59),
                    )
                  }
                  onChange={(event) =>
                    setMinuteValue(getNumericInput(event.target.value))
                  }
                  className="h-8 w-16 border-0 text-center shadow-none focus-visible:ring-0"
                />
                <Input
                  ref={nativeTimeInputRef}
                  type="time"
                  step={60}
                  tabIndex={-1}
                  value={timeValue ?? ""}
                  onChange={handleNativeTimeChange}
                  data-testid="native-time-input"
                  className="sr-only"
                />
                <button
                  type="button"
                  aria-label="시간 선택하기"
                  disabled={isPending}
                  onClick={openNativeTimePicker}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clock className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {scheduleLabel && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Info className="size-4 shrink-0" aria-hidden="true" />
                {scheduleLabel}에 알림을 보냅니다.
              </p>
            )}

            <div aria-live="polite" className="min-h-5">
              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="mt-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isPending || !hasSavedOverride}
                onClick={handleClear}
              >
                <RotateCcw aria-hidden="true" />
                기본 일정
              </Button>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    disabled={isPending}
                  >
                    닫기
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="md"
                  disabled={isPending || !hasChanges}
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Save aria-hidden="true" />
                  )}
                  저장
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
