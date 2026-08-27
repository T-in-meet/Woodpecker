"use client";

import {
  ArrowLeftIcon,
  CircleIcon,
  ListChecksIcon,
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
import type { QuizType } from "@/lib/ai/prompts";
import { cn } from "@/lib/utils/cn";

import { useQuiz } from "../hooks/useQuiz";
import { BlankQuestionCard } from "./BlankQuestionCard";
import { ChoiceQuestionCard } from "./ChoiceQuestionCard";
import { OxQuestionCard } from "./OxQuestionCard";
import { QuizResult } from "./QuizResult";

const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  ox: "OX 퀴즈",
  blank: "빈칸 채우기",
  choice: "객관식",
};

const TYPE_BUTTON_CLASS = cn(
  "flex cursor-pointer flex-row items-center justify-center gap-3 rounded-lg border-2 border-border p-4 transition-colors",
  "sm:flex-col",
  "hover:border-primary/50 hover:bg-primary/5",
);

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

  // 모달은 계속 마운트돼 있으므로 닫을 때 직접 초기화해야 다음에 선택 화면부터 시작한다.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      goToSelect();
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0 mb-6">
          <DialogTitle>퀴즈</DialogTitle>
          <DialogDescription className="mt-2 truncate border-l-4 border-foreground pl-3 text-[15px] font-medium text-foreground/80">
            {noteTitle}
          </DialogDescription>
        </DialogHeader>

        {phase === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              퀴즈 유형을 선택하세요
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => startQuiz("ox")}
                className={TYPE_BUTTON_CLASS}
              >
                <div className="flex items-center gap-1">
                  <CircleIcon className="size-5" />
                  <XIcon className="size-6" />
                </div>
                <span className="text-sm font-medium sm:text-center">
                  {QUIZ_TYPE_LABELS.ox}
                </span>
              </button>
              <button
                type="button"
                onClick={() => startQuiz("choice")}
                className={TYPE_BUTTON_CLASS}
              >
                <ListChecksIcon className="size-6" />
                <span className="text-sm font-medium sm:text-center">
                  {QUIZ_TYPE_LABELS.choice}
                </span>
              </button>
              <button
                type="button"
                onClick={() => startQuiz("blank")}
                className={TYPE_BUTTON_CLASS}
              >
                <TextCursorInputIcon className="size-6" />
                <span className="text-sm font-medium sm:text-center">
                  {QUIZ_TYPE_LABELS.blank}
                </span>
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goToSelect}
                className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
                유형 선택
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {questions.length}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {QUIZ_TYPE_LABELS[currentQuestion.type]}
                </span>
              </div>
            </div>

            {currentQuestion.type === "ox" && (
              <OxQuestionCard
                key={currentIndex}
                question={currentQuestion}
                onSubmit={submitAnswer}
                submitted={currentAnswer !== null}
                userAnswer={currentAnswer?.userAnswer}
                isCorrect={currentAnswer?.isCorrect}
              />
            )}

            {currentQuestion.type === "choice" && (
              <ChoiceQuestionCard
                key={currentIndex}
                question={currentQuestion}
                onSubmit={submitAnswer}
                submitted={currentAnswer !== null}
                userAnswer={currentAnswer?.userAnswer}
                isCorrect={currentAnswer?.isCorrect}
              />
            )}

            {currentQuestion.type === "blank" && (
              <BlankQuestionCard
                key={currentIndex}
                question={currentQuestion}
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
