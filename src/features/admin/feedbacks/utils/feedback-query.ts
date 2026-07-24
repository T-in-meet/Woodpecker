/**
 * 목록 테이블에서 표시할 피드백 본문 미리보기 문자열을 생성합니다.
 *
 * 연속된 공백과 줄바꿈을 하나의 공백으로 정규화하고,
 * 최대 길이를 초과하면 말줄임표를 추가합니다.
 *
 * @param content 원본 피드백 본문
 * @returns 목록 화면에 표시할 정규화된 본문 미리보기
 */
export function createFeedbackContentPreview(content: string): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= 80) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 80)}...`;
}

/**
 * PostgREST ilike 패턴에서 와일드카드로 해석되는 문자를 이스케이프합니다.
 *
 * `%`와 `_`가 검색 와일드카드로 동작하지 않고
 * 사용자가 입력한 문자 자체로 검색되도록 변환합니다.
 *
 * @param value 검색에 사용할 원본 문자열
 * @returns PostgREST ilike 조건에 안전하게 사용할 문자열
 */
export function escapePostgrestLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

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
