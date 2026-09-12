import { describe, expect, it } from "vitest";

import {
  getNoteSearchPreview,
  highlightSearchText,
} from "../noteSearchPreview";

describe("note search previews", () => {
  it("extracts the first match with 40 preceding and 80 following characters", () => {
    expect(
      getNoteSearchPreview(
        "제목",
        "가".repeat(100) + "검색" + "나".repeat(100),
        "검색",
      ).text,
    ).toBe("…" + "가".repeat(40) + "검색" + "나".repeat(80) + "…");
  });

  it.each([
    ["검색" + "나".repeat(100), "검색" + "나".repeat(80) + "…"],
    ["가".repeat(100) + "검색", "…" + "가".repeat(40) + "검색"],
    ["앞 검색 뒤", "앞 검색 뒤"],
  ])("only marks omitted edges", (content, expected) => {
    expect(getNoteSearchPreview("제목", content, "검색").text).toBe(expected);
  });

  it("preserves emoji at excerpt boundaries", () => {
    expect(
      getNoteSearchPreview(
        "",
        "😀".repeat(41) + "검색" + "😀".repeat(81),
        "검색",
      ).text,
    ).toBe("…" + "😀".repeat(40) + "검색" + "😀".repeat(80) + "…");
  });

  it("uses a leading preview when only the title matches", () => {
    expect(getNoteSearchPreview("React", "가".repeat(150), " react ")).toEqual({
      text: "가".repeat(140) + "…",
      sourceOnlyMatch: false,
    });
  });

  it("explains matches in a removed link destination", () => {
    expect(
      getNoteSearchPreview("제목", "[문서](https://example.com)", "example"),
    ).toEqual({
      text: "문서",
      sourceOnlyMatch: true,
    });
  });

  it("normalizes preview whitespace and removes markdown", () => {
    expect(getNoteSearchPreview("", "**React**\n\n설명", "react")).toEqual({
      text: "React 설명",
      sourceOnlyMatch: false,
    });
  });

  it("leaves ordinary previews unexcerpted", () => {
    const content = "가".repeat(200);
    expect(getNoteSearchPreview("", content, " ")).toEqual({
      text: content,
      sourceOnlyMatch: false,
    });
  });

  it("highlights repeated case-insensitive literal matches", () => {
    expect(highlightSearchText("A+b / a+B / aaab", " a+b ")).toEqual([
      { text: "A+b", matched: true },
      { text: " / ", matched: false },
      { text: "a+B", matched: true },
      { text: " / aaab", matched: false },
    ]);
    expect(highlightSearchText("한글😀", "😀")).toEqual([
      { text: "한글", matched: false },
      { text: "😀", matched: true },
    ]);
  });

  it("does not treat HTML-like input as markup", () => {
    expect(highlightSearchText("<script>text</script>", "<script>")[0]).toEqual(
      { text: "<script>", matched: true },
    );
    expect(highlightSearchText("text", "")).toEqual([
      { text: "text", matched: false },
    ]);
  });
});
