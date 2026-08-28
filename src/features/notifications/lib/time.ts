import { KST_OFFSET_MS } from "@/lib/constants/time";

export type PeriodType = "am" | "pm";

export type TimePartsType = {
  hour: string;
  minute: string;
  period: PeriodType;
};

export type DatePartsType = {
  year: string;
  month: string;
  day: string;
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

export function getNumericInput(value: string, maxLength = 2) {
  return value.replace(/\D/g, "").slice(0, maxLength);
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
 * 복습 일정은 KST 달력일이 기준이다. 날짜 입력은 브라우저 타임존과 무관하게
 * `YYYY-MM-DD` 문자열 키로만 다루고, 저장된 시각(instant)과의 변환은 아래 헬퍼들이
 * 담당한다.
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

/** 날짜 키를 표기용 로컬 자정 Date로 되돌린다. `date-fns`의 `format`에 넘겨 쓴다. */
export function fromDateKey(dateKey: string) {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const [year = 0, month = 0, day = 0] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function getDateParts(dateKey: string): DatePartsType {
  const [year = "", month = "", day = ""] = dateKey.split("-");

  return { year, month, day };
}

export function toDateKey(year: string, month: string, day: string) {
  const dateKey = `${year}-${month}-${day}`;

  return isValidDateKey(dateKey) ? dateKey : null;
}

export function isValidDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }

  const [year = 0, month = 0, day = 0] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** 오늘(KST) 또는 그 이후의 유효한 날짜인지. */
export function isScheduleDateOnOrAfterToday(
  dateKey: string,
  now = new Date(),
) {
  const todayKey = getKstDateKey(now);

  return isValidDateKey(dateKey) && dateKey >= todayKey;
}

/** KST 날짜 키와 `HH:mm`을 하나의 시각(ISO 문자열)으로 합친다. */
export function toScheduledAt(dateKey: string, time: string) {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const scheduledAt = new Date(`${dateKey}T${time}:00+09:00`);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.toISOString();
}
