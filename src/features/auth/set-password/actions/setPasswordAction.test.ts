import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { INITIAL_SET_PASSWORD_ACTION_STATE } from "./setPasswordActionState";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const {
  createClientMock,
  getSessionMock,
  updateUserMock,
  redirectMock,
  validateRedirectPathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getSessionMock: vi.fn(),
  updateUserMock: vi.fn(),
  redirectMock: vi.fn(),
  validateRedirectPathMock: vi.fn(),
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

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

import { setPasswordAction } from "./setPasswordAction";

/**
 * 테스트용 FormData를 생성합니다.
 */
function makeFormData(input: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    formData.set(key, value);
  }

  return formData;
}

describe("setPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    createClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
        updateUser: updateUserMock,
      },
    } as never);
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: { providers: ["google"] },
            email: "oauth.user@example.com",
          },
        },
      },
    });
    updateUserMock.mockResolvedValue({
      data: { user: {} },
      error: null,
    });
    validateRedirectPathMock.mockImplementation((value: unknown) =>
      typeof value === "string" ? value : ROUTES.MYPAGE,
    );
  });

  it("세션이 있으면 현재 사용자에게 password를 설정하고 mypage로 redirect한다", async () => {
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

    expect(updateUserMock).toHaveBeenCalledWith({
      password: "Password123!",
    });
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("redirectPath가 있으면 검증 후 해당 경로로 redirect한다", async () => {
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

  it("세션이 없으면 signup으로 redirect하고 password를 설정하지 않는다", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
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

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.SIGNUP);
  });

  it("password provider가 있으면 mypage로 redirect하고 password를 설정하지 않는다", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: { providers: ["google", "email"] },
            email: "password.user@example.com",
          },
        },
      },
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

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("비밀번호 검증에 실패하면 invalid_input을 반환한다", async () => {
    const result = await setPasswordAction(
      null,
      INITIAL_SET_PASSWORD_ACTION_STATE,
      makeFormData({
        password: "short",
        confirmPassword: "different",
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("Supabase updateUser가 실패하면 internal_error를 반환한다", async () => {
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
  });
});
