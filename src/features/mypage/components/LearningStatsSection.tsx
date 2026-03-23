import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const ROUND_LABELS: Record<number, string> = {
  0: "최초 학습",
  1: "1회차 복습",
  2: "2회차 복습",
  3: "3회차 복습",
};

export function LearningStatsSection({ stats }: LearningStatsSectionProps) {
  const maxActivity = Math.max(...stats.recentActivity.map((a) => a.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>학습 통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="전체 노트" value={stats.totalNotes} />
          <StatCard label="완료 복습" value={stats.completedReviews} />
          <StatCard label="대기 복습" value={stats.pendingReviews} />
        </div>

        {stats.reviewsByRound.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">라운드별 분포</h4>
            <div className="space-y-2">
              {stats.reviewsByRound.map(({ round, count }) => (
                <div key={round} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-muted-foreground">
                    {ROUND_LABELS[round] ?? `${round}회차`}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(count / Math.max(...stats.reviewsByRound.map((r) => r.count), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.recentActivity.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">최근 7일 활동</h4>
            <div className="flex items-end gap-1">
              {stats.recentActivity.map(({ date, count }) => (
                <div
                  key={date}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded bg-primary"
                    style={{
                      height: `${Math.max((count / maxActivity) * 60, 4)}px`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalNotes === 0 &&
          stats.completedReviews === 0 &&
          stats.pendingReviews === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              아직 학습 기록이 없습니다.
            </p>
          )}
      </CardContent>
    </Card>
  );
}
