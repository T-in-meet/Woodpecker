"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils/cn";

import type { ChoiceQuestion } from "../schema";
import { QuizFeedbackPanel } from "./QuizFeedbackPanel";
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
  const groupId = useId();
  const questionId = `${groupId}-question`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <p
        id={questionId}
        className="text-base font-medium leading-relaxed sm:text-lg"
      >
        {question.question}
      </p>

      {/* 하나만 고르는 문항이라 라디오 그룹으로 둔다. 같은 name을 공유하는 native
          radio라 방향키 이동과 "n개 중 m번째" 안내를 브라우저가 처리한다. */}
      <div role="radiogroup" aria-labelledby={questionId} className="space-y-2">
        {question.options.map((option, index) => {
          // 선택 값은 onSubmit 계약에 맞춰 선택지 번호를 문자열로 넘긴다.
          const value = String(index);
          const isSelected = submitted
            ? userAnswer === value
            : selected === value;
          const isCorrectAnswer = submitted && question.answer === index;
          const isWrongPick = submitted && isSelected && !isCorrectAnswer;

          return (
            <label
              key={index}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                !submitted &&
                  isSelected &&
                  "border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20",
                !submitted &&
                  !isSelected &&
                  "border-border hover:border-primary/50",
                isCorrectAnswer &&
                  "border-green-500 bg-green-50 dark:bg-green-950/30",
                isWrongPick && "border-red-500 bg-red-50 dark:bg-red-950/30",
                submitted && !isCorrectAnswer && !isSelected && "border-border",
                submitted && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={groupId}
                value={value}
                checked={isSelected}
                disabled={submitted}
                onChange={() => setSelected(value)}
                className="sr-only"
              />

              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-xs font-semibold text-foreground dark:border-orange-900/40 dark:bg-orange-950/20">
                {index + 1}
              </span>

              <span className="flex-1 text-sm leading-relaxed">{option}</span>

              {/* 채점 결과를 테두리 색으로만 알리면 적록색약(남성 12명 중 1명)에게는
                  정답과 오답이 구분되지 않는다. 아이콘과 글자를 함께 붙인다. */}
              {isCorrectAnswer && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  정답
                </span>
              )}

              {isWrongPick && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                  <XCircle aria-hidden="true" className="size-4" />
                  오답
                </span>
              )}
            </label>
          );
        })}
      </div>

      {!submitted && (
        <QuizSubmitButton
          onClick={() => selected && onSubmit(selected)}
          disabled={!selected}
        />
      )}

      {/* 정답 선택지에 직접 표시가 붙으므로 여기서 번호를 다시 알려 주지 않는다. */}
      {submitted && (
        <QuizFeedbackPanel
          isCorrect={isCorrect}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}
