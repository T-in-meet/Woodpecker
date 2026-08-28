"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

import type { BlankQuestion } from "../schema";
import { QuizSubmitButton } from "./QuizSubmitButton";

type BlankQuestionCardProps = {
  question: BlankQuestion;
  onSubmit: (answer: string) => void;
  submitted: boolean;
  userAnswer: string | undefined;
  isCorrect: boolean | undefined;
};

export function BlankQuestionCard({
  question,
  onSubmit,
  submitted,
  userAnswer,
  isCorrect,
}: BlankQuestionCardProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-base font-medium leading-relaxed sm:text-lg">
        {question.question}
      </p>

      <div className="space-y-3">
        <Input
          value={submitted ? (userAnswer ?? "") : input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !submitted) handleSubmit();
          }}
          placeholder="답을 입력하세요"
          disabled={submitted}
          className={cn(
            submitted && isCorrect && "border-green-500",
            submitted && !isCorrect && "border-red-500",
          )}
        />

        {!submitted && (
          <QuizSubmitButton onClick={handleSubmit} disabled={!input.trim()} />
        )}
      </div>

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
            {isCorrect ? "정답입니다!" : `오답입니다. 정답: ${question.answer}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
