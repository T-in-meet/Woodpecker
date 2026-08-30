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
