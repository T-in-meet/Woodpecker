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
