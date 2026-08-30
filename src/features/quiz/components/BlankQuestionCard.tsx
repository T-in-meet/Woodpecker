"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

import type { BlankQuestion } from "../schema";
import { QuizFeedbackPanel } from "./QuizFeedbackPanel";
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
        <QuizFeedbackPanel
          isCorrect={isCorrect}
          incorrectLabel={`오답입니다. 정답: ${question.answer}`}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}
