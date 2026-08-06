import { describe, expect, it } from "vitest";

import { buildQuizPrompt, getQuestionRange } from "../prompts";

describe("getQuestionRange", () => {
  it("min은 노트 길이와 무관하게 항상 3이다", () => {
    expect(getQuestionRange(0).min).toBe(3);
    expect(getQuestionRange(1200).min).toBe(3);
    expect(getQuestionRange(50000).min).toBe(3);
  });

  describe("짧은 노트는 하한(3)으로 고정된다", () => {
    it("빈 내용", () => {
      expect(getQuestionRange(0)).toEqual({ min: 3, max: 3 });
    });

    it("300자 — 계산값 1이지만 하한이 적용된다", () => {
      expect(getQuestionRange(300)).toEqual({ min: 3, max: 3 });
    });

    it("900자 — 계산값이 처음으로 하한과 같아진다", () => {
      expect(getQuestionRange(900)).toEqual({ min: 3, max: 3 });
    });
  });

  describe("중간 길이는 300자당 1문항으로 비례한다", () => {
    it("1050자 — 반올림되어 4", () => {
      expect(getQuestionRange(1050).max).toBe(4);
    });

    it("1200자", () => {
      expect(getQuestionRange(1200).max).toBe(4);
    });

    it("3000자", () => {
      expect(getQuestionRange(3000).max).toBe(10);
    });
  });

  describe("긴 노트는 상한(20)에서 멈춘다", () => {
    it("5999자 — 반올림되어 상한에 도달", () => {
      expect(getQuestionRange(5999).max).toBe(20);
    });

    it("6000자", () => {
      expect(getQuestionRange(6000).max).toBe(20);
    });

    it("50000자 — 노트 최대 길이에서도 20을 넘지 않는다", () => {
      expect(getQuestionRange(50000).max).toBe(20);
    });
  });
});

describe("buildQuizPrompt", () => {
  const range = { min: 3, max: 12 };

  it("문항 수 범위를 프롬프트에 주입한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "ox");

    expect(prompt).toContain("3~12문항");
    expect(prompt).not.toContain("${minQuestions}");
    expect(prompt).not.toContain("${maxQuestions}");
  });

  it("개수를 억지로 채우지 말라는 지침을 포함한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "ox");

    expect(prompt).toContain("억지로 만들지 마세요");
  });

  it("노트 제목과 내용을 포함한다", () => {
    const prompt = buildQuizPrompt("노트 제목", "노트 내용", range, "ox");

    expect(prompt).toContain("노트 제목");
    expect(prompt).toContain("노트 내용");
  });

  it("ox 타입은 OX 규칙과 JSON 형식을 포함한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "ox");

    expect(prompt).toContain("모든 문제를 OX 퀴즈로 생성하세요");
    expect(prompt).toContain('"type": "ox"');
  });

  it("blank 타입은 빈칸 규칙과 JSON 형식을 포함한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "blank");

    expect(prompt).toContain("모든 문제를 빈칸 채우기로 생성하세요");
    expect(prompt).toContain('"type": "blank"');
    expect(prompt).toContain("acceptedAnswers");
  });
});
