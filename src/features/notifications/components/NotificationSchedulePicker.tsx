"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

import {
  setNotificationScheduleAction,
  setNotificationTimeAction,
} from "../actions";
import {
  addDaysToDateKey,
  fromDateKey,
  getKstDateKey,
  getKstTimeValue,
  getTimeParts,
  toInputTime,
} from "../lib/time";
import { notificationTimeSchema } from "../schema";
import { ResponsiveDateInput } from "./ResponsiveDateInput";
import { ResponsiveTimePicker } from "./ResponsiveTimePicker";

export type NotificationSchedulePickerProps = {
  noteId: string;
  /** 사용자가 지정한 알림 시각(`notification_time_of_day`). 없으면 기본 일정을 따른다. */
  initialTime: string | null;
  /** 다음 알림이 실제로 나갈 시각. 날짜 입력의 초기값이 된다. */
  initialScheduledAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 빠른 선택 칩. 날짜를 직접 입력하지 않고 끝나는 흔한 경우를 먼저 처리한다. */
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
  const router = useRouter();

  // 다이얼로그를 열 때 부모 상태가 바뀌어 다시 렌더되므로, 페이지를 오래 열어 둬도
  // KST 기준 오늘이 이전 마운트 시각에 고정되지 않는다.
  const todayKey = getKstDateKey(new Date());

  const savedDateKey = useMemo(
    () =>
      initialScheduledAt
        ? getKstDateKey(new Date(initialScheduledAt))
        : todayKey,
    [initialScheduledAt, todayKey],
  );
  const savedTime = useMemo(
    () =>
      initialScheduledAt
        ? getKstTimeValue(initialScheduledAt)
        : toInputTime(initialTime),
    [initialScheduledAt, initialTime],
  );

  const [dateKey, setDateKey] = useState(savedDateKey);
  const [timeValue, setTimeValue] = useState(savedTime);
  const [isDateInputValid, setIsDateInputValid] = useState(
    savedDateKey >= todayKey,
  );
  const [isTimeInputValid, setIsTimeInputValid] = useState(
    notificationTimeSchema.safeParse(savedTime).success,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSavedOverride = toInputTime(initialTime).length > 0;
  const hasChanges = timeValue !== savedTime || dateKey !== savedDateKey;

  const quickOffsetKeys = useMemo(
    () =>
      QUICK_OFFSETS.map((offset) => ({
        ...offset,
        dateKey: addDaysToDateKey(todayKey, offset.days),
      })),
    [todayKey],
  );

  const resetDraft = () => {
    setDateKey(savedDateKey);
    setTimeValue(savedTime);
    setIsDateInputValid(savedDateKey >= todayKey);
    setIsTimeInputValid(notificationTimeSchema.safeParse(savedTime).success);
  };

  // 여는 주체가 밖(`NoteManageMenu`)이라 열 때는 Radix가 onOpenChange를 호출하지 않는다.
  // 열림 자체를 신호로 삼아야 "열 때 메시지 비우기"가 닫힘 경로에 의존하지 않는다.
  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage(null);
    setError(null);
  }, [open]);

  // 초안은 저장된 값이 바뀔 때마다 다시 맞춘다. 저장 성공 직후에는 초안과 서버 값이
  // 같아 no-op이지만, "기본 일정"으로 되돌린 뒤에는 복원된 케이던스가 휠·시간 입력·
  // 미리보기에 그대로 반영돼야 성공 메시지와 화면이 어긋나지 않는다.
  useEffect(() => {
    if (!open) {
      return;
    }

    setDateKey(savedDateKey);
    setTimeValue(savedTime);
    setIsDateInputValid(savedDateKey >= todayKey);
    setIsTimeInputValid(notificationTimeSchema.safeParse(savedTime).success);
  }, [open, savedDateKey, savedTime, todayKey]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    setMessage(null);
    setError(null);
    resetDraft();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (
      !isTimeInputValid ||
      !notificationTimeSchema.safeParse(timeValue).success
    ) {
      setError("알림 시간이 올바르지 않습니다.");
      return;
    }

    if (!isDateInputValid) {
      setError("알림 날짜가 올바르지 않습니다.");
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

  const handleTimeChange = (nextTimeValue: string) => {
    setMessage(null);
    setError(null);
    setTimeValue(nextTimeValue);
  };

  const handleTimeValidityChange = (isValid: boolean) => {
    setMessage(null);
    setError(null);
    setIsTimeInputValid(isValid);
  };

  const handleSelectDateKey = (nextDateKey: string) => {
    setMessage(null);
    setError(null);
    setDateKey(nextDateKey);
    setIsDateInputValid(true);
  };

  const handleDateValidityChange = (isValid: boolean) => {
    setMessage(null);
    setError(null);
    setIsDateInputValid(isValid);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <DialogContent className="max-w-sm p-4 sm:p-5">
          <DialogHeader className="mb-3">
            <DialogTitle>다음 복습 일정 변경</DialogTitle>
            <DialogDescription className="mt-1.5">
              현재 설정:{" "}
              {formatScheduleLabel(savedDateKey, savedTime) ??
                "기본 복습 예정 시간"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {quickOffsetKeys.map((offset) => {
                const isSelected = dateKey === offset.dateKey;

                return (
                  <Button
                    key={offset.label}
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-pressed={isSelected}
                    disabled={isPending}
                    className={cn(isSelected && "bg-muted text-foreground")}
                    onClick={() => {
                      handleSelectDateKey(offset.dateKey);
                    }}
                  >
                    {offset.label}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label>날짜</Label>
              <ResponsiveDateInput
                value={dateKey}
                min={todayKey}
                disabled={isPending}
                onValueChange={handleSelectDateKey}
                onValidityChange={handleDateValidityChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label>알림 시간</Label>
              <ResponsiveTimePicker
                value={timeValue}
                disabled={isPending}
                onValueChange={handleTimeChange}
                onValidityChange={handleTimeValidityChange}
              />
            </div>

            <div aria-live="polite">
              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="mt-2 flex-row items-center justify-between gap-2 pt-4">
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
                  disabled={
                    isPending ||
                    !hasChanges ||
                    !isDateInputValid ||
                    !isTimeInputValid
                  }
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
