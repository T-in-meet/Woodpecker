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
  // 아이콘만 있는 버튼이라 lucide가 aria-hidden을 붙인다. 이름이 없으면 두 선택지를 구분할 수 없다.
  it("O·X 버튼에 접근 가능한 이름이 있다", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "O, 맞다" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "X, 틀리다" }),
    ).toBeInTheDocument();
  });

  it("선택한 값을 제출한다", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByRole("button", { name: "X, 틀리다" }));
    await user.click(screen.getByRole("button", { name: "정답 확인" }));

    expect(onSubmit).toHaveBeenCalledWith("false");
  });

  it("제출 전에는 정답 확인 버튼이 비활성이다", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "정답 확인" })).toBeDisabled();
  });

  it("제출 후에는 선택 버튼을 누를 수 없다", () => {
    renderCard({ submitted: true, userAnswer: "true", isCorrect: true });

    expect(screen.getByRole("button", { name: "O, 맞다" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "X, 틀리다" })).toBeDisabled();
  });
});
