"use client";

import { LoaderIcon } from "lucide-react";
import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useQuiz } from "../hooks/useQuiz";
import type { BlankQuestion, OxQuestion } from "../schema";
import { BlankQuestionCard } from "./BlankQuestionCard";
import { OxQuestionCard } from "./OxQuestionCard";
import { QuizResult } from "./QuizResult";

type QuizModalProps = {
  noteId: string;
  noteTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuizModal({
  noteId,
  noteTitle,
  open,
  onOpenChange,
}: QuizModalProps) {
  const {
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
  } = useQuiz(noteId);

  useEffect(() => {
    if (open && phase === "idle") {
      startQuiz();
    }
  }, [open, phase, startQuiz]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>퀴즈</DialogTitle>
          <DialogDescription className="truncate">
            {noteTitle}
          </DialogDescription>
        </DialogHeader>

        {(phase === "loading" || isPending) && (
          <div className="flex flex-col items-center gap-3 py-12">
            <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              노트 내용을 바탕으로 퀴즈를 만들고 있어요.
            </p>
          </div>
        )}

        {phase === "idle" && error && (
          <div className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {phase === "playing" && currentQuestion && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {questions.length}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {currentQuestion.type === "ox" ? "OX 퀴즈" : "빈칸 채우기"}
              </span>
            </div>

            {currentQuestion.type === "ox" ? (
              <OxQuestionCard
                key={currentIndex}
                question={currentQuestion as OxQuestion}
                onSubmit={submitAnswer}
                submitted={currentAnswer !== null}
                userAnswer={currentAnswer?.userAnswer}
                isCorrect={currentAnswer?.isCorrect}
              />
            ) : (
              <BlankQuestionCard
                key={currentIndex}
                question={currentQuestion as BlankQuestion}
                onSubmit={submitAnswer}
                submitted={currentAnswer !== null}
                userAnswer={currentAnswer?.userAnswer}
                isCorrect={currentAnswer?.isCorrect}
              />
            )}

            {currentAnswer !== null && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={goToNext}
                  className="cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  {currentIndex + 1 < questions.length
                    ? "다음 문제 →"
                    : "결과 보기 →"}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "result" && (
          <QuizResult
            questions={questions}
            answers={answers}
            correctCount={correctCount}
            onRetry={retryQuiz}
            onRegenerate={regenerate}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
