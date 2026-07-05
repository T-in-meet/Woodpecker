"use client";

import { ArrowLeftIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { QuizQuestion } from "../schema";

type AnswerRecord = {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
};

type QuizResultProps = {
  questions: QuizQuestion[];
  answers: AnswerRecord[];
  correctCount: number;
  onRetry: () => void;
  onRegenerate: () => void;
  onGoToSelect: () => void;
  isPending: boolean;
};

export function QuizResult({
  questions,
  answers,
  correctCount,
  onRetry,
  onRegenerate,
  onGoToSelect,
  isPending,
}: QuizResultProps) {
  const total = questions.length;
  const percentage = Math.round((correctCount / total) * 100);

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="shrink-0 text-center">
        <p className="text-4xl font-bold">
          {correctCount} / {total}
        </p>
        <p className="mt-1 text-muted-foreground">정답률 {percentage}%</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {questions.map((q, i) => {
          const answer = answers[i];
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <span
                className={
                  answer?.isCorrect ? "text-green-600" : "text-red-600"
                }
              >
                {answer?.isCorrect ? "O" : "X"}
              </span>
              <div className="flex-1">
                <p className="text-sm">{q.question}</p>
                {!answer?.isCorrect && (
                  <>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium">
                        정답
                      </span>
                      <span className="pt-0.5">
                        {q.type === "ox" ? (q.answer ? "O" : "X") : q.answer}
                      </span>
                    </p>
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium">
                        해설
                      </span>
                      <span className="pt-0.5">{q.explanation}</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button onClick={onGoToSelect} variant="outline" className="flex-1">
          <ArrowLeftIcon className="size-4" />
          유형 선택
        </Button>
        <Button onClick={onRetry} variant="outline" className="flex-1">
          <RotateCcwIcon className="size-4" />
          다시 풀기
        </Button>
        <Button
          onClick={onRegenerate}
          variant="outline"
          className="flex-1"
          disabled={isPending}
        >
          <RefreshCwIcon className="size-4" />새 퀴즈
        </Button>
      </div>
    </div>
  );
}
