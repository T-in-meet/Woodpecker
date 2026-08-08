"use client";

import { ArrowLeftIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { QuizQuestion } from "../schema";

function formatAnswer(question: QuizQuestion): string {
  if (question.type === "ox") {
    return question.answer ? "O" : "X";
  }

  // 객관식은 본문을 그대로 옮기면 길어져서 선택지 번호만 보여준다. 내용은 해설이 설명한다.
  if (question.type === "choice") {
    return `${question.answer + 1}번`;
  }

  return question.answer;
}

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
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="shrink-0 text-center">
        <p className="text-4xl font-bold">
          {correctCount} / {total}
        </p>
        <p className="mt-1 text-muted-foreground">정답률 {percentage}%</p>
      </div>

      {/* 문항이 많아도 점수와 하단 버튼이 가려지지 않도록 이 목록만 스크롤한다. */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {questions.map((q, i) => {
          const answer = answers.find((record) => record.questionIndex === i);
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
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      정답
                    </span>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {formatAnswer(q)}
                    </p>
                  </div>
                  {/* 해설은 틀린 문항에서만 보여 목록이 길어지지 않게 한다.
                      빈칸은 정답 문자열이 곧 설명이라 해설을 생략한다. */}
                  {!answer?.isCorrect && q.type !== "blank" && (
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        해설
                      </span>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
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
