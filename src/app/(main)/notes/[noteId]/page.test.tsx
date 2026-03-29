import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

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
  createClient: createClientMock,
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

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(
      NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNoteByIdMock).not.toHaveBeenCalled();
  });

  it("renders the note when the user owns it", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Test note",
      content: "note body",
      language: "markdown",
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
