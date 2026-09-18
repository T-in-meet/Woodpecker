import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { SET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import { ROUTES } from "@/lib/constants/routes";

import { INITIAL_SET_PASSWORD_ACTION_STATE } from "./setPasswordActionState";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const {
  createClientMock,
  getUserMock,
  updateUserMock,
  redirectMock,
  validateRedirectPathMock,
  getHasPasswordLoginMock,
  readSetPasswordIntentMock,
  verifySetPasswordIntentMock,
  clearSetPasswordIntentMock,
  isAuthErrorMock,
  isAuthSessionMissingErrorMock,
  logRequestedMock,
  logAuthEventMock,
  logAuthErrorMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  redirectMock: vi.fn(),
  validateRedirectPathMock: vi.fn(),
  getHasPasswordLoginMock: vi.fn(),
  readSetPasswordIntentMock: vi.fn(),
  verifySetPasswordIntentMock: vi.fn(),
  clearSetPasswordIntentMock: vi.fn(),
  isAuthErrorMock: vi.fn(),
  isAuthSessionMissingErrorMock: vi.fn(),
  logRequestedMock: vi.fn(),
  logAuthEventMock: vi.fn(),
  logAuthErrorMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  isAuthError: isAuthErrorMock,
  isAuthSessionMissingError: isAuthSessionMissingErrorMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: validateRedirectPathMock,
}));

vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  readSetPasswordIntent: readSetPasswordIntentMock,
  verifySetPasswordIntent: verifySetPasswordIntentMock,
  clearSetPasswordIntent: clearSetPasswordIntentMock,
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: logRequestedMock,
  logAuthEvent: logAuthEventMock,
  logAuthError: logAuthErrorMock,
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

import { setPasswordAction } from "./setPasswordAction";

function makeFormData(input: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(input)) {
    formData.set(key, value);
  }

  return formData;
}

const SET_PASSWORD_TERMINAL_EVENTS = new Set<string>([
  AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
  AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED,
  AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
  AUTH_EVENTS.AUTH_SET_PASSWORD_INVALID_INPUT,
  AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
]);

function getSetPasswordTerminalEventCallCount() {
  const fromLogAuthEvent = logAuthEventMock.mock.calls.filter((call) =>
    SET_PASSWORD_TERMINAL_EVENTS.has(String(call[0])),
  ).length;
  const fromLogAuthError = logAuthErrorMock.mock.calls.filter((call) =>
    SET_PASSWORD_TERMINAL_EVENTS.has(String(call[0])),
  ).length;

  return fromLogAuthEvent + fromLogAuthError;
}

