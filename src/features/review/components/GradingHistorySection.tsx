import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/formatDate";

import type { ReviewGrading } from "../queries";

type GradingHistorySectionProps = {
  gradings: ReviewGrading[];
};

export function GradingHistorySection({
  gradings,
}: GradingHistorySectionProps) {
  if (gradings.length === 0) {
    return null;
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">회차별 AI 채점 기록</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gradings.map((grading) => {
          const hasDetails =
            grading.feedback.missedConcepts.length > 0 ||
            grading.feedback.incorrectPoints.length > 0;

          return (
            <div
              key={grading.id}
              className="rounded-lg border border-border/60 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  {grading.round}차 복습
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {grading.score}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    / 100점
                  </span>
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(grading.created_at)}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {grading.feedback.summary}
              </p>

              {hasDetails && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    자세히 보기
                  </summary>
                  <div className="mt-2 space-y-3">
                    {grading.feedback.missedConcepts.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-medium">
                          빠뜨린 핵심 개념
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {/* 항목은 LLM 출력이라 같은 문자열이 두 번 나올 수 있어 index를 섞는다. */}
                          {grading.feedback.missedConcepts.map(
                            (concept, index) => (
                              <li key={`${index}-${concept}`}>{concept}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {grading.feedback.incorrectPoints.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-medium">
                          원본과 다르게 기억한 내용
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {grading.feedback.incorrectPoints.map(
                            (point, index) => (
                              <li key={`${index}-${point}`}>{point}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
