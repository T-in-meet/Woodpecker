import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const LEGAL_REDIRECT_ERROR = new Error("NEXT_REDIRECT:/agreements");
const MYPAGE_PROFILE_PATH = `${ROUTES.MYPAGE}?section=profile`;

const {
  createClientMock,
  createSetPasswordIntentMock,
  getHasPasswordLoginMock,
  getUserMock,
  isAuthSessionMissingErrorMock,
  redirectMock,
  requireCurrentLegalAcceptanceMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSetPasswordIntentMock: vi.fn(),
  getHasPasswordLoginMock: vi.fn(),
  getUserMock: vi.fn(),
  isAuthSessionMissingErrorMock: vi.fn(),
  redirectMock: vi.fn(),
  requireCurrentLegalAcceptanceMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  isAuthSessionMissingError: isAuthSessionMissingErrorMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  createSetPasswordIntent: createSetPasswordIntentMock,
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: requireCurrentLegalAcceptanceMock,
}));

import { startSetPasswordFromMypageAction } from "./startSetPasswordFromMypageAction";

describe("startSetPasswordFromMypageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    } as never);

    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "oauth.user@example.com",
          email_confirmed_at: "2026-09-18T00:00:00.000Z",
          id: "oauth-user-id",
        },
      },
      error: null,
    });

    isAuthSessionMissingErrorMock.mockReturnValue(false);
    requireCurrentLegalAcceptanceMock.mockResolvedValue(undefined);
    getHasPasswordLoginMock.mockResolvedValue(false);
    createSetPasswordIntentMock.mockResolvedValue(undefined);
  });

  it("비밀번호가 없는 정상 사용자는 MyPage profile destination을 signed Intent에 넣고 plain set-password로 이동한다", async () => {
    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      "oauth-user-id",
      MYPAGE_PROFILE_PATH,
    );
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("oauth-user-id");
    expect(createSetPasswordIntentMock).toHaveBeenCalledWith({
      userId: "oauth-user-id",
      redirectPath: MYPAGE_PROFILE_PATH,
    });
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SET_PASSWORD);
    expect(redirectMock).not.toHaveBeenCalledWith(
      expect.stringContaining("?redirect="),
    );
  });

  it("인증 사용자가 없으면 Intent를 발급하지 않고 login으로 이동한다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it("세션 없음 오류이면 Intent를 발급하지 않고 login으로 이동한다", async () => {
    const sessionError = new Error("session missing");

    getUserMock.mockResolvedValue({
      data: { user: null },
      error: sessionError,
    });
    isAuthSessionMissingErrorMock.mockReturnValue(true);

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it("사용자 조회 system error는 login 없음으로 낮추지 않고 전파한다", async () => {
    const authError = new Error("auth failed");

    getUserMock.mockResolvedValue({
      data: { user: null },
      error: authError,
    });

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(authError);

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("이메일 미인증 사용자는 Intent를 발급하지 않고 signup 인증 흐름으로 이동한다", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "oauth.user@example.com",
          email_confirmed_at: null,
          id: "oauth-user-id",
        },
      },
      error: null,
    });

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup&email=oauth.user%40example.com`,
    );
  });

  it("법적 동의 확인이 redirect로 흐름을 종료하면 Password Login 조회와 Intent 발급을 실행하지 않는다", async () => {
    requireCurrentLegalAcceptanceMock.mockRejectedValue(LEGAL_REDIRECT_ERROR);

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      LEGAL_REDIRECT_ERROR,
    );

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      "oauth-user-id",
      MYPAGE_PROFILE_PATH,
    );
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("Password Login이 이미 있으면 새 Intent 없이 MyPage profile로 이동한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(MYPAGE_PROFILE_PATH);
  });

  it("Password Login 조회 실패 시 Intent를 발급하지 않고 오류를 전파한다", async () => {
    const lookupError = new Error("lookup failed");
    getHasPasswordLoginMock.mockRejectedValue(lookupError);

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(lookupError);

    expect(createSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("Intent 발급 실패 시 set-password로 이동하지 않고 오류를 전파한다", async () => {
    const createError = new Error("create intent failed");
    createSetPasswordIntentMock.mockRejectedValue(createError);

    await expect(startSetPasswordFromMypageAction()).rejects.toBe(createError);

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
