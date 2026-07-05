"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { gradeAnswerAction } from "../actions";

type GradingPanelProps = {
  noteId: string;
  reviewLogId: string;
  userAnswer: string;
};

export function GradingPanel({
  noteId,
  reviewLogId,
  userAnswer,
}: GradingPanelProps) {
  const [state, formAction, isPending] = useActionState(
    gradeAnswerAction,
    null,
  );

  if (state?.success) {
    const { score, summary, missedConcepts, incorrectPoints } = state.grading;

    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles aria-hidden className="size-4 text-orange-400" />
            AI 채점 결과
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{score}</span>
            <span className="text-sm text-muted-foreground">/ 100점</span>
          </div>

          <p className="text-sm text-foreground">{summary}</p>

          {missedConcepts.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">빠뜨린 핵심 개념</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {missedConcepts.map((concept) => (
                  <li key={concept}>{concept}</li>
                ))}
              </ul>
            </div>
          )}

          {incorrectPoints.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">
                원본과 다르게 기억한 내용
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {incorrectPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">
            AI 채점 결과는 참고용이에요. 원본과 직접 비교하며 스스로
            점검해보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          AI가 원본 대비 회상률을 채점하고 빠뜨린 개념을 짚어드려요. 채점은
          회차당 1번만 가능해요.
        </p>
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="reviewLogId" value={reviewLogId} />
          <input type="hidden" name="answer" value={userAnswer} />
          <Button
            type="submit"
            variant="outline"
            disabled={isPending}
            className="cursor-pointer"
          >
            <Sparkles aria-hidden className="size-4" />
            {isPending ? "채점 중..." : "AI 채점 받기"}
          </Button>
        </form>
      </div>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
