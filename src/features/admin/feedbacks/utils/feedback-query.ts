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
