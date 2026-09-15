import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LearningStatsSection } from "../components/LearningStatsSection";
import type { LearningStats } from "../queries";

function makeStats(overrides: Partial<LearningStats> = {}): LearningStats {
  return {
    totalNotes: 0,
    completedReviews: 0,
    todayReviews: 0,
    reviewWaitingCount: 0,
    completedNotesCount: 0,
    notesByRound: [],
    recentActivity: [],
    studyStreak: { current: 0, longest: 0 },
    onTimeRate: { completed: 0, onTime: 0 },
    ...overrides,
  };
}

// queries.ts가 0~5회차를 항상 채워 보내는 형태 그대로 흉내 낸다.
const FULL_ROUNDS = [
  { round: 0, count: 1 },
  { round: 1, count: 3 },
  { round: 2, count: 0 },
  { round: 3, count: 0 },
  { round: 4, count: 0 },
  { round: 5, count: 4 },
];

describe("LearningStatsSection 단계별 복습 현황", () => {
  it("노트가 없는 단계도 빈 줄로 남기고 마지막에 학습 완료 줄을 붙인다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({
          totalNotes: 10,
          completedNotesCount: 2,
          notesByRound: FULL_ROUNDS,
        })}
      />,
    );

    const section = screen.getByRole("heading", {
      name: "단계별 복습 현황",
    }).parentElement;
    if (!section) throw new Error("단계별 복습 현황 섹션을 찾지 못했다");

    const labels = within(section)
      .getAllByText(/복습 전|^\d+회|복습 완료/)
      .map((el) => el.textContent);
    expect(labels).toEqual([
      "복습 전",
      "1회",
      "2회",
      "3회",
      "4회",
      "5회 이상",
      "복습 완료",
    ]);
  });

  it("비율의 분모는 전체 노트라 진행 중 + 완료 줄의 합이 100%가 된다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({
          totalNotes: 10,
          completedNotesCount: 2,
          notesByRound: FULL_ROUNDS,
        })}
      />,
    );

    expect(screen.getByText("1 (10%)")).toBeInTheDocument();
    expect(screen.getByText("3 (30%)")).toBeInTheDocument();
    expect(screen.getByText("4 (40%)")).toBeInTheDocument();
    expect(screen.getByText("2 (20%)")).toBeInTheDocument();
    expect(screen.getAllByText("0 (0%)")).toHaveLength(3);
  });

  it("학습 완료 막대는 단계 막대와 다른 색을 쓴다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({
          totalNotes: 3,
          completedNotesCount: 1,
          notesByRound: [
            { round: 0, count: 2 },
            { round: 1, count: 0 },
            { round: 2, count: 0 },
            { round: 3, count: 0 },
            { round: 4, count: 0 },
            { round: 5, count: 0 },
          ],
        })}
      />,
    );

    const completedRow = screen.getByText("복습 완료").parentElement;
    const stageRow = screen.getByText("복습 전").parentElement;
    if (!completedRow || !stageRow) throw new Error("줄을 찾지 못했다");

    expect(completedRow.querySelector(".bg-emerald-500")).not.toBeNull();
    expect(completedRow.querySelector(".bg-chart-3")).toBeNull();
    expect(stageRow.querySelector(".bg-chart-3")).not.toBeNull();
  });

  it("모든 노트가 완료 상태여도 그래프를 보여준다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({
          totalNotes: 2,
          completedNotesCount: 2,
          notesByRound: [
            { round: 0, count: 0 },
            { round: 1, count: 0 },
            { round: 2, count: 0 },
            { round: 3, count: 0 },
            { round: 4, count: 0 },
            { round: 5, count: 0 },
          ],
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "단계별 복습 현황" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 (100%)")).toBeInTheDocument();
  });

  it("노트가 하나도 없으면 그래프를 숨긴다", () => {
    render(<LearningStatsSection stats={makeStats({ totalNotes: 0 })} />);

    expect(
      screen.queryByRole("heading", { name: "단계별 복습 현황" }),
    ).not.toBeInTheDocument();
  });
});

describe("LearningStatsSection 최근 30일 활동", () => {
  const recentActivity = Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return { date: `2026-04-${day}`, count: i === 2 ? 3 : i === 29 ? 1 : 0 };
  });

  it("히트맵 옆에 합계, 아래에 시작일과 오늘을 글자로 보여준다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({ totalNotes: 1, recentActivity })}
      />,
    );

    expect(screen.getByText("복습 완료 4건")).toBeInTheDocument();
    expect(screen.getByText("4월 1일")).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
  });

  it("칸 툴팁은 날짜와 건수를 같은 표기로 쓴다", () => {
    render(
      <LearningStatsSection
        stats={makeStats({ totalNotes: 1, recentActivity })}
      />,
    );

    expect(screen.getByTitle("4월 3일 복습 3건")).toBeInTheDocument();
    expect(screen.getByTitle("4월 30일 복습 1건")).toBeInTheDocument();
  });
});
