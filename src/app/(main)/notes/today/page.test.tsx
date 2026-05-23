import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { createClientMock, getTodayReviewNotesMock, redirectMock, cookiesMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    getTodayReviewNotesMock: vi.fn(),
    redirectMock: vi.fn(),
    cookiesMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/notes/queries", () => ({
  getTodayReviewNotes: getTodayReviewNotesMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/notes/today",
}));

import TodayReviewPage from "./page";

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

describe("TodayReviewPage", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getTodayReviewNotesMock.mockReset();
    redirectMock.mockReset();
    cookiesMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    cookiesMock.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
  });

  it("미인증 사용자를 로그인 페이지로 redirect한다", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(TodayReviewPage()).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getTodayReviewNotesMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "이메일 미인증 사용자(email_confirmed_at: %s)를 인증 페이지로 redirect한다",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createSupabaseMock("user-123", emailConfirmedAt),
      );

      await expect(TodayReviewPage()).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(getTodayReviewNotesMock).not.toHaveBeenCalled();
    },
  );

  it("인증된 사용자에게 오늘의 복습 페이지를 렌더링한다", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getTodayReviewNotesMock.mockResolvedValue([]);

    render(await TodayReviewPage());

    expect(getTodayReviewNotesMock).toHaveBeenCalledWith("user-123");
    expect(
      screen.getByRole("heading", { name: "오늘의 복습" }),
    ).toBeInTheDocument();
  });

  it("복습할 노트가 없을 때 빈 상태 메시지를 표시한다", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getTodayReviewNotesMock.mockResolvedValue([]);

    render(await TodayReviewPage());

    expect(
      screen.getByText("오늘 예정된 복습이 없습니다."),
    ).toBeInTheDocument();
  });

  it("DB 조회 오류가 발생하면 빈 상태로 대체하지 않고 error boundary로 전파한다", async () => {
    const dbError = new Error("DB connection failed");
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getTodayReviewNotesMock.mockRejectedValue(dbError);

    await expect(TodayReviewPage()).rejects.toBe(dbError);
  });
});
