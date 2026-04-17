import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteReviewRoute, ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOT_FOUND_ERROR = new Error("NEXT_NOT_FOUND");

const { createClientMock, getNoteByIdMock, notFoundMock, redirectMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    getNoteByIdMock: vi.fn(),
    notFoundMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/notes/queries", () => ({
  getNoteById: getNoteByIdMock,
}));

vi.mock("@/features/notes/components/NoteViewer", () => ({
  NoteViewer: ({
    content,
    language,
  }: {
    content: string;
    language: string | null;
  }) => <div data-testid="note-viewer">{`${language}:${content}`}</div>,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import NoteDetailPage from "./page";

function createSupabaseMock(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  };
}

describe("NoteDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));

    createClientMock.mockReset();
    getNoteByIdMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    notFoundMock.mockImplementation(() => {
      throw NOT_FOUND_ERROR;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(
      NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNoteByIdMock).not.toHaveBeenCalled();
  });

  it("renders a review entry point when the note is due for review", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Test note",
      content: "note body",
      language: "markdown",
      next_review_at: "2026-03-29T09:00:00.000Z",
      review_round: 1,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    expect(getNoteByIdMock).toHaveBeenCalledWith("note-123", "user-123");
    expect(
      screen.getByRole("heading", { name: "Test note" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("note-viewer")).toHaveTextContent(
      "markdown:note body",
    );
    expect(
      screen.getByText("지금 백지 테스트를 진행할 수 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "백지 테스트 시작" }),
    ).toHaveAttribute("href", getNoteReviewRoute("note-123"));
  });

  it("shows the next review schedule when the note is not due yet", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Future review note",
      content: "note body",
      language: "markdown",
      next_review_at: "2026-03-30T09:00:00.000Z",
      review_round: 1,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    expect(screen.getByText(/다음 백지 테스트 예정/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "백지 테스트 시작" }),
    ).not.toBeInTheDocument();
  });

  it("returns not found when the note does not exist for the current user", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(null);

    await expect(
      NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    ).rejects.toBe(NOT_FOUND_ERROR);

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
