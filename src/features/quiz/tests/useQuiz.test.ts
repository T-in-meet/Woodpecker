import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuizQuestion } from "../schema";

vi.mock("../actions", () => ({
  generateQuiz: vi.fn(),
  regenerateQuiz: vi.fn(),
}));

const { generateQuiz } = await import("../actions");
const { useQuiz } = await import("../hooks/useQuiz");

const generateQuizMock = vi.mocked(generateQuiz);

const questions: QuizQuestion[] = [
  {
    type: "ox",
    question: "ALU는 산술 연산을 담당한다.",
    answer: true,
    explanation: "맞다.",
  },
  {
    type: "ox",
    question: "프로그램 카운터는 데이터를 저장한다.",
    answer: false,
    explanation: "주소를 저장한다.",
  },
];

function mockSuccess() {
  generateQuizMock.mockResolvedValue({ data: { questions, isNew: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

async function startPlaying() {
  const hook = renderHook(() => useQuiz("note-1"));

  await act(async () => {
    hook.result.current.startQuiz("ox");
  });

  await waitFor(() => {
    expect(hook.result.current.phase).toBe("playing");
  });

  return hook;
}

describe("useQuiz", () => {
  it("퀴즈를 시작하면 playing 단계로 진입한다", async () => {
    mockSuccess();
    const { result } = await startPlaying();

    expect(result.current.questions).toHaveLength(2);
    expect(result.current.currentIndex).toBe(0);
  });

  describe("goToSelect", () => {
    it("진행 중이던 문제와 답안을 모두 비운다", async () => {
      mockSuccess();
      const { result } = await startPlaying();

      act(() => {
        result.current.submitAnswer("true");
      });

      expect(result.current.answers).toHaveLength(1);

      act(() => {
        result.current.goToSelect();
      });

      expect(result.current.phase).toBe("select");
      expect(result.current.questions).toEqual([]);
      expect(result.current.answers).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentQuestion).toBeNull();
    });

    it("결과 화면에서 돌아와도 점수가 초기화된다", async () => {
      mockSuccess();
      const { result } = await startPlaying();

      act(() => {
        result.current.submitAnswer("true");
      });
      act(() => {
        result.current.goToNext();
      });
      act(() => {
        result.current.submitAnswer("false");
      });
      act(() => {
        result.current.goToNext();
      });

      expect(result.current.phase).toBe("result");
      expect(result.current.correctCount).toBe(2);

      act(() => {
        result.current.goToSelect();
      });

      expect(result.current.correctCount).toBe(0);
    });

    it("생성 중에 호출하면 뒤늦게 도착한 응답을 무시한다", async () => {
      let resolveGenerate: (value: {
        data: { questions: QuizQuestion[]; isNew: boolean };
      }) => void = () => {};

      generateQuizMock.mockReturnValue(
        new Promise((resolve) => {
          resolveGenerate = resolve;
        }),
      );

      const { result } = renderHook(() => useQuiz("note-1"));

      act(() => {
        result.current.startQuiz("ox");
      });

      expect(result.current.phase).toBe("loading");

      act(() => {
        result.current.goToSelect();
      });

      await act(async () => {
        resolveGenerate({ data: { questions, isNew: true } });
      });

      expect(result.current.phase).toBe("select");
      expect(result.current.questions).toEqual([]);
    });
  });

  describe("submitAnswer", () => {
    it("ox 정답을 맞히면 정답으로 기록한다", async () => {
      mockSuccess();
      const { result } = await startPlaying();

      act(() => {
        result.current.submitAnswer("true");
      });

      expect(result.current.answers[0]?.isCorrect).toBe(true);
      expect(result.current.correctCount).toBe(1);
    });

    it("ox 오답이면 오답으로 기록한다", async () => {
      mockSuccess();
      const { result } = await startPlaying();

      act(() => {
        result.current.submitAnswer("false");
      });

      expect(result.current.answers[0]?.isCorrect).toBe(false);
      expect(result.current.correctCount).toBe(0);
    });

    it("choice는 선택지 번호로 채점한다", async () => {
      generateQuizMock.mockResolvedValue({
        data: {
          questions: [
            {
              type: "choice",
              question: "산술 연산 장치는?",
              options: ["ALU", "PC", "IR", "MAR"],
              answer: 0,
              explanation: "ALU다.",
            },
          ],
          isNew: true,
        },
      });

      const { result } = await startPlaying();

      act(() => {
        result.current.submitAnswer("0");
      });

      expect(result.current.answers[0]?.isCorrect).toBe(true);
    });
  });
});
