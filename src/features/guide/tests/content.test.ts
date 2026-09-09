import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  findGuideDocument,
  getPublishedGuideDocuments,
  GUIDE_DOCUMENTS,
  isGuidePublished,
  isPublishedGuide,
} from "../content";
import { getGuideMarkdownPath } from "../lib/readGuideMarkdown";

describe("GUIDE_DOCUMENTS", () => {
  it("slug가 중복되지 않는다", () => {
    const slugs = GUIDE_DOCUMENTS.map((document) => document.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("모든 문서에 본문 마크다운 파일이 있다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      expect(
        existsSync(getGuideMarkdownPath(document.slug)),
        `${document.slug}.md 없음`,
      ).toBe(true);
    }
  });

  /* 렌더러에 rehype-raw가 없어 원시 HTML이 걸러지지 않는다. 본문에 남긴 HTML 주석은
     제거되지 않고 화면에 텍스트로 그대로 나온다. 작성 메모는 README.md에 둔다. */
  it("본문에 HTML 주석을 두지 않는다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      const markdown = readFileSync(
        getGuideMarkdownPath(document.slug),
        "utf8",
      );

      expect(markdown, `${document.slug}.md`).not.toContain("<!--");
    }
  });

  /* CommonMark에서 닫는 `**`는 right-flanking일 때만 강조를 닫는다. 앞 글자가
     문장부호이고 뒤 글자가 문자면 조건을 만족하지 못해 `**`가 그대로 화면에 남는다.
     예: `**간격 반복(spaced repetition)**이라고` — `)` 다음의 `**`가 닫지 못한다.
     영어는 닫는 `**` 뒤에 공백이 오는 게 보통이라 잘 드러나지 않지만, 한국어는
     조사가 바로 붙어서 자주 걸린다. 강조 범위에서 문장부호를 빼면 해결된다.
     예: `**간격 반복**(spaced repetition)이라고` */
  it("닫는 ** 앞에 문장부호를 두지 않는다", () => {
    const brokenBold = /[)\]."'’”」』,!?]\*\*(?=[\p{L}\p{N}])/u;

    for (const document of GUIDE_DOCUMENTS) {
      const markdown = readFileSync(
        getGuideMarkdownPath(document.slug),
        "utf8",
      );

      expect(brokenBold.test(markdown), `${document.slug}.md`).toBe(false);
    }
  });

  /* H1은 페이지 컴포넌트가 heading으로 렌더링한다. 본문에도 두면 H1이 둘이 된다. */
  it("본문은 H2부터 시작한다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      const markdown = readFileSync(
        getGuideMarkdownPath(document.slug),
        "utf8",
      );

      expect(markdown, `${document.slug}.md`).not.toMatch(/^# /m);
    }
  });

  it("검색 결과에 쓰이는 문구가 비어 있지 않다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      expect(document.title.length).toBeGreaterThan(0);
      expect(document.heading.length).toBeGreaterThan(0);
      expect(document.description.length).toBeGreaterThan(0);
      expect(document.summary.length).toBeGreaterThan(0);
    }
  });

  /* title에는 브랜드 접미사를 넣지 않는다. 루트 레이아웃의 title.template이
     "%s | 딱다구리"를 붙이므로 여기 넣으면 브랜드가 두 번 들어간다. */
  it("title에 브랜드 접미사를 넣지 않는다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      expect(document.title).not.toContain("딱다구리");
    }
  });

  it("revisedOn은 없거나 YYYY-MM-DD 형식이다", () => {
    for (const document of GUIDE_DOCUMENTS) {
      if (document.revisedOn === null) {
        continue;
      }

      expect(document.revisedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("공개 여부 판정", () => {
  it("revisedOn이 없는 문서는 미공개다", () => {
    expect(
      isPublishedGuide({
        slug: "draft",
        title: "제목",
        heading: "제목",
        description: "설명",
        summary: "요약",
        revisedOn: null,
      }),
    ).toBe(false);
  });

  it("revisedOn이 있으면 공개다", () => {
    expect(
      isPublishedGuide({
        slug: "draft",
        title: "제목",
        heading: "제목",
        description: "설명",
        summary: "요약",
        revisedOn: "2026-09-09",
      }),
    ).toBe(true);
  });

  it("getPublishedGuideDocuments는 미공개 문서를 제외한다", () => {
    for (const document of getPublishedGuideDocuments()) {
      expect(document.revisedOn).not.toBeNull();
    }
  });

  it("없는 slug는 공개로 보지 않는다", () => {
    expect(isGuidePublished("no-such-guide")).toBe(false);
    expect(findGuideDocument("no-such-guide")).toBeUndefined();
  });
});
