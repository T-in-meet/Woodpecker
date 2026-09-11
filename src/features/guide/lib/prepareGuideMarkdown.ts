import { parseHeadingAnchor } from "./headingAnchor";

export type GuideHeading = {
  id: string;
  text: string;
};

export type PreparedGuideMarkdown = {
  /** 모든 H2에 `{#id}` 표기가 붙은 마크다운. 렌더러의 `Heading2`가 그대로 id를 단다. */
  markdown: string;
  /** 차례에 그릴 H2 목록. 문서 순서 그대로다. */
  headings: GuideHeading[];
};

/* 코드 블록 안의 `## `는 제목이 아니다. 펜스 안팎을 구분해 지나간다. */
const FENCE_PATTERN = /^\s*(```|~~~)/;
const H2_PATTERN = /^## (.+)$/;

/**
 * 차례를 만들기 위해 H2 제목을 뽑고, 앵커가 없는 제목에는 순번 id를 붙인다.
 *
 * `parseHeadingAnchor`는 오래 유지할 앵커만 `{#id}`로 명시하고 한국어 제목에서
 * id를 자동 생성하지 않는다. 그 원칙은 두되, 차례에서 절로 이동하려면 모든 H2에
 * id가 있어야 한다. 그래서 명시 앵커가 없는 제목에는 문서 안에서만 쓰는 순번
 * id(`section-N`)를 붙인다. 절을 끼워 넣으면 번호가 밀리므로 외부에서 링크할
 * 절은 여전히 본문에 `{#id}`를 직접 단다.
 */
export function prepareGuideMarkdown(markdown: string): PreparedGuideMarkdown {
  const headings: GuideHeading[] = [];
  let inFence = false;
  let sectionNumber = 0;

  const lines = markdown.split("\n").map((line) => {
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      return line;
    }

    if (inFence) {
      return line;
    }

    const match = line.match(H2_PATTERN);

    if (!match?.[1]) {
      return line;
    }

    sectionNumber += 1;

    const { text, id } = parseHeadingAnchor(match[1]);
    const resolvedId = id ?? `section-${sectionNumber}`;

    headings.push({ id: resolvedId, text });

    return id ? line : `## ${text} {#${resolvedId}}`;
  });

  return { markdown: lines.join("\n"), headings };
}
