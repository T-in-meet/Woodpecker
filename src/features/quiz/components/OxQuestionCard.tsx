"use client";

import { CheckCircle2, CircleIcon, XCircle, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils/cn";

import type { OxQuestion } from "../schema";
import { QuizFeedbackPanel } from "./QuizFeedbackPanel";
import { QuizSubmitButton } from "./QuizSubmitButton";

type OxQuestionCardProps = {
  question: OxQuestion;
  onSubmit: (answer: string) => void;
  submitted: boolean;
  userAnswer: string | undefined;
  isCorrect: boolean | undefined;
};

const OX_OPTIONS = [
  { value: "true", label: "O, 맞다" },
  { value: "false", label: "X, 틀리다" },
] as const;

export function OxQuestionCard({
  question,
  onSubmit,
  submitted,
  userAnswer,
  isCorrect,
}: OxQuestionCardProps) {
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
      <div
        role="radiogroup"
        aria-labelledby={questionId}
        className="flex gap-3"
      >
        {OX_OPTIONS.map(({ value, label }) => {
          const isSelected = submitted
            ? userAnswer === value
            : selected === value;
          const isCorrectAnswer =
            submitted && String(question.answer) === value;
          const isWrongPick = submitted && isSelected && !isCorrectAnswer;

          return (
            <label
              key={value}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 p-3 text-lg font-semibold transition-colors sm:p-4",
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

              {value === "true" ? (
                <CircleIcon className="size-6" />
              ) : (
                <XIcon className="size-6" />
              )}

              {/* 기호만 있는 선택지라 lucide가 aria-hidden을 붙이면 이름이 남지 않는다. */}
              <span className="sr-only">{label}</span>

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

      {submitted && (
        <QuizFeedbackPanel
          isCorrect={isCorrect}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}
