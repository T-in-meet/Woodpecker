"use client";

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  CircleXIcon,
  ListChecksIcon,
  LoaderIcon,
  NotebookTextIcon,
  TextCursorInputIcon,
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
  choice: "객관식 문제",
};

const QUIZ_TYPE_OPTIONS = [
  {
    type: "ox",
    label: QUIZ_TYPE_LABELS.ox,
    Icon: CircleXIcon,
  },
  {
    type: "choice",
    label: QUIZ_TYPE_LABELS.choice,
    Icon: ListChecksIcon,
  },
  {
    type: "blank",
    label: QUIZ_TYPE_LABELS.blank,
    Icon: TextCursorInputIcon,
  },
] as const;

const TYPE_BUTTON_CLASS = cn(
  "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors sm:h-16 sm:gap-2.5 sm:py-2.5",
  "hover:border-orange-200 hover:bg-orange-50 dark:hover:border-orange-900/40 dark:hover:bg-orange-950/20",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
    goToPrevious,
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
      <DialogContent className="flex max-h-[85dvh] max-w-xl flex-col overflow-hidden border border-border/60 p-4 shadow-2xl sm:p-6">
        <DialogHeader className="mb-3 shrink-0 pr-8 sm:mb-6">
          <DialogTitle className="text-xl">퀴즈 만들기</DialogTitle>
          <DialogDescription className="mt-2 flex min-w-0 items-start gap-2 text-base text-muted-foreground">
            <NotebookTextIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="truncate">{noteTitle}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === "select" && (
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 sm:space-y-4 sm:pr-0">
            <p className="text-base font-medium">어떻게 복습할까요?</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {QUIZ_TYPE_OPTIONS.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => startQuiz(type)}
                  className={TYPE_BUTTON_CLASS}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 sm:size-9 sm:rounded-xl dark:bg-orange-950/20">
                    <Icon aria-hidden="true" className="size-4 sm:size-5" />
                  </span>
                  <span className="min-w-0 text-sm font-medium sm:text-base">
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              유형을 누르면 바로 시작합니다.
            </p>
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
            <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
              <button
                type="button"
                onClick={goToSelect}
                className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeftIcon className="size-4" />
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

            <div className="mt-3 flex items-center gap-3 sm:mt-4">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="flex cursor-pointer items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ArrowLeftIcon aria-hidden="true" className="size-4" />
                  이전 문제
                </button>
              )}
              <button
                type="button"
                onClick={goToNext}
                disabled={currentAnswer === null}
                className="ml-auto cursor-pointer rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:no-underline"
              >
                {currentIndex + 1 < questions.length
                  ? "다음 문제 →"
                  : "결과 보기 →"}
              </button>
            </div>
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
