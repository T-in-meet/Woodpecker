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
const goToPrevious = vi.fn();

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
    goToPrevious,
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

  it("노트와 간결한 퀴즈 유형 선택지를 보여준다", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "퀴즈 만들기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("슬라이딩 윈도우(Sliding Window) 정리"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OX 퀴즈" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "객관식 문제" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "빈칸 채우기" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("핵심을 빠르게 확인해요"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("보기에서 답을 골라요")).not.toBeInTheDocument();
    expect(screen.queryByText("직접 떠올려 완성해요")).not.toBeInTheDocument();
    expect(
      screen.getByText("유형을 누르면 바로 시작합니다."),
    ).toBeInTheDocument();
  });

  it("선택한 유형으로 퀴즈를 시작한다", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "객관식 문제" }));

    expect(startQuiz).toHaveBeenCalledWith("choice");
  });

  it("답안을 제출하기 전에도 다음 문제 버튼을 비활성 상태로 보여준다", () => {
    const question = {
      type: "ox" as const,
      question: "ALU는 산술 연산을 담당한다.",
      answer: true,
      explanation: "맞다.",
    };

    vi.mocked(useQuiz).mockReturnValue({
      ...makeQuizState(),
      phase: "playing",
      questions: [question, question],
      currentQuestion: question,
    });

    renderModal();

    expect(screen.getByRole("button", { name: "다음 문제 →" })).toBeDisabled();
  });
});
