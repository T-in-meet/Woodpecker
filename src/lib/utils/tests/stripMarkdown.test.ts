import { describe, expect, it } from "vitest";

import { stripMarkdown } from "../stripMarkdown";

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

  it("태스크 리스트 체크박스를 제거하고 불릿을 남긴다", () => {
    expect(stripMarkdown("- [ ] 미완료 작업")).toBe("• 미완료 작업");
    expect(stripMarkdown("- [x] 완료 작업")).toBe("• 완료 작업");
    expect(stripMarkdown("- [X] 완료 작업")).toBe("• 완료 작업");
  });

  it("remove-markdown이 남긴 잔여 백틱을 제거한다", () => {
    expect(stripMarkdown('`"XSS 공격"`')).toBe('"XSS 공격"');
  });

  it("코드 블록 펜스를 제거하고 내용 텍스트만 남긴다", () => {
    expect(stripMarkdown("```\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("불릿 목록 마커를 기호로 남긴다", () => {
    expect(stripMarkdown("- 항목1")).toBe("• 항목1");
    expect(stripMarkdown("* 항목2")).toBe("• 항목2");
  });

  it("번호 목록은 번호를 그대로 남긴다", () => {
    expect(stripMarkdown("1. 번호항목")).toBe("1. 번호항목");
    expect(stripMarkdown("1. 첫째\n2. 둘째\n3. 셋째")).toBe(
      "1. 첫째\n2. 둘째\n3. 셋째",
    );
  });

  it("중첩 번호 목록은 화면 표기와 같은 a. / i. 마커로 바꾼다", () => {
    const input = "1. 문제\n   1. 보기1\n   2. 보기2\n2. 다음 문제";
    expect(stripMarkdown(input)).toBe(
      "1. 문제\na. 보기1\nb. 보기2\n2. 다음 문제",
    );
  });

  it("중첩 3단계 번호 목록은 로마자 마커를 쓴다", () => {
    const input = "1. 1단계\n   1. 2단계\n      1. 3단계\n      2. 3단계-2";
    const result = stripMarkdown(input);
    expect(result).toContain("i. 3단계");
    expect(result).toContain("ii. 3단계-2");
  });

  it("1이 아닌 번호로 시작하는 목록은 그 번호부터 센다", () => {
    expect(stripMarkdown("100. 항목\n101. 다음")).toBe("100. 항목\n101. 다음");
  });

  it("자릿수가 달라 오른쪽 정렬된 마커도 같은 단계로 센다", () => {
    // tiptap-markdown은 목록 안에서 가장 긴 번호에 맞춰 마커를 오른쪽 정렬한다.
    expect(stripMarkdown(" 9. 항목\n10. 다음\n11. 마지막")).toBe(
      "9. 항목\n10. 다음\n11. 마지막",
    );
  });

  it("중첩 목록의 시작 번호도 유지한다", () => {
    expect(stripMarkdown("1. 상위\n   100. 하위\n   101. 하위2")).toBe(
      "1. 상위\ncv. 하위\ncw. 하위2",
    );

    expect(stripMarkdown("1. 상위\n    9. 하위\n   10. 하위2")).toBe(
      "1. 상위\ni. 하위\nj. 하위2",
    );
  });

  it("중첩 목록 다음에 오는 새 목록은 마커가 길어도 최상위로 본다", () => {
    expect(stripMarkdown("- 상위\n  - 하위\n\n10. 새 목록\n11. 다음")).toBe(
      "• 상위\n◦ 하위\n\n10. 새 목록\n11. 다음",
    );
  });

  it("불릿 목록 안의 번호 목록은 두 번째 깊이 마커를 쓴다", () => {
    expect(stripMarkdown("- 상위\n  1. 하위\n  2. 하위2")).toBe(
      "• 상위\na. 하위\nb. 하위2",
    );
  });

  it("번호 목록 안의 불릿 목록은 두 번째 깊이 기호를 쓴다", () => {
    expect(stripMarkdown("1. 상위\n   - 하위\n   - 하위2")).toBe(
      "1. 상위\n◦ 하위\n◦ 하위2",
    );
  });

  it("중첩 불릿 목록은 깊이별로 다른 기호를 쓴다", () => {
    const input = "- 부모\n  - 자식\n    - 손자";
    const result = stripMarkdown(input);
    expect(result).toContain("• 부모");
    expect(result).toContain("◦ 자식");
    expect(result).toContain("▪ 손자");
  });

  it("CRLF로 저장된 본문에서도 목록 마커를 복원한다", () => {
    const input = [
      "1. 과일",
      "   1. 사과",
      "   2. 바나나",
      "",
      "- 동물",
      "  - 소",
      "  - 돼지",
    ].join("\r\n");

    expect(stripMarkdown(input)).toBe(
      ["1. 과일", "a. 사과", "b. 바나나", "", "• 동물", "◦ 소", "◦ 돼지"].join(
        "\n",
      ),
    );
  });

  it("헤딩 안에 사용자가 직접 쓴 번호는 건드리지 않는다", () => {
    expect(stripMarkdown("# 1. 컴퓨터 네트워크 시작하기")).toBe(
      "1. 컴퓨터 네트워크 시작하기",
    );
  });

  it("문제/보기 형태의 중첩 목록을 화면과 같은 마커로 유지한다", () => {
    const input = [
      "1. 다음 중 웹 3.0의 주요 특징으로 잘못 묶인 것을 고르세요",
      "   1. 탈중앙성, DAO, 개방성",
      "   2. 중앙집중관리, 단방향, 정보제공",
      "2. URL에 대한 설명으로 적절하지 않은 것을 고르세요",
      "   1. 80은 Fragment를 나타낸다",
    ].join("\n");

    expect(stripMarkdown(input)).toBe(
      [
        "1. 다음 중 웹 3.0의 주요 특징으로 잘못 묶인 것을 고르세요",
        "a. 탈중앙성, DAO, 개방성",
        "b. 중앙집중관리, 단방향, 정보제공",
        "2. URL에 대한 설명으로 적절하지 않은 것을 고르세요",
        "a. 80은 Fragment를 나타낸다",
      ].join("\n"),
    );
  });

  it("인용 기호를 제거한다", () => {
    expect(stripMarkdown("> 인용문")).toBe("인용문");
  });

  it("인용문 안의 목록도 마커를 복원한다", () => {
    expect(stripMarkdown("> 1. 인용된 번호")).toBe("1. 인용된 번호");
    expect(stripMarkdown("> - 인용된 불릿")).toBe("• 인용된 불릿");
  });

  it("목록 안 인용문의 목록은 바깥 목록 깊이를 이어서 센다", () => {
    expect(stripMarkdown("- 상위\n\n  > 1. 인용된 하위")).toBe(
      "• 상위\n\na. 인용된 하위",
    );

    expect(stripMarkdown("1. 상위\n\n   > - a\n   > - b")).toBe(
      "1. 상위\n\n◦ a\n◦ b",
    );
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

  it("복합 마크다운을 텍스트로 변환한다", () => {
    const input = "# 제목\n\n**굵게** 텍스트\n- 항목1\n> 인용\n\n`코드` 끝";
    const result = stripMarkdown(input);
    expect(result).toContain("제목");
    expect(result).toContain("굵게");
    expect(result).toContain("텍스트");
    expect(result).toContain("항목1");
    expect(result).toContain("인용");
    expect(result).toContain("코드");
    expect(result).not.toContain("**");
    expect(result).not.toContain("# ");
    expect(result).not.toContain("> ");
    expect(result).not.toContain("`");
    expect(result).not.toMatch(/ {2,}/);
  });
});
