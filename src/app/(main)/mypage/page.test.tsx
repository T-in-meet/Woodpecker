import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const {
  getUserMock,
  getProfileMock,
  getLearningStatsMock,
  getHasAnyPushSubscriptionMock,
  getHasPasswordLoginMock,
  logErrorMock,
  redirectMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getProfileMock: vi.fn(),
  getLearningStatsMock: vi.fn(),
  getHasAnyPushSubscriptionMock: vi.fn(),
  getHasPasswordLoginMock: vi.fn(),
  logErrorMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/getUser", () => ({ getUser: getUserMock }));
vi.mock("@/lib/supabase/getProfile", () => ({ getProfile: getProfileMock }));
vi.mock("@/features/mypage/queries", () => ({
  getLearningStats: getLearningStatsMock,
}));
vi.mock("@/features/notifications/queries", () => ({
  getHasAnyPushSubscription: getHasAnyPushSubscriptionMock,
}));
vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));
vi.mock("@/lib/logger", () => ({
  logError: logErrorMock,
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/mypage",
}));

import MyPage from "./page";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  email_confirmed_at: "2026-03-29T00:00:00.000Z",
};

const mockProfile = {
  id: "user-123",
  nickname: "테스트유저",
  avatar_url: null,
  role: "USER" as const,
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-29T00:00:00.000Z",
};

describe("MyPage", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getProfileMock.mockReset();
    getLearningStatsMock.mockReset();
    getHasAnyPushSubscriptionMock.mockReset();
    getHasPasswordLoginMock.mockReset();
    logErrorMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    getUserMock.mockResolvedValue(mockUser);
    getProfileMock.mockResolvedValue(mockProfile);
    getHasAnyPushSubscriptionMock.mockResolvedValue(false);
    getHasPasswordLoginMock.mockResolvedValue(false);
  });

  it("이메일 미인증 사용자는 RESEND_EMAIL?purpose=signup으로 redirect된다", async () => {
    getUserMock.mockResolvedValue({
      ...mockUser,
      email_confirmed_at: null,
    });

    await expect(MyPage({ searchParams: Promise.resolve({}) })).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup`,
    );
  });

  it("비밀번호 로그인 상태 조회 실패는 profile 페이지 전체에 전파하지 않는다", async () => {
    const passwordLookupError = new Error("password login lookup failed");

    getHasPasswordLoginMock.mockRejectedValue(passwordLookupError);

    await expect(
      MyPage({
        searchParams: Promise.resolve({
          section: "profile",
        }),
      }),
    ).resolves.toBeTruthy();

    expect(getHasAnyPushSubscriptionMock).toHaveBeenCalledWith({
      userId: mockUser.id,
    });
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith(mockUser.id);

    expect(logErrorMock).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith({
      event: "mypage.passwordLoginStatusLookup.failed",
      error: passwordLookupError,
      userId: mockUser.id,
    });
  });

  it("DB 조회 오류가 발생하면 빈 상태로 대체하지 않고 error boundary로 전파한다", async () => {
    const dbError = new Error("DB connection failed");
    getLearningStatsMock.mockRejectedValue(dbError);

    await expect(
      MyPage({
        searchParams: Promise.resolve({
          section: "stats",
        }),
      }),
    ).rejects.toBe(dbError);
  });
});
