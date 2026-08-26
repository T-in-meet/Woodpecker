import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";
import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { getUserMock, getNotesMock, redirectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getNotesMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: getUserMock,
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

function createUser(userId: string | null, emailConfirmedAt?: string | null) {
  const resolvedEmailConfirmedAt =
    arguments.length > 1 ? emailConfirmedAt : "2026-03-29T00:00:00.000Z";

  return userId
    ? { id: userId, email_confirmed_at: resolvedEmailConfirmedAt }
    : null;
}

describe("NotesPage", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getNotesMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  it("redirects to login when the user is not authenticated", async () => {
    getUserMock.mockResolvedValue(createUser(null));

    await expect(NotesPage({ searchParams: Promise.resolve({}) })).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNotesMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "redirects to resend email when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      getUserMock.mockResolvedValue(createUser("user-123", emailConfirmedAt));

      await expect(
        NotesPage({ searchParams: Promise.resolve({}) }),
      ).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(getNotesMock).not.toHaveBeenCalled();
    },
  );

  it("renders the note list for authenticated users", async () => {
    getUserMock.mockResolvedValue(createUser("user-123"));
    getNotesMock.mockResolvedValue({
      notes: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "테스트 노트",
          content: "테스트 내용",
          next_review_at: null,
          review_round: 3,
        },
      ],
      total: 1,
    });

    render(await NotesPage({ searchParams: Promise.resolve({}) }));

    expect(getNotesMock).toHaveBeenCalledWith(
      "user-123",
      1,
      "",
      NOTES_PAGE_SIZE,
      "all",
    );
    expect(
      screen.getByRole("heading", { name: "노트 목록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /테스트 노트/ }),
    ).toBeInTheDocument();
  });

  it("보기 파라미터에 따라 상태별 노트를 조회한다", async () => {
    getUserMock.mockResolvedValue(createUser("user-123"));
    getNotesMock.mockResolvedValue({ notes: [], total: 0 });

    render(
      await NotesPage({
        searchParams: Promise.resolve({ view: "scheduled" }),
      }),
    );

    expect(getNotesMock).toHaveBeenCalledWith(
      "user-123",
      1,
      "",
      NOTES_PAGE_SIZE,
      "scheduled",
    );
    expect(
      screen.getByRole("button", { name: "복습 예정" }),
    ).toBeInTheDocument();
  });

  it("DB 조회 오류가 발생하면 빈 목록으로 대체하지 않고 error boundary로 전파한다", async () => {
    const dbError = new Error("DB connection failed");
    getUserMock.mockResolvedValue(createUser("user-123"));
    getNotesMock.mockRejectedValue(dbError);

    await expect(NotesPage({ searchParams: Promise.resolve({}) })).rejects.toBe(
      dbError,
    );
  });
});
