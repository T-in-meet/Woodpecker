import { describe, expect, it } from "vitest";

import type {
  MultipleChoiceQuestion,
  OxQuestion,
  QuizQuestion,
} from "../../schema";
import { shuffleMultipleChoiceOptions } from "../shuffleOptions";

const multipleChoiceQuestion: MultipleChoiceQuestion = {
  type: "multiple_choice",
  question: "HTTP 상태 코드 404의 의미는?",
  options: ["Not Found", "Bad Request", "Forbidden", "Server Error"],
  answer: 0,
  explanation: "404는 리소스를 찾을 수 없다는 의미입니다.",
};

const oxQuestion: OxQuestion = {
  type: "ox",
  question: "HTTP는 상태를 유지하는 프로토콜이다.",
  answer: false,
  explanation: "HTTP는 무상태(stateless) 프로토콜입니다.",
};

describe("shuffleMultipleChoiceOptions", () => {
  it("셔플 후에도 answer 인덱스가 원래 정답 선택지를 가리킨다", () => {
    for (let i = 0; i < 50; i++) {
      const [shuffled] = shuffleMultipleChoiceOptions([
        multipleChoiceQuestion,
      ]) as [MultipleChoiceQuestion];

      expect(shuffled.options[shuffled.answer]).toBe("Not Found");
    }
  });

  it("셔플 후에도 선택지 구성이 그대로 유지된다", () => {
    const [shuffled] = shuffleMultipleChoiceOptions([
      multipleChoiceQuestion,
    ]) as [MultipleChoiceQuestion];

    expect(shuffled.options).toHaveLength(4);
    expect([...shuffled.options].sort()).toEqual(
      [...multipleChoiceQuestion.options].sort(),
    );
  });

  it("원본 질문 객체를 변경하지 않는다", () => {
    shuffleMultipleChoiceOptions([multipleChoiceQuestion]);

    expect(multipleChoiceQuestion.options).toEqual([
      "Not Found",
      "Bad Request",
      "Forbidden",
      "Server Error",
    ]);
    expect(multipleChoiceQuestion.answer).toBe(0);
  });

  it("객관식이 아닌 문제는 그대로 반환한다", () => {
    const questions: QuizQuestion[] = [oxQuestion, multipleChoiceQuestion];

    const result = shuffleMultipleChoiceOptions(questions);

    expect(result[0]).toBe(oxQuestion);
  });
});
