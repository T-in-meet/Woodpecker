"use client";

import { CircleIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import type { OxQuestion } from "../schema";

type OxQuestionCardProps = {
  question: OxQuestion;
  onSubmit: (answer: string) => void;
  submitted: boolean;
  userAnswer: string | undefined;
  isCorrect: boolean | undefined;
};

export function OxQuestionCard({
  question,
  onSubmit,
  submitted,
  userAnswer,
  isCorrect,
}: OxQuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-lg font-medium leading-relaxed">{question.question}</p>

      <div className="flex gap-3">
        {(["true", "false"] as const).map((value) => {
          const isSelected = submitted
            ? userAnswer === value
            : selected === value;
          const isCorrectAnswer =
            submitted && String(question.answer) === value;

          return (
            <button
              key={value}
              type="button"
              // 아이콘만 있는 버튼이라 lucide가 aria-hidden을 붙이면 이름이 남지 않는다.
              aria-label={value === "true" ? "O, 맞다" : "X, 틀리다"}
              disabled={submitted}
              onClick={() => setSelected(value)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 p-4 text-lg font-semibold transition-colors",
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
              {value === "true" ? (
                <CircleIcon className="size-6" />
              ) : (
                <XIcon className="size-6" />
              )}
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
            {isCorrect ? "정답입니다!" : "오답입니다."}
          </p>
          <p className="text-sm text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
