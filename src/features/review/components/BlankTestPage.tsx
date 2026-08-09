"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";

import { submitAnswerAction } from "../actions";
import { ANSWER_MAX_LENGTH, type GradingResponse } from "../schema";
import { BlankEditor } from "./BlankEditor";
import { ComparisonView } from "./ComparisonView";
import { GradingPanel } from "./GradingPanel";
import { ReviewCompleteButton } from "./ReviewCompleteButton";

/**
 * 이미 채점을 받은 회차로 다시 들어왔을 때 서버가 복원해 주는 직전 상태.
 * 답안과 채점은 `review_gradings`에 남아 있으므로, 이게 없으면 사용자는 완료 버튼을
 * 보려고 답안을 한 번 더 써야 하고 그 답안은 저장된 채점 기준과 어긋난다.
 */
export type RestoredReviewSession = {
  originalContent: string;
  originalUpdatedAt: string;
  userAnswer: string;
  reviewLogId: string;
  grading: GradingResponse;
};

type BlankTestPageProps = {
  alreadyCompletedToday: boolean;
  noteId: string;
  noteTitle: string;
  restoredSession: RestoredReviewSession | null;
  reviewRound: number;
};

export function BlankTestPage({
  alreadyCompletedToday,
  noteId,
  noteTitle,
  restoredSession,
  reviewRound,
}: BlankTestPageProps) {
  const [answer, setAnswer] = useState("");
  // 복원된 화면에서 "답안 다시 작성"을 누르면 백지 편집기로 돌아간다.
  // 회차당 채점은 1번이라 새 답안으로 다시 채점되지는 않는다.
  const [isRewriting, setIsRewriting] = useState(false);
  const [state, formAction, isPending] = useActionState(
    submitAnswerAction,
    null,
  );

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;
  const restoredComparison =
    isRewriting || state?.success ? null : restoredSession;
  const comparisonState = state?.success ? state : restoredComparison;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
            {reviewRound}차 복습
          </span>
          <span>
            백지 테스트 {reviewRound} / {MAX_REVIEW_ROUND}
          </span>
        </div>
        <h1 className="break-words break-keep text-3xl font-bold text-foreground">
          {noteTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          먼저 기억나는 내용을 적고 제출한 뒤, 원본과 나란히 비교해보세요.
        </p>
      </header>

      {comparisonState ? (
        <section className="space-y-6">
          <ComparisonView
            userAnswer={comparisonState.userAnswer}
            originalContent={comparisonState.originalContent}
          />

          <GradingPanel
            initialGrading={restoredComparison?.grading ?? null}
            noteId={noteId}
            originalUpdatedAt={comparisonState.originalUpdatedAt}
            reviewLogId={comparisonState.reviewLogId}
            userAnswer={comparisonState.userAnswer}
          />

          <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              {alreadyCompletedToday
                ? "오늘은 이미 이 노트의 복습을 완료했어요. 내일 자정(KST) 이후 다시 완료할 수 있어요."
                : "비교를 마쳤다면 이번 복습을 완료 처리하고 다음 간격으로 넘어가세요."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ReviewCompleteButton
                disabled={alreadyCompletedToday}
                noteId={noteId}
                reviewLogId={comparisonState.reviewLogId}
              />
              {restoredComparison && (
                <Button
                  className="cursor-pointer"
                  onClick={() => setIsRewriting(true)}
                  type="button"
                  variant="outline"
                >
                  답안 다시 작성
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base">답안 작성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="noteId" value={noteId} />
              <input type="hidden" name="answer" value={answer} />

              {generalError && (
                <p role="alert" className="px-6 pt-5 text-sm text-destructive">
                  {generalError}
                </p>
              )}

              {fieldErrors?.answer && (
                <p role="alert" className="px-6 pt-5 text-sm text-destructive">
                  {fieldErrors.answer.join(" ")}
                </p>
              )}

              <BlankEditor value={answer} onChange={setAnswer} />

              <div className="flex flex-col gap-3 border-t border-border/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span
                  aria-live="polite"
                  className={`text-xs tabular-nums ${
                    answer.length > ANSWER_MAX_LENGTH
                      ? "text-destructive"
                      : answer.length >= ANSWER_MAX_LENGTH * 0.9
                        ? "text-amber-500"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {answer.length.toLocaleString()} /{" "}
                  {ANSWER_MAX_LENGTH.toLocaleString()}
                </span>

                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isPending ||
                    answer.trim().length === 0 ||
                    answer.length > ANSWER_MAX_LENGTH
                  }
                >
                  {isPending ? "비교 준비 중..." : "원본과 비교하기"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
