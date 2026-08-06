import { describe, expect, it } from "vitest";

import { gradeBlankAnswer, normalizeAnswer } from "../grading";

describe("normalizeAnswer", () => {
  it("앞뒤 공백을 제거한다", () => {
    expect(normalizeAnswer("  레지스터  ")).toBe("레지스터");
  });

  it("대소문자를 통일한다", () => {
    expect(normalizeAnswer("Register")).toBe("register");
  });

  it("중간 공백을 제거한다", () => {
    expect(normalizeAnswer("main memory")).toBe("mainmemory");
  });

  it("문장부호를 제거한다", () => {
    expect(normalizeAnswer("레지스터.")).toBe("레지스터");
  });

  it("하이픈과 언더스코어를 제거한다", () => {
    expect(normalizeAnswer("e-mail")).toBe("email");
    expect(normalizeAnswer("page_fault")).toBe("pagefault");
  });

  it("가운뎃점을 제거한다", () => {
    expect(normalizeAnswer("산술·논리")).toBe("산술논리");
  });
});

describe("gradeBlankAnswer", () => {
  it("정답과 정확히 일치하면 통과한다", () => {
    expect(gradeBlankAnswer("레지스터", "레지스터", [])).toBe(true);
  });

  it("빈 입력은 오답이다", () => {
    expect(gradeBlankAnswer("   ", "레지스터", ["register"])).toBe(false);
  });

  it("틀린 답은 오답이다", () => {
    expect(gradeBlankAnswer("캐시", "레지스터", ["register"])).toBe(false);
  });

  describe("acceptedAnswers", () => {
    it("영어 원어 입력을 정답으로 인정한다", () => {
      expect(gradeBlankAnswer("register", "레지스터", ["register"])).toBe(true);
    });

    it("대소문자가 달라도 인정한다", () => {
      expect(gradeBlankAnswer("REGISTER", "레지스터", ["register"])).toBe(true);
    });

    it("음차 표기 변형을 인정한다", () => {
      expect(gradeBlankAnswer("클락", "클럭", ["clock", "클락", "클록"])).toBe(
        true,
      );
    });

    it("약어를 인정한다", () => {
      expect(gradeBlankAnswer("db", "데이터베이스", ["DB", "database"])).toBe(
        true,
      );
    });

    it("띄어쓰기가 달라도 인정한다", () => {
      expect(
        gradeBlankAnswer("MainMemory", "주기억장치", ["main memory"]),
      ).toBe(true);
    });

    it("acceptedAnswers가 비어 있으면 정답만 인정한다", () => {
      expect(gradeBlankAnswer("register", "레지스터", [])).toBe(false);
    });
  });
});
