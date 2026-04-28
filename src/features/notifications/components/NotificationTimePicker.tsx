"use client";

import { Clock, Loader2, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils/formatDate";

import { setNotificationTimeAction } from "../actions";
import { notificationTimeSchema } from "../schema";

type NotificationTimePickerProps = {
  noteId: string;
  initialTime: string | null;
  nextReviewAt: string | null;
};

function toInputTime(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

function getCurrentSettingLabel(time: string) {
  return time ? `${time} KST` : "기본 복습 예정 시간";
}

export function NotificationTimePicker({
  noteId,
  initialTime,
  nextReviewAt,
}: NotificationTimePickerProps) {
  const inputId = useId();
  const router = useRouter();
  const initialInputTime = toInputTime(initialTime);
  const [timeValue, setTimeValue] = useState(initialInputTime);
  const [savedTime, setSavedTime] = useState(initialInputTime);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSavedOverride = savedTime.length > 0;
  const hasChanges = timeValue !== savedTime;

  useEffect(() => {
    setSavedTime(initialInputTime);
    setTimeValue(initialInputTime);
  }, [initialInputTime]);

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
      const result = await setNotificationTimeAction(noteId, nextTime);

      if (!result.success) {
        setError(result.error);
        return;
      }

      const nextSavedTime = nextTime ?? "";
      setSavedTime(nextSavedTime);
      setTimeValue(nextSavedTime);
      setMessage(
        nextTime
          ? `알림 시간이 저장되었습니다. (${nextTime})`
          : "기본 복습 예정 시간을 사용합니다.",
      );
      router.refresh();
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTime = timeValue.trim() === "" ? null : timeValue;
    saveTime(nextTime);
  };

  const handleClear = () => {
    saveTime(null);
  };

  return (
    <section className="mt-6 rounded-lg border border-border/70 bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            복습 알림 시간
          </h2>
          <p className="text-sm text-muted-foreground">
            현재 설정: {getCurrentSettingLabel(savedTime)}
          </p>
          {nextReviewAt && (
            <p className="text-xs text-muted-foreground">
              다음 복습 예정 {formatDateTime(nextReviewAt)}
            </p>
          )}
        </div>
        <Clock className="mt-0.5 size-4 text-muted-foreground" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="w-full space-y-2 sm:max-w-48">
          <Label htmlFor={inputId}>알림 시간</Label>
          <Input
            id={inputId}
            type="time"
            step={60}
            value={timeValue}
            disabled={isPending}
            onChange={(event) => setTimeValue(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="md" disabled={isPending || !hasChanges}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            저장
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={
              isPending || (!hasSavedOverride && timeValue.length === 0)
            }
            onClick={handleClear}
          >
            <RotateCcw aria-hidden="true" />
            기본 시간
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 min-h-5">
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