describe("setPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
        updateUser: updateUserMock,
      },
    } as never);

    getUserMock.mockResolvedValue({
      data: {
        user: {
          app_metadata: { providers: ["google"] },
          email: "oauth.user@example.com",
          id: "oauth-user-id",
        },
      },
      error: null,
    });

    updateUserMock.mockResolvedValue({
      data: { user: {} },
      error: null,
    });

    getHasPasswordLoginMock.mockResolvedValue(false);
    isAuthErrorMock.mockReturnValue(false);
    isAuthSessionMissingErrorMock.mockReturnValue(false);
    readSetPasswordIntentMock.mockResolvedValue("signed-set-intent");
    verifySetPasswordIntentMock.mockReturnValue({
      purpose: "signup-set-password",
      userId: "oauth-user-id",
      issuedAt: 1,
      expiresAt: 2,
    });
    clearSetPasswordIntentMock.mockResolvedValue(undefined);

    validateRedirectPathMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : ROUTES.MYPAGE,
    );
  });

  it("검증된 사용자와 valid signed Intent면 password를 설정하고 Intent를 clear한 뒤 mypage로 redirect한다", async () => {
    await expect(
      setPasswordAction(
        null,
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith("oauth-user-id");
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: "signed-set-intent",
      expectedUserId: "oauth-user-id",
    });
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(updateUserMock).toHaveBeenCalledWith({
      password: "Password123!",
    });
    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.any(Object),
    );
    expect(logAuthErrorMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("valid signed Intent 성공 경로에서 redirectPath를 검증 후 사용한다", async () => {
    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/notes");
    expect(redirectMock).toHaveBeenCalledWith("/notes");
  });

  it("사용자가 없으면 signup으로 redirect하고 Intent 단계나 password update에 진입하지 않는다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      setPasswordAction(
        null,
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SIGNUP);
  });

  it("Auth session missing error는 unauthenticated로 처리하고 Intent를 읽지 않는다", async () => {
    const sessionMissingError = new Error("Auth session missing!");
    isAuthSessionMissingErrorMock.mockReturnValueOnce(true);
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: sessionMissingError,
    });

    await expect(
      setPasswordAction(
        null,
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SIGNUP);
  });

  it("사용자 조회 system error면 password를 설정하지 않고 internal_error를 반환한다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("get user failed"),
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("Password Login이 이미 있고 Intent가 있으면 verifier/update 없이 cleanup으로 보낸다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);

    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(SET_PASSWORD_INTENT_CLEANUP_PATH);
  });

  it("Password Login이 이미 있고 Intent가 없으면 fixed MYPAGE로 종료한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(true);
    readSetPasswordIntentMock.mockResolvedValue(null);

    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("Password Login이 없고 Intent가 missing이면 clear/update 없이 fixed MYPAGE로 종료한다", async () => {
    readSetPasswordIntentMock.mockResolvedValue(null);

    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("Set Intent read system error는 missing으로 downgrade하지 않고 internal_error를 반환한다", async () => {
    readSetPasswordIntentMock.mockRejectedValue(
      new Error("set intent read failed"),
    );

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("Set Intent verifier가 null이면 direct clear/update 없이 cleanup으로 보낸다", async () => {
    verifySetPasswordIntentMock.mockReturnValue(null);

    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(SET_PASSWORD_INTENT_CLEANUP_PATH);
  });

  it("Set Intent verifier system error는 invalid로 downgrade하지 않고 Intent를 유지한다", async () => {
    verifySetPasswordIntentMock.mockImplementation(() => {
      throw new Error("signing secret unavailable");
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("비밀번호 검증에 실패하면 Intent/Auth dependency에 진입하지 않고 invalid_input을 반환한다", async () => {
    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "short",
        confirmPassword: "different",
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("비밀번호 존재 여부 조회가 실패하면 Intent 단계에 진입하지 않고 internal_error를 반환한다", async () => {
    getHasPasswordLoginMock.mockRejectedValue(new Error("RPC failed"));

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("Supabase updateUser가 실패하면 internal_error를 반환하고 Set Intent를 유지한다", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("update failed"),
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("same_password에서는 Set Intent를 clear하지 않는다", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { status: 422, code: "same_password" },
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({
      status: "internal_error",
      reason: "same_password",
    });
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("updateUser throw에서도 Set Intent를 clear하지 않는다", async () => {
    updateUserMock.mockRejectedValue(new Error("network error"));

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("update 성공 후 direct clear 실패면 cleanup으로 전환하고 update를 재호출하지 않는다", async () => {
    clearSetPasswordIntentMock.mockRejectedValue(
      new Error("set intent clear failed"),
    );

    await expect(
      setPasswordAction(
        "/notes",
        INITIAL_SET_PASSWORD_ACTION_STATE,
        makeFormData({
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(SET_PASSWORD_INTENT_CLEANUP_PATH);
    expect(redirectMock).not.toHaveBeenCalledWith("/notes");
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 303,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PASSWORD_INTENT_CLEANUP_FAILED,
      }),
    );
    expect(logAuthErrorMock).toHaveBeenCalledTimes(1);
    expect(logAuthEventMock).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.anything(),
    );
  });

  it("Provider 429 반환이면 blocked를 반환하고 Set Intent를 유지한다", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { status: 429, code: undefined },
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "blocked" });
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        status: 429,
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(logAuthErrorMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.anything(),
    );
    expect(getSetPasswordTerminalEventCallCount()).toBe(1);
  });

  it("throw된 Auth 429도 blocked로 수렴하고 terminal event를 중복 기록하지 않는다", async () => {
    const authRateLimitError = {
      status: 429,
      code: "unexpected_rate_limit_code",
      message: "rate limited",
    };

    isAuthErrorMock.mockImplementation((error) => error === authRateLimitError);
    updateUserMock.mockRejectedValue(authRateLimitError);

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "blocked" });
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        status: 429,
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(logAuthErrorMock).not.toHaveBeenCalled();
    expect(getSetPasswordTerminalEventCallCount()).toBe(1);
  });

  it("일반 Provider error는 PROVIDER_ERROR를 기록하고 민감값을 로그에 남기지 않는다", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: {
        status: 500,
        code: "unexpected_failure",
        message: "provider failed",
      },
    });

    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 500,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );

    const payload = logAuthErrorMock.mock.calls.find(
      (call) => call[0] === AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
    )?.[1] as Record<string, unknown> | undefined;

    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("confirmPassword");
  });

  it("same_password는 SAME_PASSWORD + 422를 기록한다", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { status: 422, code: "same_password" },
    });

    await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    );

    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 422,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SAME_PASSWORD,
      }),
    );
  });
});
