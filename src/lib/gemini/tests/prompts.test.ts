import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildQuizPrompt,
  getQuestionRange,
  pickPerspective,
  QUIZ_PERSPECTIVES,
} from "../prompts";

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

  it("blank 타입은 영문·음차·약어를 acceptedAnswers에 넣도록 지시한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "blank");

    expect(prompt).toContain("영어 원어와 한글 표기를 반드시 서로 포함");
    expect(prompt).toContain("한글 음차 표기가 여럿이면 모두");
    expect(prompt).toContain("통용되는 약어와 정식 명칭을 함께");
  });

  it("choice 타입은 4지선다 규칙과 JSON 형식을 포함한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "choice");

    expect(prompt).toContain("모든 문제를 4지선다 객관식으로 생성하세요");
    expect(prompt).toContain('"type": "choice"');
    expect(prompt).toContain("options는 반드시 4개");
  });

  it("choice 타입은 0부터 세는 정답 번호 규칙을 명시한다", () => {
    const prompt = buildQuizPrompt("제목", "내용", range, "choice");

    expect(prompt).toContain("0부터 세는 번호");
    expect(prompt).toContain("1부터 세지 마세요");
    expect(prompt).toContain("고르게 분산");
  });

  describe("출제 관점", () => {
    it("관점을 넘기면 프롬프트에 주입한다", () => {
      const perspective = QUIZ_PERSPECTIVES[2];
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        perspective,
      });

      expect(prompt).toContain("## 이번 출제 관점");
      expect(prompt).toContain(perspective);
    });

    it("관점이 없으면 관점 섹션을 넣지 않는다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox");

      expect(prompt).not.toContain("## 이번 출제 관점");
    });

    it("노트에 재료가 없으면 관점을 강요하지 않도록 단서를 단다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        perspective: QUIZ_PERSPECTIVES[0],
      });

      expect(prompt).toContain("규칙 1이 우선");
    });
  });

  describe("이미 출제된 문제", () => {
    it("이전 문제를 목록으로 넣고 재출제를 금지한다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        previousQuestions: ["ALU는 연산을 담당한다.", "레지스터는 느리다."],
      });

      expect(prompt).toContain("## 이미 출제된 문제");
      expect(prompt).toContain("- ALU는 연산을 담당한다.");
      expect(prompt).toContain("- 레지스터는 느리다.");
      expect(prompt).toContain("묻는 대상 자체가 달라야 합니다");
    });

    it("어미만 바꾼 재출제를 명시적으로 막는다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        previousQuestions: ["문제"],
      });

      expect(prompt).toContain("표현·어순·어미만 바꾼 재출제는 금지");
    });

    it("재료가 부족하면 문항 수를 줄이라고 지시한다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        previousQuestions: ["문제"],
      });

      expect(prompt).toContain("문항 수를 줄이세요");
    });

    it("빈 배열이면 섹션을 넣지 않는다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox", {
        previousQuestions: [],
      });

      expect(prompt).not.toContain("## 이미 출제된 문제");
    });

    it("이전 문제가 없으면 섹션을 넣지 않는다", () => {
      const prompt = buildQuizPrompt("제목", "내용", range, "ox");

      expect(prompt).not.toContain("## 이미 출제된 문제");
    });
  });

  it("추가 섹션은 노트 내용 뒤에 온다", () => {
    const prompt = buildQuizPrompt("제목", "노트 본문", range, "ox", {
      perspective: QUIZ_PERSPECTIVES[0],
      previousQuestions: ["이전 문제"],
    });

    expect(prompt.indexOf("노트 본문")).toBeLessThan(
      prompt.indexOf("## 이번 출제 관점"),
    );
    expect(prompt.indexOf("## 이번 출제 관점")).toBeLessThan(
      prompt.indexOf("## 이미 출제된 문제"),
    );
  });
});

describe("pickPerspective", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("정의된 관점 중 하나를 반환한다", () => {
    expect(QUIZ_PERSPECTIVES).toContain(pickPerspective());
  });

  it("난수에 따라 다른 관점을 고른다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickPerspective()).toBe(QUIZ_PERSPECTIVES[0]);

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickPerspective()).toBe(
      QUIZ_PERSPECTIVES[QUIZ_PERSPECTIVES.length - 1],
    );
  });
});
