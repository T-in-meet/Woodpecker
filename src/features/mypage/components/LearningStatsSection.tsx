import Link from "next/link";
import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";
import { MAX_REVIEW_ROUND_BUCKET } from "@/lib/constants/reviewIntervals";
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
      <p className="text-prose-ko text-sm text-muted-foreground">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border p-2 text-center cursor-pointer transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-4"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border p-2 text-center sm:p-4">{content}</div>
  );
}

// 복습 횟수에 상한이 없으므로 0회만 이름을 주고 나머지는 숫자로 만든다.
// 단위("복습")는 섹션 제목이 한 번만 말하고 줄에는 횟수만 둔다. 줄마다 붙이면
// 같은 단어가 반복돼 읽기 어렵다. 시작·끝은 "복습 전"·"복습 완료"로 대칭을 맞추고,
// "복습 완료"는 노트 목록 필터·통계 타일·메뉴와 같은 표현이다.
const NOTES_ROUND_LABELS: Record<number, string> = {
  0: "복습 전",
};

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/**
 * "YYYY-MM-DD" 형태의 KST 날짜 키를 "M월 D일"로 바꾼다.
 * `new Date("YYYY-MM-DD")`는 UTC 자정으로 해석돼 KST 기준으로 하루가 밀릴 수 있어서
 * Date를 거치지 않고 문자열을 직접 읽는다.
 */
function formatKstDateKey(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function heatmapClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 2) return "bg-chart-1";
  if (count <= 4) return "bg-chart-2";
  return "bg-chart-3";
}

export function LearningStatsSection({ stats }: LearningStatsSectionProps) {
  const isEmpty =
    stats.totalNotes === 0 &&
    stats.completedReviews === 0 &&
    stats.todayReviews === 0;

  // 단계 줄(진행 중) + 학습 완료 줄이 노트 전체를 덮으므로 분모는 전체 노트다.
  // 완료 노트는 어느 회차에서든 사용자가 직접 표시할 수 있어 "5회차 다음 단계"가
  // 아니다. 사다리 끝의 종착 상태로 색을 갈라 보여준다.
  const stageRows = [
    ...stats.notesByRound.map(({ round, count }) => ({
      key: `round-${round}`,
      label:
        NOTES_ROUND_LABELS[round] ??
        (round >= MAX_REVIEW_ROUND_BUCKET ? `${round}회 이상` : `${round}회`),
      count,
      barClass: "bg-chart-3",
    })),
    {
      key: "completed",
      label: "복습 완료",
      count: stats.completedNotesCount,
      barClass: "bg-emerald-500",
    },
  ];

  // 히트맵은 색만 보여서 모바일(툴팁 없음)에서는 총량과 기간을 알 수 없다.
  // 합계와 양 끝 날짜를 글자로 함께 둔다.
  const recentActivityTotal = stats.recentActivity.reduce(
    (sum, { count }) => sum + count,
    0,
  );
  const recentActivityStart = stats.recentActivity[0]?.date;

  return (
    <Card>
      <CardHeader>
        <CardTitle>학습 통계</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4 sm:gap-4">
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

        {stats.totalNotes > 0 ? (
          <div>
            <h4 className="mb-3 text-sm font-medium">단계별 복습 현황</h4>
            <div className="space-y-2">
              {stageRows.map(({ key, label, count, barClass }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-muted-foreground">
                    {label}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full w-(--progress-width)",
                        barClass,
                      )}
                      style={
                        {
                          "--progress-width": `${(count / stats.totalNotes) * 100}%`,
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
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-medium">최근 30일 활동</h4>
              <span className="text-xs text-muted-foreground tabular-nums">
                복습 완료 {recentActivityTotal}건
              </span>
            </div>
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
                  title={`${formatKstDateKey(date)} 복습 ${count}건`}
                />
              ))}
            </div>
            {recentActivityStart && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatKstDateKey(recentActivityStart)}</span>
                <span>오늘</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>적음</span>
              <div className="size-3 rounded-sm bg-muted" />
              <div className="size-3 rounded-sm bg-chart-1" />
              <div className="size-3 rounded-sm bg-chart-2" />
              <div className="size-3 rounded-sm bg-chart-3" />
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
