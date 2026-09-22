import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  SET_PASSWORD_COMPLETE_PATH,
  SET_PASSWORD_INTENT_CLEANUP_PATH,
} from "@/features/auth/constants/routes";
import { ROUTES } from "@/lib/constants/routes";

const {
  clearSetPasswordIntentMock,
  createClientMock,
  getHasPasswordLoginMock,
  getUserMock,
  isAuthSessionMissingErrorMock,
  logAuthErrorMock,
  logAuthEventMock,
  logRequestedMock,
  readSetPasswordIntentMock,
  validateRedirectPathMock,
  verifySetPasswordIntentMock,
} = vi.hoisted(() => ({
  clearSetPasswordIntentMock: vi.fn(),
  createClientMock: vi.fn(),
  getHasPasswordLoginMock: vi.fn(),
  getUserMock: vi.fn(),
  isAuthSessionMissingErrorMock: vi.fn(),
  logAuthErrorMock: vi.fn(),
  logAuthEventMock: vi.fn(),
  logRequestedMock: vi.fn(),
  readSetPasswordIntentMock: vi.fn(),
  validateRedirectPathMock: vi.fn(),
  verifySetPasswordIntentMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  isAuthSessionMissingError: isAuthSessionMissingErrorMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/features/auth/lib/getHasPasswordLogin", () => ({
  getHasPasswordLogin: getHasPasswordLoginMock,
}));

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  clearSetPasswordIntent: clearSetPasswordIntentMock,
  readSetPasswordIntent: readSetPasswordIntentMock,
  verifySetPasswordIntent: verifySetPasswordIntentMock,
}));

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: validateRedirectPathMock,
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

import { GET } from "./route";

const REQUEST_URL = "http://localhost:3000/set-password/complete";
const USER_ID = "oauth-user-id";
const SIGNED_DESTINATION = "/notes";

function request() {
  return new Request(REQUEST_URL);
}

function expectRedirect(response: Response, path: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`http://localhost:3000${path}`);
}

