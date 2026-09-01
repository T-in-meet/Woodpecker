import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListItem } from "../components/NoteListItem";

// canReview를 화면에 드러내서 진입 조건을 렌더 결과로 검증한다.
vi.mock("../components/NoteActions", () => ({
  NoteActions: ({ canReview }: { canReview: boolean }) => (
    <>
      <button type="button">노트 액션</button>
      {canReview && <button type="button">복습 시작</button>}
    </>
  ),
}));

describe("NoteListItem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T14:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("연체된 복습의 경과 일수만 표시한다", () => {
    render(
      <NoteListItem
        note={{
          id: "2ae21b49-24d3-4dc2-b0e9-a399b02df514",
          title: "연체 노트",
          content: "복습할 내용",
          review_round: 1,
          next_review_at: "2026-04-28T15:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("복습일")).toBeInTheDocument();
    expect(screen.getByText("2일 지남")).toBeInTheDocument();
    expect(screen.queryByText("2026. 4. 29 예정")).not.toBeInTheDocument();
    expect(screen.queryByText("다음 복습일")).not.toBeInTheDocument();
  });

  // 상세는 예정일 전에도 진입할 수 있었는데 목록만 막고 있었다. 기준을 상세에 맞춘다.
  it("예정일이 아직 오지 않은 노트에도 복습 시작을 노출한다", () => {
    render(
      <NoteListItem
        note={{
          id: "2ae21b49-24d3-4dc2-b0e9-a399b02df514",
          title: "예정 노트",
          content: "복습할 내용",
          review_round: 1,
          next_review_at: "2026-05-08T15:00:00.000Z",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "복습 시작" }),
    ).toBeInTheDocument();
  });

  it("모든 회차를 마친 노트에는 복습 시작을 노출하지 않는다", () => {
    render(
      <NoteListItem
        note={{
          id: "2ae21b49-24d3-4dc2-b0e9-a399b02df514",
          title: "완료 노트",
          content: "복습할 내용",
          review_round: 3,
          next_review_at: null,
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "복습 시작" }),
    ).not.toBeInTheDocument();
  });

  it("노트 액션을 상세 링크 밖에 렌더링한다", () => {
    render(
      <NoteListItem
        note={{
          id: "2ae21b49-24d3-4dc2-b0e9-a399b02df514",
          title: "연체 노트",
          content: "복습할 내용",
          review_round: 1,
          next_review_at: "2026-04-28T15:00:00.000Z",
        }}
      />,
    );

    const detailLink = screen.getByRole("link");
    const noteAction = screen.getByRole("button", { name: "노트 액션" });

    expect(detailLink).not.toContainElement(noteAction);
  });
});
