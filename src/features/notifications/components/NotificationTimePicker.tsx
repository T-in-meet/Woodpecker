"use client";

import { Clock, Loader2, RotateCcw, Save } from "lucide-react";
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

import { setNotificationTimeAction } from "../actions";
import {
  clampTimePart,
  getNumericInput,
  getTimeParts,
  type PeriodType,
  toInputTime,
  toTimeValue,
} from "../lib/time";
import { notificationTimeSchema } from "../schema";

type NotificationTimePickerProps = {
  noteId: string;
  initialTime: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getCurrentSettingLabel(time: string) {
  return time ? `${time} KST` : "기본 복습 예정 시간";
}

/**
 * 알림 시간 설정 다이얼로그. 트리거는 갖지 않고 열림 상태를 밖에서 받는다.
 * 노트 상세에서는 관리 메뉴(`NoteManageMenu`)의 항목으로 열린다.
 */
export function NotificationTimePicker({
  noteId,
  initialTime,
  open,
  onOpenChange,
}: NotificationTimePickerProps) {
  const inputBaseId = useId();
  const labelId = `${inputBaseId}-label`;
  const hourInputId = `${inputBaseId}-hour`;
  const minuteInputId = `${inputBaseId}-minute`;
  const nativeTimeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const initialInputTime = toInputTime(initialTime);
  const initialTimeParts = getTimeParts(initialInputTime);
  const [period, setPeriod] = useState<PeriodType>(initialTimeParts.period);
  const [hourValue, setHourValue] = useState(initialTimeParts.hour);
  const [minuteValue, setMinuteValue] = useState(initialTimeParts.minute);
  const [savedTime, setSavedTime] = useState(initialInputTime);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSavedOverride = savedTime.length > 0;
  const timeValue = toTimeValue(period, hourValue, minuteValue);
  const hasChanges = timeValue === null || timeValue !== savedTime;
  const isDraftEmpty = hourValue.trim() === "" && minuteValue.trim() === "";
  const periodLabel = period === "am" ? "오전" : "오후";

  const setDraftFromTime = (time: string) => {
    const nextTimeParts = getTimeParts(time);
    setPeriod(nextTimeParts.period);
    setHourValue(nextTimeParts.hour);
    setMinuteValue(nextTimeParts.minute);
  };

  useEffect(() => {
    setSavedTime(initialInputTime);
    const nextTimeParts = getTimeParts(initialInputTime);
    setPeriod(nextTimeParts.period);
    setHourValue(nextTimeParts.hour);
    setMinuteValue(nextTimeParts.minute);
  }, [initialInputTime]);

  // 여는 주체가 밖(`NoteManageMenu`)이라 열 때는 Radix가 onOpenChange를 호출하지 않는다.
  // 열림 자체를 신호로 삼아야 "열 때 초안 초기화"가 닫힘 경로에 의존하지 않는다.
  // savedTime을 deps에 넣으면 저장 직후 effect가 다시 돌아 성공 메시지를 지우므로 ref로 읽는다.
  const savedTimeRef = useRef(savedTime);
  savedTimeRef.current = savedTime;

  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage(null);
    setError(null);
    const nextTimeParts = getTimeParts(savedTimeRef.current);
    setPeriod(nextTimeParts.period);
    setHourValue(nextTimeParts.hour);
    setMinuteValue(nextTimeParts.minute);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    setMessage(null);
    setError(null);
    setDraftFromTime(savedTime);
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

  const saveTime = (nextTime: string | null) => {
    setMessage(null);
    setError(null);

    if (nextTime !== null) {
      const parsed = notificationTimeSchema.safeParse(nextTime);

      if (!parsed.success) {
        setError("알림 시간이 올바르지 않습니다.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await setNotificationTimeAction(noteId, nextTime);

        if (!result.success) {
          setError(result.error);
          return;
        }

        const nextSavedTime = nextTime ?? "";
        setSavedTime(nextSavedTime);
        setDraftFromTime(nextSavedTime);
        setMessage(
          nextTime
            ? `알림 시간이 저장되었습니다. (${nextTime})`
            : "기본 복습 예정 시간을 사용합니다.",
        );
        router.refresh();
      } catch {
        setError(
          "알림 시간 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (timeValue === null) {
      setError("알림 시간이 올바르지 않습니다.");
      return;
    }

    const nextTime = timeValue === "" ? null : timeValue;
    saveTime(nextTime);
  };

  const handleClear = () => {
    saveTime(null);
  };

  const handleNativeTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    setDraftFromTime(event.target.value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>다음 알림 시간 설정</DialogTitle>
            {/* 다이얼로그는 "지금 저장된 값"만 다룬다. 다음 복습 예정 시각은 노트 상세
                헤더가 대부분의 상태에서 함께 보여준다(복습 시점이 이미 지난 경우는 예외).
                DialogDescription이 aria-describedby를 연결한다. */}
            <DialogDescription className="mt-2">
              현재 설정: {getCurrentSettingLabel(savedTime)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="h-8 w-16 rounded-md bg-muted px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clock className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div aria-live="polite" className="min-h-5">
              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="mt-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isPending || (!hasSavedOverride && isDraftEmpty)}
                onClick={handleClear}
              >
                <RotateCcw aria-hidden="true" />
                기본 시간
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
