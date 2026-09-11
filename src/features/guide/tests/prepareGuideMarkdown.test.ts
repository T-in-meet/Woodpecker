import { describe, expect, it } from "vitest";

import { prepareGuideMarkdown } from "../lib/prepareGuideMarkdown";

describe("prepareGuideMarkdown", () => {
  it("앵커가 없는 H2에는 순번 id를 붙이고 차례를 만든다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "도입\n\n## 첫 절\n\n본문\n\n## 둘째 절\n",
    );

    expect(headings).toEqual([
      { id: "section-1", text: "첫 절" },
      { id: "section-2", text: "둘째 절" },
    ]);
    expect(markdown).toContain("## 첫 절 {#section-1}");
    expect(markdown).toContain("## 둘째 절 {#section-2}");
  });

  it("명시 앵커는 그대로 두고 차례에도 그 id를 쓴다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "## 첫 절\n\n## 꺼내기 {#retrieval-practice}\n\n## 셋째 절\n",
    );

    expect(headings).toEqual([
      { id: "section-1", text: "첫 절" },
      { id: "retrieval-practice", text: "꺼내기" },
      { id: "section-3", text: "셋째 절" },
    ]);
    expect(markdown).toContain("## 꺼내기 {#retrieval-practice}");
    expect(markdown).not.toContain("{#section-2}");
  });

  it("H3 이하와 코드 블록 안의 ## 는 차례에 넣지 않는다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "## 절\n\n### 소절\n\n```\n## 코드\n```\n",
    );

    expect(headings).toEqual([{ id: "section-1", text: "절" }]);
    expect(markdown).toContain("### 소절\n");
    expect(markdown).not.toContain("## 코드 {#");
  });

  it("H2가 없으면 원문을 그대로 돌려준다", () => {
    const source = "제목 없는 글\n\n문단.";

    expect(prepareGuideMarkdown(source)).toEqual({
      markdown: source,
      headings: [],
    });
  });
});
