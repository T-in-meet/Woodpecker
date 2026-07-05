"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import type { MultipleChoiceQuestion } from "../schema";

type MultipleChoiceCardProps = {
  question: MultipleChoiceQuestion;
  onSubmit: (answer: string) => void;
  submitted: boolean;
  userAnswer: string | undefined;
  isCorrect: boolean | undefined;
};

export function MultipleChoiceCard({
  question,
  onSubmit,
  submitted,
  userAnswer,
  isCorrect,
}: MultipleChoiceCardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-lg font-medium leading-relaxed">{question.question}</p>

      <div className="flex flex-col gap-2">
        {question.options.map((option, index) => {
          const isSelected = submitted
            ? Number(userAnswer) === index
            : selected === index;
          const isCorrectAnswer = submitted && question.answer === index;

          return (
            <button
              key={index}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors",
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
                submitted && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  !submitted && isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                  submitted &&
                    isCorrectAnswer &&
                    "border-green-500 bg-green-500 text-white",
                  submitted &&
                    isSelected &&
                    !isCorrectAnswer &&
                    "border-red-500 bg-red-500 text-white",
                )}
              >
                {index + 1}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {!submitted && (
        <Button
          onClick={() => selected !== null && onSubmit(String(selected))}
          disabled={selected === null}
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
              : `오답입니다. 정답: ${question.answer + 1}번`}
          </p>
          <p className="text-sm text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