describe("GET /set-password/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    } as never);

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "oauth.user@example.com",
        },
      },
      error: null,
    });

    isAuthSessionMissingErrorMock.mockReturnValue(false);
    readSetPasswordIntentMock.mockResolvedValue("signed-set-intent");
    verifySetPasswordIntentMock.mockReturnValue({
      purpose: "signup-set-password",
      userId: USER_ID,
      issuedAt: 1,
      expiresAt: 2,
      redirectPath: SIGNED_DESTINATION,
    });
    validateRedirectPathMock.mockReturnValue(SIGNED_DESTINATION);
    getHasPasswordLoginMock.mockResolvedValue(true);
    clearSetPasswordIntentMock.mockResolvedValue(undefined);
  });

  it("진입 시 actual completion path로 requested 로그를 기록한다", async () => {
    await GET(request());

    expect(logRequestedMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_REQUESTED,
      {
        path: SET_PASSWORD_COMPLETE_PATH,
        method: "GET",
        provider: "password",
      },
    );
  });

  it("valid Intent + Password Login true이면 clear 후 signed destination으로 303 redirect한다", async () => {
    const response = await GET(request());

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledWith({
      token: "signed-set-intent",
      expectedUserId: USER_ID,
    });
    expect(validateRedirectPathMock).toHaveBeenCalledWith(SIGNED_DESTINATION);
    expect(getHasPasswordLoginMock).toHaveBeenCalledWith(USER_ID);
    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expectRedirect(response, SIGNED_DESTINATION);
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.objectContaining({
        path: SET_PASSWORD_COMPLETE_PATH,
        method: "GET",
        status: 303,
        result: "success",
      }),
    );
  });

  it("completion은 signed 원본이 아니라 redirect validator의 정규화 반환값을 사용한다", async () => {
    verifySetPasswordIntentMock.mockReturnValue({
      purpose: "signup-set-password",
      userId: USER_ID,
      issuedAt: 1,
      expiresAt: 2,
      redirectPath: "/login",
    });
    validateRedirectPathMock.mockReturnValue(ROUTES.MYPAGE);

    const response = await GET(request());

    expect(validateRedirectPathMock).toHaveBeenCalledWith("/login");
    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expectRedirect(response, ROUTES.MYPAGE);
    expect(response.headers.get("location")).not.toBe(
      "http://localhost:3000/login",
    );
  });

  it("session-missing error + user null은 rejected 후 fixed cleanup으로 보낸다", async () => {
    const sessionMissingError = new Error("Auth session missing");
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: sessionMissingError,
    });
    isAuthSessionMissingErrorMock.mockImplementation(
      (error) => error === sessionMissingError,
    );

    const response = await GET(request());

    expectRedirect(response, SET_PASSWORD_INTENT_CLEANUP_PATH);
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED,
      expect.objectContaining({
        path: SET_PASSWORD_COMPLETE_PATH,
        status: 303,
        result: "rejected",
        reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
      }),
    );
    expect(logAuthErrorMock).not.toHaveBeenCalled();
  });

  it("non-session Auth error + user null은 failed로 전파하고 cleanup으로 낮추지 않는다", async () => {
    const authError = new Error("auth service unavailable");
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: authError,
    });
    isAuthSessionMissingErrorMock.mockReturnValue(false);

    await expect(GET(request())).rejects.toBe(authError);

    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        path: SET_PASSWORD_COMPLETE_PATH,
        status: 500,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(logAuthEventMock).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED,
      expect.anything(),
    );
  });

  it("error null + user null은 rejected 후 fixed cleanup으로 보낸다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(request());

    expectRedirect(response, SET_PASSWORD_INTENT_CLEANUP_PATH);
    expect(readSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
      }),
    );
    expect(logAuthErrorMock).not.toHaveBeenCalled();
  });

  it("error null + user 있음은 정상 Intent lifecycle을 진행한다", async () => {
    const response = await GET(request());

    expect(readSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(verifySetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(getHasPasswordLoginMock).toHaveBeenCalledTimes(1);
    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expectRedirect(response, SIGNED_DESTINATION);
  });

  it("Intent가 missing이면 destination을 사용하지 않고 fixed cleanup으로 보낸다", async () => {
    readSetPasswordIntentMock.mockResolvedValue(null);

    const response = await GET(request());

    expectRedirect(response, SET_PASSWORD_INTENT_CLEANUP_PATH);
    expect(verifySetPasswordIntentMock).not.toHaveBeenCalled();
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("Intent verifier가 null이면 destination을 사용하지 않고 fixed cleanup으로 보낸다", async () => {
    verifySetPasswordIntentMock.mockReturnValue(null);

    const response = await GET(request());

    expectRedirect(response, SET_PASSWORD_INTENT_CLEANUP_PATH);
    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("verifier configuration error는 failed로 전파하고 silent cleanup하지 않는다", async () => {
    const verifyError = new Error("signing secret unavailable");
    verifySetPasswordIntentMock.mockImplementation(() => {
      throw verifyError;
    });

    await expect(GET(request())).rejects.toBe(verifyError);

    expect(validateRedirectPathMock).not.toHaveBeenCalled();
    expect(getHasPasswordLoginMock).not.toHaveBeenCalled();
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
  });

  it("Password Login false이면 Intent를 유지하고 signed destination 없이 set-password로 복귀한다", async () => {
    getHasPasswordLoginMock.mockResolvedValue(false);

    const response = await GET(request());

    expectRedirect(response, ROUTES.SET_PASSWORD);
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED,
      expect.objectContaining({
        path: SET_PASSWORD_COMPLETE_PATH,
        result: "rejected",
        reasonCode: AUTH_LOG_REASONS.SET_PASSWORD_INCOMPLETE,
      }),
    );
    expect(logAuthEventMock).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.anything(),
    );
  });

  it("Password Login postcondition 조회 실패는 failed로 전파한다", async () => {
    const lookupError = new Error("password lookup failed");
    getHasPasswordLoginMock.mockRejectedValue(lookupError);

    await expect(GET(request())).rejects.toBe(lookupError);

    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
  });

  it("Intent clear 실패 시 completed/destination redirect 없이 failed로 전파한다", async () => {
    const clearError = new Error("intent clear failed");
    clearSetPasswordIntentMock.mockRejectedValue(clearError);

    await expect(GET(request())).rejects.toBe(clearError);

    expect(logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED,
      expect.objectContaining({
        path: SET_PASSWORD_COMPLETE_PATH,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PASSWORD_INTENT_CLEANUP_FAILED,
      }),
    );
    expect(logAuthEventMock).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED,
      expect.anything(),
    );
  });
});
