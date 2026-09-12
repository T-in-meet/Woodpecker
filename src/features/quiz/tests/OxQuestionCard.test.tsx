import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OxQuestionCard } from "../components/OxQuestionCard";
import type { OxQuestion } from "../schema";

const question: OxQuestion = {
  type: "ox",
  question: "ALU는 산술 연산을 담당한다.",
  answer: true,
  explanation: "맞다.",
};

function renderCard(props: Partial<Parameters<typeof OxQuestionCard>[0]> = {}) {
  const onSubmit = vi.fn();

  render(
    <OxQuestionCard
      question={question}
      onSubmit={onSubmit}
      submitted={false}
      userAnswer={undefined}
      isCorrect={undefined}
      {...props}
    />,
  );

  return { onSubmit };
}

describe("OxQuestionCard", () => {
  it("하나만 고르는 문항이므로 라디오 그룹으로 노출한다", () => {
    renderCard();

    expect(
      screen.getByRole("radiogroup", { name: question.question }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  // 기호만 있는 선택지라 lucide가 aria-hidden을 붙인다. 이름이 없으면 두 선택지를 구분할 수 없다.
  it("O·X 선택지에 접근 가능한 이름이 있다", () => {
    renderCard();

    expect(screen.getByRole("radio", { name: "O, 맞다" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "X, 틀리다" }),
    ).toBeInTheDocument();
  });

  it("선택한 값을 제출한다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByRole("radio", { name: "X, 틀리다" }));
    await user.click(screen.getByRole("button", { name: "정답 확인" }));

    expect(onSubmit).toHaveBeenCalledWith("false");
  });

  it("제출 전에는 정답 확인 버튼이 비활성이다", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "정답 확인" })).toBeDisabled();
  });

  it("제출 후에는 선택을 바꿀 수 없다", () => {
    renderCard({ submitted: true, userAnswer: "true", isCorrect: true });

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("채점 후 정답과 내가 고른 오답을 색 외에 글자로도 구분한다", () => {
    renderCard({ submitted: true, userAnswer: "false", isCorrect: false });

    // 적록색약에게도 구분되도록 테두리 색 외에 글자 표시가 붙는다.
    expect(
      screen.getByRole("radio", { name: /O, 맞다/ }).closest("label"),
    ).toHaveTextContent("정답");
    expect(
      screen.getByRole("radio", { name: /X, 틀리다/ }).closest("label"),
    ).toHaveTextContent("오답");
  });

  it("정답을 맞히면 오답 표시를 붙이지 않는다", () => {
    renderCard({ submitted: true, userAnswer: "true", isCorrect: true });

    expect(screen.getByText("정답입니다!")).toBeInTheDocument();
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.queryByText("오답")).not.toBeInTheDocument();
  });
});
