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
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import NotesPage from "./page";

function createSupabaseMock(
  userId: string | null,
  emailConfirmedAt?: string | null,
) {
  const resolvedEmailConfirmedAt =
    arguments.length > 1 ? emailConfirmedAt : "2026-03-29T00:00:00.000Z";

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: resolvedEmailConfirmedAt }
            : null,
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

    await expect(NotesPage({ searchParams: Promise.resolve({}) })).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNotesMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "redirects to verify email when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createSupabaseMock("user-123", emailConfirmedAt),
      );

      await expect(
        NotesPage({ searchParams: Promise.resolve({}) }),
      ).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(ROUTES.VERIFY_EMAIL);
      expect(getNotesMock).not.toHaveBeenCalled();
    },
  );

  it("renders the note list for authenticated users", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNotesMock.mockResolvedValue({
      notes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "테스트 노트",
          content: "테스트 내용",
          next_review_at: null,
          review_round: 3,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-29T12:00:00.000Z",
        },
      ],
      total: 1,
    });

    render(await NotesPage({ searchParams: Promise.resolve({}) }));

    expect(getNotesMock).toHaveBeenCalledWith("user-123", 1, "", 5);
    expect(
      screen.getByRole("heading", { name: "노트 목록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /테스트 노트/ }),
    ).toBeInTheDocument();
  });
});
