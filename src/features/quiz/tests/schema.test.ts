import { describe, expect, it } from "vitest";

import { quizQuestionSchema, quizResponseSchemaFor } from "../schema";

const validChoice = {
  type: "choice",
  question: "CPU의 산술 연산을 담당하는 장치는?",
  options: ["ALU", "제어 장치", "레지스터", "버스"],
  answer: 0,
  explanation: "ALU는 산술논리연산장치다.",
};

const validOx = {
  type: "ox",
  question: "ALU는 산술 연산을 담당한다.",
  answer: true,
  explanation: "맞다.",
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

describe("choiceQuestionSchema — 선택지 중복", () => {
  it("같은 선택지가 둘이면 거부한다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validChoice,
      options: ["ALU", "ALU", "레지스터", "버스"],
    });

    expect(result.success).toBe(false);
  });
});

describe("blankQuestionSchema", () => {
  const validBlank = {
    type: "blank",
    question: "CPU의 동작 속도를 나타내는 단위는 ____이다.",
    answer: "클럭",
    acceptedAnswers: ["clock"],
    explanation: "클럭이다.",
  };

  it("빈칸이 있는 문항을 통과시킨다", () => {
    const result = quizQuestionSchema.safeParse(validBlank);

    expect(result.success).toBe(true);
  });

  it("빈칸이 없으면 거부한다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validBlank,
      question: "CPU의 동작 속도를 나타내는 단위는?",
    });

    expect(result.success).toBe(false);
  });

  it("밑줄 개수가 달라도 통과시킨다", () => {
    const result = quizQuestionSchema.safeParse({
      ...validBlank,
      question: "CPU의 동작 속도를 나타내는 단위는 __이다.",
    });

    expect(result.success).toBe(true);
  });

  it("acceptedAnswers가 없으면 빈 배열로 채운다", () => {
    const { acceptedAnswers: _omitted, ...withoutAccepted } = validBlank;
    const result = quizQuestionSchema.safeParse(withoutAccepted);

    expect(result.success).toBe(true);
    expect(
      result.success && result.data.type === "blank"
        ? result.data.acceptedAnswers
        : null,
    ).toEqual([]);
  });
});

describe("quizResponseSchemaFor", () => {
  it("객관식 문항 배열을 통과시킨다", () => {
    const result = quizResponseSchemaFor("choice").safeParse({
      questions: [validChoice],
    });

    expect(result.success).toBe(true);
  });

  it("20문항까지 허용한다", () => {
    const result = quizResponseSchemaFor("choice").safeParse({
      questions: Array.from({ length: 20 }, () => validChoice),
    });

    expect(result.success).toBe(true);
  });

  it("20문항을 넘으면 거부한다", () => {
    const result = quizResponseSchemaFor("choice").safeParse({
      questions: Array.from({ length: 21 }, () => validChoice),
    });

    expect(result.success).toBe(false);
  });

  it("요청한 유형과 다른 문항은 거부한다", () => {
    const result = quizResponseSchemaFor("ox").safeParse({
      questions: [validChoice],
    });

    expect(result.success).toBe(false);
  });

  it("한 문항만 유형이 달라도 거부한다", () => {
    const result = quizResponseSchemaFor("ox").safeParse({
      questions: [validOx, validChoice],
    });

    expect(result.success).toBe(false);
  });

  it("OX 문항 배열은 ox 스키마로 통과시킨다", () => {
    const result = quizResponseSchemaFor("ox").safeParse({
      questions: [validOx],
    });

    expect(result.success).toBe(true);
  });
});
