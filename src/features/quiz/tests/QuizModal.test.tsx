import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuizModal } from "../components/QuizModal";
import { useQuiz } from "../hooks/useQuiz";

vi.mock("../hooks/useQuiz", () => ({
  useQuiz: vi.fn(),
}));

const startQuiz = vi.fn();
const goToSelect = vi.fn();

function makeQuizState(): ReturnType<typeof useQuiz> {
  return {
    phase: "select",
    isPending: false,
    error: null,
    questions: [],
    currentQuestion: null,
    currentIndex: 0,
    currentAnswer: null,
    answers: [],
    correctCount: 0,
    startQuiz,
    submitAnswer: vi.fn(),
    goToNext: vi.fn(),
    retryQuiz: vi.fn(),
    regenerate: vi.fn(),
    goToSelect,
  };
}

function renderModal() {
  render(
    <QuizModal
      noteId="note-1"
      noteTitle="슬라이딩 윈도우(Sliding Window) 정리"
      open
      onOpenChange={vi.fn()}
    />,
  );
}

describe("QuizModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuiz).mockReturnValue(makeQuizState());
  });

  it("노트와 퀴즈 유형별 설명을 보여준다", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "퀴즈 만들기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("슬라이딩 윈도우(Sliding Window) 정리"),
    ).toBeInTheDocument();
    expect(screen.getByText("핵심을 빠르게 확인해요")).toBeInTheDocument();
    expect(screen.getByText("보기에서 답을 골라요")).toBeInTheDocument();
    expect(screen.getByText("직접 떠올려 완성해요")).toBeInTheDocument();
    expect(
      screen.getByText("유형을 누르면 바로 시작합니다."),
    ).toBeInTheDocument();
  });

  it("선택한 유형으로 퀴즈를 시작한다", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /객관식/ }));

    expect(startQuiz).toHaveBeenCalledWith("choice");
  });
});
