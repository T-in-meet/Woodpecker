"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { gradeAnswerAction } from "../actions";
import type { GradingResponse } from "../schema";

type GradingPanelProps = {
  /**
   * 복원한 채점을 받은 뒤 노트 본문이 바뀌었는지. 답안은 그대로여도 채점 기준 원본이
   * 지금 화면의 원본과 다르므로, 점수·피드백을 현재 내용과 대조하면 어긋난다.
   *
   * 페이지 복원 화면에만 해당한다. 채점 버튼을 눌러 저장된 결과를 돌려받는 경로는
   * 액션 응답의 `basisContentChanged`가 같은 판단을 실어 온다.
   */
  basisContentChanged: boolean;
  /**
   * 페이지 진입 시 서버가 복원한 채점 결과. 있으면 채점 버튼 없이 바로 보여준다.
   * 이때 화면의 답안이 곧 채점 기준이므로 답안이 다르다는 안내는 필요 없다.
   */
  initialGrading: GradingResponse | null;
  noteId: string;
  /** 위 비교 화면에 그려진 원본의 본문 해시. 채점 기준이 같은 본문인지 서버가 확인한다. */
  originalContentHash: string;
  reviewLogId: string;
  userAnswer: string;
};

export function GradingPanel({
  basisContentChanged,
  initialGrading,
  noteId,
  originalContentHash,
  reviewLogId,
  userAnswer,
}: GradingPanelProps) {
  const [state, formAction, isPending] = useActionState(
    gradeAnswerAction,
    null,
  );

  const grading = state?.success ? state.grading : initialGrading;
  const gradedOtherAnswer = state?.success ? state.gradedOtherAnswer : false;
  const gradedAnswer = state?.success ? state.gradedAnswer : null;
  // 액션이 돌려준 결과를 그리는 동안에는 그 응답의 판단을 따른다.
  // prop은 페이지가 복원한 채점(`initialGrading`)에 대한 판단이라 여기선 근거가 아니다.
  const basisChanged = state?.success
    ? state.basisContentChanged
    : basisContentChanged;

  if (grading) {
    const { score, summary, missedConcepts, incorrectPoints } = grading;

    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles aria-hidden className="size-4 text-orange-400" />
            AI 채점 결과
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-5">
          {basisChanged && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p
                role="status"
                className="text-prose-ko text-sm text-foreground"
              >
                이 채점은 지금 보고 있는 원본과 다른 버전을 기준으로 했어요.
                채점 이후 노트를 수정해서 점수와 피드백이 현재 내용과 어긋날 수
                있어요.
              </p>
            </div>
          )}

          {gradedOtherAnswer && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <p
                role="status"
                className="text-prose-ko text-sm text-foreground"
              >
                이 결과는 이번 회차에 먼저 제출한 다른 답안을 채점한 것이에요.
                채점은 회차당 1번만 가능해서 지금 답안으로는 다시 채점할 수
                없어요.
              </p>

              {/* 어떤 문장에 대한 피드백인지 알 수 있도록 기준이 된 답안을 함께 둔다. */}
              {gradedAnswer && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    채점 기준이 된 답안 보기
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">
                    {gradedAnswer}
                  </p>
                </details>
              )}
            </div>
          )}

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{score}</span>
            <span className="text-sm text-muted-foreground">/ 100점</span>
          </div>

          <p className="text-prose-ko text-sm text-foreground">{summary}</p>

          {missedConcepts.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">빠뜨린 핵심 개념</h4>
              <ul className="text-prose-ko list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {/* 항목은 LLM 출력이라 같은 문자열이 두 번 나올 수 있어 index를 섞는다. */}
                {missedConcepts.map((concept, index) => (
                  <li key={`${index}-${concept}`}>{concept}</li>
                ))}
              </ul>
            </div>
          )}

          {incorrectPoints.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">
                원본과 다르게 기억한 내용
              </h4>
              <ul className="text-prose-ko list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {incorrectPoints.map((point, index) => (
                  <li key={`${index}-${point}`}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-prose-ko text-xs text-muted-foreground/60">
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
        <p className="text-prose-ko text-sm text-muted-foreground">
          AI가 원본 대비 회상률을 채점하고 빠뜨린 개념을 짚어드려요. 채점은
          회차당 1번만 가능해요.
        </p>
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="reviewLogId" value={reviewLogId} />
          <input
            type="hidden"
            name="originalContentHash"
            value={originalContentHash}
          />
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
