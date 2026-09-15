import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { NotesEmptyState } from "../components/NotesEmptyState";
import { buildNotesUrl } from "../utils/buildNotesUrl";

describe("NotesEmptyState", () => {
  it.each([
    ["all", "첫 노트 작성", ROUTES.NOTES_NEW],
    ["due", "복습 예정 보기", buildNotesUrl({ view: "scheduled" })],
    ["scheduled", "노트 작성", ROUTES.NOTES_NEW],
    ["completed", "전체 노트 보기", ROUTES.NOTES],
  ] as const)("%s 빈 화면에서 다음 행동으로 연결한다", (view, label, href) => {
    render(<NotesEmptyState view={view} query="" />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  });
  it.each(["all", "due", "scheduled", "completed"] as const)(
    "%s 검색 초기화는 필터를 유지한다",
    (view) => {
      render(<NotesEmptyState view={view} query="없는 검색어" />);
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("link", { name: "검색 초기화" })).toHaveAttribute(
        "href",
        buildNotesUrl({ view }),
      );
    },
  );
});
