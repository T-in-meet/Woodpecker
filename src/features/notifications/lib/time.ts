import { MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS } from "@/lib/constants/notifications";
import { KST_OFFSET_MS } from "@/lib/constants/time";

export type PeriodType = "am" | "pm";

export type TimePartsType = {
  hour: string;
  minute: string;
  period: PeriodType;
};

export function toInputTime(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

export function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

export function getTimeParts(time: string): TimePartsType {
  if (time === "") {
    return { hour: "", minute: "", period: "am" };
  }

  const [hour = "0", minute = "00"] = time.split(":");
  const hour24 = Number(hour);
  const hour12 = hour24 % 12 || 12;

  return {
    hour: padTimePart(hour12),
    minute,
    period: hour24 >= 12 ? "pm" : "am",
  };
}

export function toTimeValue(period: PeriodType, hour: string, minute: string) {
  const trimmedHour = hour.trim();
  const trimmedMinute = minute.trim();

  if (trimmedHour === "" && trimmedMinute === "") {
    return "";
  }

  const hourNumber = Number(trimmedHour);
  const minuteNumber = Number(trimmedMinute);

  if (
    !Number.isInteger(hourNumber) ||
    !Number.isInteger(minuteNumber) ||
    hourNumber < 1 ||
    hourNumber > 12 ||
    minuteNumber < 0 ||
    minuteNumber > 59
  ) {
    return null;
  }

  const hour24 =
    period === "pm"
      ? hourNumber === 12
        ? 12
        : hourNumber + 12
      : hourNumber === 12
        ? 0
        : hourNumber;

  return `${padTimePart(hour24)}:${padTimePart(minuteNumber)}`;
}

export function getNumericInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function clampTimePart(value: string, min: number, max: number) {
  if (value === "") {
    return "";
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    return "";
  }

  return padTimePart(Math.min(max, Math.max(min, number)));
}

/**
 * 복습 일정은 KST 달력일이 기준이고 달력(react-day-picker)은 브라우저 로컬 Date를
 * 다룬다. 둘을 `YYYY-MM-DD` 키로 이어주되, "시각(instant)"과 "달력이 고른 날짜"는
 * 변환 방식이 다르므로 함수를 나눈다.
 */

/** 특정 시각이 KST에서 며칠인지. `now`나 저장된 scheduled_at에 쓴다. */
export function getKstDateKey(instant: Date) {
  return new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 특정 시각의 KST 벽시계 시각을 `HH:mm`으로. 시간 입력의 초기값에 쓴다. */
export function getKstTimeValue(instant: string | Date) {
  const date = typeof instant === "string" ? new Date(instant) : instant;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * 달력이 고른 Date(로컬 자정)를 날짜 키로 바꾼다.
 * 로컬 타임존이 KST보다 앞선 지역(예: UTC+10)에서는 오프셋을 더하는 방식이
 * 하루씩 밀리므로 로컬 연·월·일을 그대로 읽는다.
 */
export function toDateKey(date: Date) {
  const month = padTimePart(date.getMonth() + 1);
  const day = padTimePart(date.getDate());

  return `${date.getFullYear()}-${month}-${day}`;
}

/** 날짜 키를 달력이 다루는 로컬 자정 Date로 되돌린다. */
export function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * 오늘(KST) ~ +MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS 안의 날짜인지.
 * 날짜 키는 사전순 비교가 곧 날짜 비교라 문자열로 견준다.
 */
export function isWithinScheduleRange(dateKey: string, now = new Date()) {
  const todayKey = getKstDateKey(now);

  return (
    dateKey >= todayKey &&
    dateKey <= addDaysToDateKey(todayKey, MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS)
  );
}

/** KST 날짜 키와 `HH:mm`을 하나의 시각(ISO 문자열)으로 합친다. */
export function toScheduledAt(dateKey: string, time: string) {
  const scheduledAt = new Date(`${dateKey}T${time}:00+09:00`);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.toISOString();
}
