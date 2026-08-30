import Link from "next/link";
import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import type { LearningStats } from "../queries";

type LearningStatsSectionProps = {
  stats: LearningStats;
};

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border p-4 text-center cursor-pointer transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-lg border p-4 text-center">{content}</div>;
}

const NOTES_ROUND_LABELS: Record<number, string> = {
  0: "학습 전",
  1: "1회차 복습 완료",
  2: "2회차 복습 완료",
  3: "3회차 복습 완료",
};

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function heatmapClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 2) return "bg-orange-100 dark:bg-orange-900";
  if (count <= 4) return "bg-orange-200 dark:bg-orange-800";
  return "bg-orange-300 dark:bg-orange-700";
}

export function LearningStatsSection({ stats }: LearningStatsSectionProps) {
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="전체 노트"
            value={stats.totalNotes}
            href={ROUTES.NOTES}
          />
          <StatCard
            label="오늘 복습할 노트"
            value={stats.todayReviews}
            href={buildNotesUrl({ view: "due" })}
          />
          <StatCard
            label="복습 예정 노트"
            value={stats.reviewWaitingCount}
            href={buildNotesUrl({ view: "scheduled" })}
          />
          <StatCard
            label="복습 완료 노트"
            value={stats.completedNotesCount}
            href={buildNotesUrl({ view: "completed" })}
          />
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

        {stats.notesByRound.some((r) => r.count > 0) ? (
          <div>
            <h4 className="mb-3 text-sm font-medium">단계별 학습 현황</h4>
            <div className="space-y-2">
              {stats.notesByRound.map(({ round, count }) => (
                <div key={round} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-muted-foreground">
                    {NOTES_ROUND_LABELS[round] ?? `${round}회차`}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-orange-300 dark:bg-orange-700 w-(--progress-width)"
                      style={
                        {
                          "--progress-width":
                            stats.totalNotes === 0
                              ? "0%"
                              : `${(count / stats.totalNotes) * 100}%`,
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span className="w-20 text-right text-sm tabular-nums">
                    {count} ({formatPercent(count, stats.totalNotes)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stats.onTimeRate.completed > 0 ? (
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
        ) : null}

        {stats.recentActivity.length > 0 ? (
          <div>
            <h4 className="mb-3 text-sm font-medium">최근 30일 활동</h4>
            <div
              className="grid gap-1 grid-cols-[repeat(var(--activity-days),minmax(0,1fr))]"
              style={
                {
                  "--activity-days": stats.recentActivity.length,
                } as CSSProperties
              }
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
              <div className="size-3 rounded-sm bg-orange-100 dark:bg-orange-900" />
              <div className="size-3 rounded-sm bg-orange-200 dark:bg-orange-800" />
              <div className="size-3 rounded-sm bg-orange-300 dark:bg-orange-700" />
              <span>많음</span>
            </div>
          </div>
        ) : null}

        {isEmpty ? (
          <p className="text-center text-sm text-muted-foreground">
            아직 학습 기록이 없습니다.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
