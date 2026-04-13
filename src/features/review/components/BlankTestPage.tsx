"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NoteLanguage } from "@/lib/constants/noteLanguages";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";

import { submitAnswerAction } from "../actions";
import { ANSWER_MAX_LENGTH } from "../schema";
import { BlankEditor } from "./BlankEditor";
import { ComparisonView } from "./ComparisonView";
import { ReviewCompleteButton } from "./ReviewCompleteButton";

type BlankTestPageProps = {
  noteId: string;
  noteTitle: string;
  language: NoteLanguage | null;
  reviewRound: number;
};

export function BlankTestPage({
  noteId,
  noteTitle,
  language,
  reviewRound,
}: BlankTestPageProps) {
  const [answer, setAnswer] = useState("");
  const [state, formAction, isPending] = useActionState(
    submitAnswerAction,
    null,
  );

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;
  const comparisonState = state?.success ? state : null;

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
        <h1 className="text-3xl font-bold text-foreground">{noteTitle}</h1>
        <p className="text-sm text-muted-foreground">
          먼저 기억나는 내용을 적고 제출한 뒤, 원본과 나란히 비교해보세요.
        </p>
      </header>

      {comparisonState ? (
        <section className="space-y-6">
          <ComparisonView
            language={comparisonState.language}
            userAnswer={comparisonState.userAnswer}
            originalContent={comparisonState.originalContent}
          />

          <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              비교를 마쳤다면 이번 복습을 완료 처리하고 다음 간격으로
              넘어가세요.
            </p>
            <div className="mt-4">
              <ReviewCompleteButton
                noteId={noteId}
                reviewLogId={comparisonState.reviewLogId}
                completionToken={comparisonState.completionToken}
              />
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

              <BlankEditor
                language={language}
                value={answer}
                onChange={setAnswer}
              />

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
