/**
 * 전달된 날짜가 속한 로컬 시간대의 시작 시각을 ISO 문자열로 반환합니다.
 *
 * 시, 분, 초와 밀리초를 모두 0으로 설정한 뒤 UTC 기준 ISO 문자열로 변환합니다.
 *
 * @param date 시작 시각을 계산할 날짜
 * @returns 해당 날짜의 로컬 자정에 대응하는 ISO 문자열
 */
export function startOfDayIsoString(date: Date) {
  const next = new Date(date);

  next.setHours(0, 0, 0, 0);

  return next.toISOString();
}

/**
 * 전달된 날짜의 다음 날 시작 시각을 ISO 문자열로 반환합니다.
 *
 * 날짜 범위 조회에서 종료일을 포함하기 위한 배타적 상한값으로 사용할 수 있습니다.
 * 예를 들어 특정 날짜까지 조회할 때 `lt` 조건과 함께 사용합니다.
 *
 * @param date 다음 날 시작 시각을 계산할 날짜
 * @returns 다음 날 로컬 자정에 대응하는 ISO 문자열
 */
export function nextDayIsoString(date: Date) {
  const next = new Date(date);

  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);

  return next.toISOString();
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
export function escapePostgrestLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
