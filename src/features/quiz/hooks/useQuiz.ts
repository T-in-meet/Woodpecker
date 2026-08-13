"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import type { QuizType } from "@/lib/ai/prompts";

import { generateQuiz, regenerateQuiz } from "../actions";
import type { QuizQuestion } from "../schema";
import { gradeBlankAnswer } from "../utils/grading";

type QuizPhase = "select" | "loading" | "playing" | "result";

type AnswerRecord = {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
};

export function useQuiz(noteId: string) {
  const [phase, setPhase] = useState<QuizPhase>("select");
  const [quizType, setQuizType] = useState<QuizType | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 생성 요청 중 유형 선택 화면으로 돌아가면 뒤늦게 도착한 응답을 버린다.
  const requestIdRef = useRef(0);

  const startQuiz = useCallback(
    (type: QuizType) => {
      const requestId = ++requestIdRef.current;

      setError(null);
      setQuizType(type);
      setPhase("loading");

      startTransition(async () => {
        try {
          const result = await generateQuiz(noteId, type);
          if (requestId !== requestIdRef.current) return;

          if ("error" in result) {
            setError(result.error);
            setPhase("select");
            return;
          }

          setQuestions(result.data.questions);
          setCurrentIndex(0);
          setAnswers([]);
          setPhase("playing");
        } catch {
          if (requestId !== requestIdRef.current) return;

          setError("퀴즈 생성 중 오류가 발생했습니다.");
          setPhase("select");
        }
      });
    },
    [noteId],
  );

  const submitAnswer = useCallback(
    (userAnswer: string) => {
      const question = questions[currentIndex];
      if (!question) return;

      // ox는 "true"/"false", choice는 선택지 번호를 문자열로 받으므로 단순 비교로 충분하다.
      const isCorrect =
        question.type === "blank"
          ? gradeBlankAnswer(
              userAnswer,
              question.answer,
              question.acceptedAnswers,
            )
          : userAnswer === String(question.answer);

      const record: AnswerRecord = {
        questionIndex: currentIndex,
        userAnswer,
        isCorrect,
      };

      setAnswers((prev) => {
        // 더블클릭·Enter 반복 등으로 같은 문항이 여러 번 제출돼도 첫 답안만 남긴다.
        if (prev.some((answer) => answer.questionIndex === currentIndex)) {
          return prev;
        }
        return [...prev, record];
      });
    },
    [questions, currentIndex],
  );

  const goToNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setPhase("result");
    }
  }, [currentIndex, questions.length]);

  const retryQuiz = useCallback(() => {
    setCurrentIndex(0);
    setAnswers([]);
    setPhase("playing");
  }, []);

  const regenerate = useCallback(() => {
    if (!quizType) return;

    const requestId = ++requestIdRef.current;

    setError(null);
    setPhase("loading");

    startTransition(async () => {
      try {
        const result = await regenerateQuiz(noteId, quizType);
        if (requestId !== requestIdRef.current) return;

        if ("error" in result) {
          setError(result.error);
          setPhase("select");
          return;
        }

        setQuestions(result.data.questions);
        setCurrentIndex(0);
        setAnswers([]);
        setPhase("playing");
      } catch {
        if (requestId !== requestIdRef.current) return;

        setError("퀴즈 생성 중 오류가 발생했습니다.");
        setPhase("select");
      }
    });
  }, [noteId, quizType]);

  /**
   * 유형 선택 화면으로 되돌리며 진행 상태를 모두 비운다.
   * 모달을 닫을 때도 호출하므로, 다시 열면 항상 선택 화면부터 시작한다.
   */
  const goToSelect = useCallback(() => {
    requestIdRef.current += 1;

    setPhase("select");
    setError(null);
    setQuizType(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
  }, []);

  const currentQuestion = questions[currentIndex] ?? null;
  // 배열 위치가 아니라 questionIndex로 찾는다. "답안 순서 == 문항 순서"에 기대지 않기 위해서다.
  const currentAnswer =
    answers.find((answer) => answer.questionIndex === currentIndex) ?? null;
  const correctCount = answers.filter((a) => a.isCorrect).length;

  return {
    phase,
    isPending,
    error,
    questions,
    currentQuestion,
    currentIndex,
    currentAnswer,
    answers,
    correctCount,
    startQuiz,
    submitAnswer,
    goToNext,
    retryQuiz,
    regenerate,
    goToSelect,
  };
}
