import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListItem } from "../components/NoteListItem";
import { NotesViewContainer } from "../components/NotesViewContainer";

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
  const searchNote = {
    id: "note-search",
    title: "React 학습",
    content: "가".repeat(100) + "React 설명" + "나".repeat(100),
    review_completed_at: null,
    review_round: 0,
    next_review_at: null,
  };

  it("passes the search phrase from the list and highlights title and excerpt", () => {
    const { container } = render(
      <NotesViewContainer
        notes={[searchNote]}
        total={1}
        currentPage={1}
        pageSize={10}
        query="react"
        view="all"
      />,
    );
    expect(
      Array.from(
        container.querySelectorAll("mark"),
        (mark) => mark.textContent,
      ),
    ).toEqual(["React", "React"]);
    expect(container.textContent).toContain("…" + "가".repeat(40));
    expect(container.textContent).not.toContain("가".repeat(100));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/notes/note-search",
    );
    expect(screen.getByRole("link")).not.toContainElement(
      screen.getByRole("button", { name: "노트 액션" }),
    );
  });

  it("keeps the original preview when not searching", () => {
    const { container } = render(<NoteListItem note={searchNote} />);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.getByText(searchNote.content)).toBeInTheDocument();
  });

  it("explains matches that occur only in the source", () => {
    render(
      <NoteListItem
        note={{ ...searchNote, content: "[문서](https://example.com)" }}
        query="example"
      />,
    );
    expect(
      screen.getByText("노트 원문에서 검색어가 일치합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("문서")).toBeInTheDocument();
  });

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
          review_completed_at: null,
          review_round: 1,
          next_review_at: "2026-04-28T15:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("복습일")).toBeInTheDocument();
    expect(screen.getByText("2일 지남")).toBeInTheDocument();
    expect(screen.queryByText("2026. 4. 29 예정")).not.toBeInTheDocument();
  });

  // 상세는 예정일 전에도 진입할 수 있었는데 목록만 막고 있었다. 기준을 상세에 맞춘다.
  it("예정일이 아직 오지 않은 노트에도 복습 시작을 노출한다", () => {
    render(
      <NoteListItem
        note={{
          id: "2ae21b49-24d3-4dc2-b0e9-a399b02df514",
          title: "예정 노트",
          content: "복습할 내용",
          review_completed_at: null,
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
          review_completed_at: null,
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
          review_completed_at: null,
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
