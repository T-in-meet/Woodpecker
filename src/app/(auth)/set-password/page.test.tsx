import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const getHasPasswordLoginMock = vi.hoisted(() => vi.fn());
const readSetPasswordIntentMock = vi.hoisted(() => vi.fn());
const verifySetPasswordIntentMock = vi.hoisted(() => vi.fn());
const validateRedirectPathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const logAuthErrorMock = vi.hoisted(() => vi.fn());
const setPasswordBoundActionMock = vi.hoisted(() => vi.fn());
const setPasswordActionMock = vi.hoisted(() => {
  const action = vi.fn();
  action.bind = vi.fn(() => setPasswordBoundActionMock);
  return action;
});
const SetPasswordFormMock = vi.hoisted(() => vi.fn());
const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const SIGNED_SET_PASSWORD_INTENT = "signed-set-password-intent";
const VALID_SET_PASSWORD_INTENT = {
  purpose: "signup-set-password",
  userId: "user-id",
  issuedAt: 1_700_000_000,
  expiresAt: 1_700_000_900,
};

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: getUserMock,
}));

vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  readSetPasswordIntent: readSetPasswordIntentMock,
  verifySetPasswordIntent: verifySetPasswordIntentMock,
}));

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: validateRedirectPathMock,
}));

vi.mock("@/features/auth/lib/authLogger", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/lib/authLogger")>();

  return {
    ...actual,
    logAuthError: logAuthErrorMock,
  };
});

vi.mock("@/features/auth/set-password/actions/setPasswordAction", () => ({
  setPasswordAction: setPasswordActionMock,
}));

vi.mock("@/features/auth/set-password/components/SetPasswordForm", async () => {
  const React = await import("react");

  return {
    SetPasswordForm: (props: { action: unknown }) => {
      SetPasswordFormMock(props);

      return React.createElement("div", {
        "data-testid": "set-password-form",
      });
    },
  };
});

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { ROUTES } from "@/lib/constants/routes";

import SetPasswordPage from "./page";

function makeUser(): User {
  return {
    app_metadata: { providers: ["google"] },
    aud: "authenticated",
    created_at: "2026-08-03T00:00:00.000Z",
    id: "user-id",
    user_metadata: {},
  } as User;
}

describe("SetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    getUserMock.mockResolvedValue(makeUser());
    getHasPasswordLoginMock.mockResolvedValue(false);
    readSetPasswordIntentMock.mockResolvedValue(SIGNED_SET_PASSWORD_INTENT);
    verifySetPasswordIntentMock.mockReturnValue(VALID_SET_PASSWORD_INTENT);

    validateRedirectPathMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : ROUTES.MYPAGE,
    );
  });

  it("비밀번호가 없는 인증 사용자가 valid Set Intent를 가지면 비밀번호 설정 폼을 렌더링한다", async () => {
    const element = await SetPasswordPage({
      searchParams: Promise.resolve({}),
    });

    render(element);

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_SET_PASSWORD_INTENT,
      expectedUserId: "user-id",
    });
    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(null, null);
    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });

  it("인증되지 않은 사용자는 signup으로 redirect한다", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SIGNUP);
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("이미 비밀번호가 있고 Set Intent가 없으면 request redirect를 무시하고 mypage로 redirect한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);
    readSetPasswordIntentMock.mockResolvedValue(null);
    validateRedirectPathMock.mockReturnValue("/notes");

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({ redirect: "/notes" }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(redirectMock).not.toHaveBeenCalledWith("/notes");
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("이미 비밀번호가 있고 Set Intent가 남아 있으면 verifier 없이 cleanup route로 redirect한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);
    readSetPasswordIntentMock.mockResolvedValue(SIGNED_SET_PASSWORD_INTENT);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({ redirect: "/notes" }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/api/auth/set-password/cleanup");
    expect(redirectMock).not.toHaveBeenCalledWith("/notes");
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("비밀번호가 없고 redirect가 있으면 valid Set Intent 검증 후 redirect를 Server Action에 bind한다", async () => {
    validateRedirectPathMock.mockReturnValue("/notes");

    const element = await SetPasswordPage({
      searchParams: Promise.resolve({ redirect: "/notes" }),
    });

    render(element);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_SET_PASSWORD_INTENT,
      expectedUserId: "user-id",
    });
    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(null, "/notes");
    expect(SetPasswordFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: setPasswordBoundActionMock,
      }),
    );
    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });

  it("유효하지 않은 redirect는 valid Set Intent 성공 경로에서 검증 결과를 사용한다", async () => {
    validateRedirectPathMock.mockReturnValue(ROUTES.MYPAGE);

    const element = await SetPasswordPage({
      searchParams: Promise.resolve({
        redirect: "https://example.com",
      }),
    });

    render(element);

    expect(validateRedirectPathMock).toHaveBeenCalledWith(
      "https://example.com",
    );
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_SET_PASSWORD_INTENT,
      expectedUserId: "user-id",
    });
    expect(setPasswordActionMock.bind).toHaveBeenCalledWith(
      null,
      ROUTES.MYPAGE,
    );
    expect(screen.getByTestId("set-password-form")).toBeInTheDocument();
  });

  it("비밀번호 상태 조회 실패를 Auth 로그에 기록하고 오류를 다시 전파한다", async () => {
    const lookupError = new Error("password login status lookup failed");

    getHasPasswordLoginMock.mockRejectedValue(lookupError);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(lookupError);

    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(logAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      {
        path: ROUTES.SET_PASSWORD,
        method: "GET",
        status: 500,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        userId: "user-id",
        errorMessage: "password login status lookup failed",
        errorName: "Error",
      },
    );
    expect(redirectMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("Set Intent가 없으면 mypage로 redirect하고 verifier를 호출하지 않는다", async () => {
    readSetPasswordIntentMock.mockResolvedValue(null);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("invalid Set Intent는 request redirect를 사용하지 않고 cleanup route로 redirect한다", async () => {
    validateRedirectPathMock.mockReturnValue("/notes");
    verifySetPasswordIntentMock.mockReturnValue(null);

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({ redirect: "/notes" }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_SET_PASSWORD_INTENT,
      expectedUserId: "user-id",
    });
    expect(redirectMock).toHaveBeenCalledWith("/api/auth/set-password/cleanup");
    expect(redirectMock).not.toHaveBeenCalledWith("/notes");
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });

  it("Set Intent verifier configuration error를 redirect로 숨기지 않고 그대로 전파한다", async () => {
    const configurationError = new Error(
      "PASSWORD_INTENT_SIGNING_SECRET is not configured",
    );

    verifySetPasswordIntentMock.mockImplementation(() => {
      throw configurationError;
    });

    await expect(
      SetPasswordPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(configurationError);

    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("user-id");
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: SIGNED_SET_PASSWORD_INTENT,
      expectedUserId: "user-id",
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(setPasswordActionMock.bind).not.toHaveBeenCalled();
    expect(SetPasswordFormMock).not.toHaveBeenCalled();
  });
});
