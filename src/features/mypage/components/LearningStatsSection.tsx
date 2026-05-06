import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

import type { LearningStats } from "../queries";

type LearningStatsSectionProps = {
  stats: LearningStats;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

const REVIEW_LOG_ROUND_LABELS: Record<number, string> = {
  1: "1회차 복습",
  2: "2회차 복습",
  3: "3회차 복습",
};

const NOTES_ROUND_LABELS: Record<number, string> = {
  0: "학습 전",
  1: "1회차 완료",
  2: "2회차 완료",
  3: "3회차 완료",
};

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function heatmapClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 2) return "bg-primary/30";
  if (count <= 4) return "bg-primary/60";
  return "bg-primary";
}

export function LearningStatsSection({ stats }: LearningStatsSectionProps) {
  const maxNotesByRound = Math.max(
    ...stats.notesByRound.map((r) => r.count),
    1,
  );

  const reviewedNotes = stats.notesByRound
    .filter((r) => r.round >= 1)
    .reduce((acc, r) => acc + r.count, 0);

  const isEmpty =
    stats.totalNotes === 0 &&
    stats.completedReviews === 0 &&
    stats.todayReviews === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>학습 통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="전체 노트" value={stats.totalNotes} />
          <StatCard label="복습한 노트" value={reviewedNotes} />
          <StatCard label="오늘 예정 복습" value={stats.todayReviews} />
        </div>

        <div className="rounded-lg border p-4">
          <h4 className="mb-2 text-sm font-medium">연속 학습일</h4>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">
              {stats.studyStreak.current}
            </span>
            <span className="text-sm text-muted-foreground">일 연속</span>
            <span className="ml-auto text-sm text-muted-foreground">
              최장 {stats.studyStreak.longest}일
            </span>
          </div>
        </div>

        {stats.reviewsByRound.some((r) => r.scheduled > 0) && (
          <div>
            <h4 className="mb-3 text-sm font-medium">라운드별 완료율</h4>
            <div className="space-y-2">
              {stats.reviewsByRound.map(({ round, scheduled, completed }) => (
                <div key={round} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-muted-foreground">
                    {REVIEW_LOG_ROUND_LABELS[round] ?? `${round}회차`}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width:
                          scheduled === 0
                            ? "0%"
                            : `${(completed / scheduled) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm tabular-nums">
                    {completed}/{scheduled} (
                    {formatPercent(completed, scheduled)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.notesByRound.some((r) => r.count > 0) && (
          <div>
            <h4 className="mb-3 text-sm font-medium">노트 라운드 분포</h4>
            <div className="space-y-2">
              {stats.notesByRound.map(({ round, count }) => (
                <div key={round} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-muted-foreground">
                    {NOTES_ROUND_LABELS[round] ?? `${round}회차`}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(count / maxNotesByRound) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.onTimeRate.completed > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="mb-1 text-sm font-medium">정시 완료율</h4>
            <p className="text-sm text-muted-foreground">
              완료한 복습 {stats.onTimeRate.completed}건 중{" "}
              <span className="font-semibold text-foreground">
                {stats.onTimeRate.onTime}건
              </span>
              을 예정 날짜 안에 완료 (
              {formatPercent(
                stats.onTimeRate.onTime,
                stats.onTimeRate.completed,
              )}
              )
            </p>
          </div>
        )}

        {stats.recentActivity.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">최근 30일 활동</h4>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${stats.recentActivity.length}, minmax(0, 1fr))`,
              }}
            >
              {stats.recentActivity.map(({ date, count }) => (
                <div
                  key={date}
                  className={cn(
                    "aspect-square rounded-sm",
                    heatmapClass(count),
                  )}
                  title={`${date}: ${count}건`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>적음</span>
              <div className="size-3 rounded-sm bg-muted" />
              <div className="size-3 rounded-sm bg-primary/30" />
              <div className="size-3 rounded-sm bg-primary/60" />
              <div className="size-3 rounded-sm bg-primary" />
              <span>많음</span>
            </div>
          </div>
        )}

        {isEmpty && (
          <p className="text-center text-sm text-muted-foreground">
            아직 학습 기록이 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
