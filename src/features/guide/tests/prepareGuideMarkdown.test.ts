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

  it("다른 종류의 펜스는 열린 코드 블록을 닫지 않는다", () => {
    const { headings } = prepareGuideMarkdown(
      "~~~~\n```\n## 코드\n~~~~\n\n## 진짜 절\n",
    );

    expect(headings).toEqual([{ id: "section-1", text: "진짜 절" }]);
  });

  it("같은 문자라도 여는 펜스보다 짧으면 코드 블록을 닫지 않는다", () => {
    const { headings } = prepareGuideMarkdown(
      "````\n```\n## 코드\n````\n\n## 진짜 절\n",
    );

    expect(headings).toEqual([{ id: "section-1", text: "진짜 절" }]);
  });

  it("4칸 이상 들여쓴 펜스 형태는 펜스로 보지 않는다", () => {
    const { headings } = prepareGuideMarkdown("    ```\n\n## 절\n\n    ```\n");

    expect(headings).toEqual([{ id: "section-1", text: "절" }]);
  });

  it("CRLF 본문에서도 H2를 찾는다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "도입\r\n\r\n## 첫 절\r\n\r\n본문\r\n",
    );

    expect(headings).toEqual([{ id: "section-1", text: "첫 절" }]);
    expect(markdown).toContain("## 첫 절 {#section-1}");
    expect(markdown).not.toContain("\r");
  });

  it("차례 텍스트에서는 인라인 마크다운 기호를 걷어낸다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "## `review_round`는 **무엇**인가\n\n## [링크](/guide) 절 {#linked}\n",
    );

    expect(headings).toEqual([
      { id: "section-1", text: "review_round는 무엇인가" },
      { id: "linked", text: "링크 절" },
    ]);
    /* 본문 마크다운은 그대로 두고 앵커만 붙인다. */
    expect(markdown).toContain("## `review_round`는 **무엇**인가 {#section-1}");
  });

  it("H2가 없으면 원문을 그대로 돌려준다", () => {
    const source = "제목 없는 글\n\n문단.";

    expect(prepareGuideMarkdown(source)).toEqual({
      markdown: source,
      headings: [],
    });
  });
});
