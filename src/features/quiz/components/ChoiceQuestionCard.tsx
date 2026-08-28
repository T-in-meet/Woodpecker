"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";

import type { ChoiceQuestion } from "../schema";
import { QuizAnswerBadge } from "./QuizAnswerBadge";
import { QuizSubmitButton } from "./QuizSubmitButton";

type ChoiceQuestionCardProps = {
  question: ChoiceQuestion;
  onSubmit: (answer: string) => void;
  submitted: boolean;
  userAnswer: string | undefined;
  isCorrect: boolean | undefined;
};

export function ChoiceQuestionCard({
  question,
  onSubmit,
  submitted,
  userAnswer,
  isCorrect,
}: ChoiceQuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-base font-medium leading-relaxed sm:text-lg">
        {question.question}
      </p>

      <div className="space-y-2">
        {question.options.map((option, index) => {
          // 선택 값은 onSubmit 계약에 맞춰 선택지 번호를 문자열로 넘긴다.
          const value = String(index);
          const isSelected = submitted
            ? userAnswer === value
            : selected === value;
          const isCorrectAnswer = submitted && question.answer === index;

          return (
            <button
              key={index}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(value)}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                !submitted &&
                  isSelected &&
                  "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20",
                !submitted &&
                  !isSelected &&
                  "border-border hover:border-primary/50",
                submitted &&
                  isCorrectAnswer &&
                  "border-green-500 bg-green-50 dark:bg-green-950/30",
                submitted &&
                  isSelected &&
                  !isCorrectAnswer &&
                  "border-red-500 bg-red-50 dark:bg-red-950/30",
                submitted && !isCorrectAnswer && !isSelected && "border-border",
                submitted && "cursor-default",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-xs font-semibold text-foreground dark:border-orange-900/40 dark:bg-orange-950/20">
                {index + 1}
              </span>
              <span className="flex-1 text-sm leading-relaxed">{option}</span>
              {isCorrectAnswer && <span className="sr-only">정답 선택지</span>}
            </button>
          );
        })}
      </div>

      {!submitted && (
        <QuizSubmitButton
          onClick={() => selected && onSubmit(selected)}
          disabled={!selected}
        />
      )}

      {submitted && (
        <div
          className={cn(
            "rounded-lg p-4",
            isCorrect
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-red-50 dark:bg-red-950/30",
          )}
        >
          <p className="mb-1 text-sm font-medium">
            {isCorrect ? "정답입니다!" : "오답입니다."}
          </p>
          {!isCorrect && (
            <div className="mb-2 mt-2 flex items-center gap-2">
              <QuizAnswerBadge />
              <span className="text-xs leading-5 text-muted-foreground">
                {question.answer + 1}번
              </span>
              {/* 화면에는 번호만 둔다. 선택지 목록을 볼 수 없는 스크린리더에서는
                  번호만으로 정답을 알 수 없으므로 내용을 함께 읽어 준다. */}
              <span className="sr-only">
                {question.options[question.answer]}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
