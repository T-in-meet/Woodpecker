import { describe, expect, it } from "vitest";

import { stripMarkdown } from "./stripMarkdown";

describe("stripMarkdown", () => {
  it("헤딩 기호를 제거한다", () => {
    expect(stripMarkdown("# 제목")).toBe("제목");
    expect(stripMarkdown("## 소제목")).toBe("소제목");
    expect(stripMarkdown("### 세부제목")).toBe("세부제목");
  });

  it("굵게/기울임 기호를 제거한다", () => {
    expect(stripMarkdown("**굵게**")).toBe("굵게");
    expect(stripMarkdown("*기울임*")).toBe("기울임");
    expect(stripMarkdown("***굵은기울임***")).toBe("굵은기울임");
  });

  it("링크 문법에서 텍스트만 남긴다", () => {
    expect(stripMarkdown("[링크텍스트](https://example.com)")).toBe(
      "링크텍스트",
    );
  });

  it("인라인 코드 기호를 제거한다", () => {
    expect(stripMarkdown("`코드`")).toBe("코드");
  });

  it("태스크 리스트 체크박스를 제거한다", () => {
    expect(stripMarkdown("- [ ] 미완료 작업")).toBe("미완료 작업");
    expect(stripMarkdown("- [x] 완료 작업")).toBe("완료 작업");
  });

  it("remove-markdown이 남긴 잔여 백틱을 제거한다", () => {
    expect(stripMarkdown('`"XSS 공격"`')).toBe('"XSS 공격"');
  });

  it("코드 블록 펜스를 제거하고 내용 텍스트만 남긴다", () => {
    expect(stripMarkdown("```\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("목록 마커를 제거한다", () => {
    expect(stripMarkdown("- 항목1")).toBe("항목1");
    expect(stripMarkdown("* 항목2")).toBe("항목2");
    expect(stripMarkdown("1. 번호항목")).toBe("번호항목");
  });

  it("인용 기호를 제거한다", () => {
    expect(stripMarkdown("> 인용문")).toBe("인용문");
  });

  it("마크다운이 없는 평문은 그대로 반환한다", () => {
    expect(stripMarkdown("일반 텍스트입니다.")).toBe("일반 텍스트입니다.");
  });

  it("표 구분선 행을 제거한다", () => {
    const table = "| 년도 | 2025 |\n| --- | --- |\n| 매출액 | 10 |";
    const result = stripMarkdown(table);
    expect(result).not.toContain("---");
    expect(result).not.toContain("|");
    expect(result).toContain("년도");
    expect(result).toContain("매출액");
  });

  it("빈 문자열을 반환한다", () => {
    expect(stripMarkdown("")).toBe("");
  });
});
