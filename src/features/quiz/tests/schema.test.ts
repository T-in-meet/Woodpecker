import { describe, expect, it } from "vitest";

import { quizQuestionSchema, quizResponseSchema } from "../schema";

const validChoice = {
  type: "choice",
  question: "CPU의 산술 연산을 담당하는 장치는?",
  options: ["ALU", "제어 장치", "레지스터", "버스"],
  answer: 0,
  explanation: "ALU는 산술논리연산장치다.",
};

describe("choiceQuestionSchema", () => {
  it("정상 객관식 문항을 통과시킨다", () => {
    const result = quizQuestionSchema.safeParse(validChoice);

    expect(result.success).toBe(true);
  });

  it("마지막 선택지(3)도 정답 번호로 허용한다", () => {
    const result = quizQuestionSchema.safeParse({ ...validChoice, answer: 3 });

    expect(result.success).toBe(true);
  });

  it("선택지가 4개가 아니면 거부한다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validChoice,
      options: ["ALU", "제어 장치", "레지스터"],
    });

    expect(result.success).toBe(false);
  });

  it("1부터 센 정답 번호(4)는 범위를 벗어나 거부한다", () => {
    const result = quizQuestionSchema.safeParse({ ...validChoice, answer: 4 });

    expect(result.success).toBe(false);
  });

  it("정답 번호가 음수면 거부한다", () => {
    const result = quizQuestionSchema.safeParse({ ...validChoice, answer: -1 });

    expect(result.success).toBe(false);
  });

  it("정답 번호가 정수가 아니면 거부한다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validChoice,
      answer: 1.5,
    });

    expect(result.success).toBe(false);
  });

  it("빈 선택지 문자열은 거부한다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validChoice,
      options: ["ALU", "", "레지스터", "버스"],
    });

    expect(result.success).toBe(false);
  });
});

describe("quizResponseSchema", () => {
  it("객관식 문항 배열을 통과시킨다", () => {
    const result = quizResponseSchema.safeParse({ questions: [validChoice] });

    expect(result.success).toBe(true);
  });

  it("20문항까지 허용한다", () => {
    const result = quizResponseSchema.safeParse({
      questions: Array.from({ length: 20 }, () => validChoice),
    });

    expect(result.success).toBe(true);
  });

  it("20문항을 넘으면 거부한다", () => {
    const result = quizResponseSchema.safeParse({
      questions: Array.from({ length: 21 }, () => validChoice),
    });

    expect(result.success).toBe(false);
  });
});
