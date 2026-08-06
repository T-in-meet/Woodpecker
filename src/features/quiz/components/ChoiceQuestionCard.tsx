"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import type { ChoiceQuestion } from "../schema";

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
    <div className="space-y-6">
      <p className="text-lg font-medium leading-relaxed">{question.question}</p>

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
                !submitted && isSelected && "border-primary bg-primary/10",
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
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-foreground dark:bg-amber-900/40">
                {index + 1}
              </span>
              <span className="flex-1 text-sm leading-relaxed">{option}</span>
            </button>
          );
        })}
      </div>

      {!submitted && (
        <Button
          onClick={() => selected && onSubmit(selected)}
          disabled={!selected}
          size="lg"
          className="w-full"
        >
          정답 확인
        </Button>
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
          <p className="mb-1 font-semibold">
            {isCorrect
              ? "정답입니다!"
              : `오답입니다. 정답: ${question.options[question.answer] ?? ""}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
