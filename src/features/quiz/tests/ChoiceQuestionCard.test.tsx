import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceQuestionCard } from "../components/ChoiceQuestionCard";
import type { ChoiceQuestion } from "../schema";

const question: ChoiceQuestion = {
  type: "choice",
  question: "가변 크기 윈도우의 동작은?",
  options: [
    "right를 늘려 조건을 만족시키고, 조건이 만족하면 left를 늘린다.",
    "항상 left만 이동한다.",
    "윈도우 크기를 고정한다.",
    "모든 구간을 다시 계산한다.",
  ],
  answer: 0,
  explanation: "오른쪽 포인터로 확장하고 왼쪽 포인터로 축소한다.",
};

describe("ChoiceQuestionCard", () => {
  it("오답이면 정답 선택지의 번호만 안내한다", () => {
    render(
      <ChoiceQuestionCard
        question={question}
        onSubmit={vi.fn()}
        submitted
        userAnswer="1"
        isCorrect={false}
      />,
    );

    expect(screen.getByText("오답입니다.")).toBeInTheDocument();
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.getByText("1번")).toBeInTheDocument();
    // 화면에는 번호만, 스크린리더에는 정답 선택지의 내용까지.
    expect(
      screen.getByText(
        "right를 늘려 조건을 만족시키고, 조건이 만족하면 left를 늘린다.",
        { selector: ".sr-only" },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("정답 선택지")).toBeInTheDocument();
    expect(screen.queryByText("정답: 1번.")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "오답입니다. 정답: right를 늘려 조건을 만족시키고, 조건이 만족하면 left를 늘린다.",
      ),
    ).not.toBeInTheDocument();
  });
});
