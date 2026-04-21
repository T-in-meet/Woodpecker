import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { createClientMock, getNotesMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getNotesMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/notes/queries", () => ({
  getNotes: getNotesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import NotesPage from "./page";

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

describe("NotesPage", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getNotesMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(NotesPage()).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNotesMock).not.toHaveBeenCalled();
  });

  it("renders the note list for authenticated users", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNotesMock.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "테스트 노트",
        language: "markdown",
        next_review_at: null,
        review_round: 3,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
    ]);

    render(await NotesPage());

    expect(getNotesMock).toHaveBeenCalledWith("user-123");
    expect(
      screen.getByRole("heading", { name: "기록 목록" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 노트" })).toHaveAttribute(
      "href",
      ROUTES.NOTES_NEW,
    );
    expect(screen.getByRole("link", { name: "테스트 노트" })).toHaveAttribute(
      "href",
      `${ROUTES.NOTES}/11111111-1111-4111-8111-111111111111`,
    );
  });
});
