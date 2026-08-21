/**
 * 날짜 범위 필터의 시작일을 해당 일자의 00:00 ISO 문자열로 변환합니다.
 *
 * @param value 변환할 날짜
 * @returns 해당 일자의 시작 시각을 나타내는 ISO 문자열
 */
export function startOfDayIsoString(value: Date | string): string {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

/**
 * 날짜 범위 필터의 종료일을 다음 날 00:00 ISO 문자열로 변환합니다.
 *
 * 종료일 전체를 포함하기 위해 `created_at < 다음 날 00:00` 조건에 사용합니다.
 *
 * @param value 변환할 종료 날짜
 * @returns 다음 날의 시작 시각을 나타내는 ISO 문자열
 */
export function nextDayIsoString(value: Date | string): string {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);

  return date.toISOString();
}

export { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";
