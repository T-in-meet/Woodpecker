import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteListItem } from "../components/NoteListItem";

vi.mock("../components/NoteActions", () => ({
  NoteActions: () => <div data-testid="note-actions" />,
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
});
