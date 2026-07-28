/**
 * 운영 오류 화면에서 날짜와 시간을 한국어 형식으로 표시합니다.
 *
 * @param value ISO 형식의 날짜 문자열
 * @returns 한국어 날짜 및 시간 문자열
 */
export function formatOperationalErrorDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
