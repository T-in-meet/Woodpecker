import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("하나만 고르는 문항이므로 라디오 그룹으로 노출한다", () => {
    render(
      <ChoiceQuestionCard
        question={question}
        onSubmit={vi.fn()}
        submitted={false}
        userAnswer={undefined}
        isCorrect={undefined}
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: question.question }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(question.options.length);
  });

  it("선택지를 고르면 해당 라디오만 선택 상태가 된다", async () => {
    const user = userEvent.setup();

    render(
      <ChoiceQuestionCard
        question={question}
        onSubmit={vi.fn()}
        submitted={false}
        userAnswer={undefined}
        isCorrect={undefined}
      />,
    );

    await user.click(
      screen.getByRole("radio", { name: /항상 left만 이동한다/ }),
    );

    const radios = screen.getAllByRole("radio");
    expect(
      radios.filter((radio) => (radio as HTMLInputElement).checked),
    ).toEqual([screen.getByRole("radio", { name: /항상 left만 이동한다/ })]);
  });

  it("채점 후 정답과 내가 고른 오답을 색 외에 글자로도 구분한다", () => {
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

    // 적록색약에게도 구분되도록 테두리 색 외에 글자 표시가 붙는다.
    const correctOption = screen.getByRole("radio", {
      name: /right를 늘려 조건을 만족시키고/,
    });
    const wrongPick = screen.getByRole("radio", {
      name: /항상 left만 이동한다/,
    });

    expect(correctOption.closest("label")).toHaveTextContent("정답");
    expect(wrongPick.closest("label")).toHaveTextContent("오답");
  });

  it("정답을 맞히면 오답 표시를 붙이지 않는다", () => {
    render(
      <ChoiceQuestionCard
        question={question}
        onSubmit={vi.fn()}
        submitted
        userAnswer="0"
        isCorrect
      />,
    );

    expect(screen.getByText("정답입니다!")).toBeInTheDocument();
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.queryByText("오답")).not.toBeInTheDocument();
  });

  it("채점 후에는 선택을 바꿀 수 없다", () => {
    render(
      <ChoiceQuestionCard
        question={question}
        onSubmit={vi.fn()}
        submitted
        userAnswer="1"
        isCorrect={false}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
