"use client";

import { useCallback, useState, useTransition } from "react";

import type { QuizType } from "@/lib/gemini/prompts";

import { generateQuiz, regenerateQuiz } from "../actions";
import type {
  BlankQuestion,
  MultipleChoiceQuestion,
  OxQuestion,
  QuizQuestion,
} from "../schema";
import { gradeBlankAnswer, gradeMultipleChoiceAnswer } from "../utils/grading";

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

  const startQuiz = useCallback(
    (type: QuizType) => {
      setError(null);
      setQuizType(type);
      setPhase("loading");

      startTransition(async () => {
        try {
          const result = await generateQuiz(noteId, type);

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

      let isCorrect: boolean;

      if (question.type === "ox") {
        const oxQ = question as OxQuestion;
        isCorrect = userAnswer === String(oxQ.answer);
      } else if (question.type === "multiple_choice") {
        const mcQ = question as MultipleChoiceQuestion;
        isCorrect = gradeMultipleChoiceAnswer(userAnswer, mcQ.answer);
      } else {
        const blankQ = question as BlankQuestion;
        isCorrect = gradeBlankAnswer(
          userAnswer,
          blankQ.answer,
          blankQ.acceptedAnswers,
        );
      }

      const record: AnswerRecord = {
        questionIndex: currentIndex,
        userAnswer,
        isCorrect,
      };

      setAnswers((prev) => [...prev, record]);
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
    setError(null);
    setPhase("loading");

    startTransition(async () => {
      try {
        const result = await regenerateQuiz(noteId, quizType);

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
        setError("퀴즈 생성 중 오류가 발생했습니다.");
        setPhase("select");
      }
    });
  }, [noteId, quizType]);

  const goToSelect = useCallback(() => {
    setPhase("select");
    setError(null);
  }, []);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer = answers[currentIndex] ?? null;
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
