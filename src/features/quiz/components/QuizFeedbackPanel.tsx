import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type QuizFeedbackPanelProps = {
  isCorrect: boolean | undefined;
  /** 오답일 때의 머리글. 빈칸 채우기처럼 정답을 한 줄에 붙이는 유형이 바꿔 쓴다. */
  incorrectLabel?: string;
  explanation: string;
  /** 오답일 때 머리글과 해설 사이에 끼우는 정답 안내(객관식의 정답 배지 등). */
  children?: ReactNode;
};

/**
 * 채점 결과 패널. 문항 유형 3종이 같은 모양을 쓰므로 한 곳에서 관리한다.
 */
export function QuizFeedbackPanel({
  isCorrect,
  incorrectLabel = "오답입니다.",
  explanation,
  children,
}: QuizFeedbackPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        isCorrect
          ? "bg-green-50 dark:bg-green-950/30"
          : "bg-red-50 dark:bg-red-950/30",
      )}
    >
      <p className="mb-1 text-sm font-medium">
        {isCorrect ? "정답입니다!" : incorrectLabel}
      </p>
      {!isCorrect && children}
      <p className="text-sm text-muted-foreground">{explanation}</p>
    </div>
  );
}
