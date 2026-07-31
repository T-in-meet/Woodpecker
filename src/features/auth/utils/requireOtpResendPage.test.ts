import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { requireOtpResendPage } from "./requireOtpResendPage";

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("requireOtpResendPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("이메일 인증 완료 사용자는 mypage로 redirect한다", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email_confirmed_at: "2026-05-22T00:00:00.000Z",
        },
      },
    });

    await requireOtpResendPage();

    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("이메일 미인증 사용자는 접근 가능하다", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email_confirmed_at: null,
        },
      },
    });

    await requireOtpResendPage();

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("비로그인 사용자는 접근 가능하다", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    await requireOtpResendPage();

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("현재 사용자 정보를 조회한다", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    await requireOtpResendPage();

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
