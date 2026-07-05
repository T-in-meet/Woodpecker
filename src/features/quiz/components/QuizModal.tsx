"use client";

import {
  CircleIcon,
  ListIcon,
  LoaderIcon,
  TextCursorInputIcon,
  XIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

import { useQuiz } from "../hooks/useQuiz";
import type {
  BlankQuestion,
  MultipleChoiceQuestion,
  OxQuestion,
} from "../schema";
import { BlankQuestionCard } from "./BlankQuestionCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
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
    goToSelect,
  } = useQuiz(noteId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>퀴즈</DialogTitle>
          <DialogDescription className="truncate">
            {noteTitle}
          </DialogDescription>
        </DialogHeader>

        {phase === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              퀴즈 유형을 선택하세요
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => startQuiz("ox")}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-border p-6 transition-colors",
                  "hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <div className="flex items-center gap-1">
                  <CircleIcon className="size-6" />
                  <XIcon className="size-6" />
                </div>
                <span className="text-sm font-medium">OX 퀴즈</span>
              </button>
              <button
                type="button"
                onClick={() => startQuiz("blank")}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-border p-6 transition-colors",
                  "hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <TextCursorInputIcon className="size-6" />
                <span className="text-sm font-medium">빈칸 채우기</span>
              </button>
              <button
                type="button"
                onClick={() => startQuiz("multiple_choice")}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-border p-6 transition-colors",
                  "hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <ListIcon className="size-6" />
                <span className="text-sm font-medium">객관식</span>
              </button>
            </div>
          </div>
        )}

        {(phase === "loading" || isPending) && (
          <div className="flex flex-col items-center gap-3 py-12">
            <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              노트 내용을 바탕으로 퀴즈를 만들고 있어요.
            </p>
          </div>
        )}

        {phase === "playing" && currentQuestion && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {questions.length}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {currentQuestion.type === "ox"
                  ? "OX 퀴즈"
                  : currentQuestion.type === "multiple_choice"
                    ? "객관식"
                    : "빈칸 채우기"}
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
            ) : currentQuestion.type === "multiple_choice" ? (
              <MultipleChoiceCard
                key={currentIndex}
                question={currentQuestion as MultipleChoiceQuestion}
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
            onGoToSelect={goToSelect}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
