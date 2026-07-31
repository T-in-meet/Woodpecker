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

/**
 * PostgREST의 LIKE 또는 ILIKE 검색 패턴에 포함된 특수문자를 이스케이프합니다.
 *
 * 사용자 입력의 `\`, `%`, `_`가 와일드카드로 해석되지 않고
 * 일반 문자 그대로 검색되도록 변환합니다.
 *
 * @param value 검색 패턴에 사용할 문자열
 * @returns PostgREST 패턴 특수문자가 이스케이프된 문자열
 */
export function escapePostgrestLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
