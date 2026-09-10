/**
 * 제목 끝의 `{#id}` 표기를 앵커 id로 뽑아낸다.
 *
 * 예: `## 무엇을 반복해야 할까 {#retrieval-practice}`
 *
 * 제목 텍스트에서 id를 자동 생성하지 않는 이유는 두 가지다. 본문이 한국어라 자동
 * 슬러그가 퍼센트 인코딩된 URL이 되고, 제목 문구를 다듬을 때마다 앵커가 조용히
 * 바뀌어 외부에 걸린 링크가 끊긴다. 오래 유지할 앵커만 명시적으로 단다.
 */
const HEADING_ANCHOR_PATTERN = /\s*\{#([a-z0-9-]+)\}\s*$/;

export type ParsedHeading = {
  text: string;
  id?: string;
};

export function parseHeadingAnchor(text: string): ParsedHeading {
  const match = text.match(HEADING_ANCHOR_PATTERN);

  if (!match?.[1]) {
    return { text };
  }

  return { text: text.replace(HEADING_ANCHOR_PATTERN, ""), id: match[1] };
}
