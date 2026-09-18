import { beforeEach, describe, expect, it } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";

import {
  makeFormData,
  mockUpdateUser,
  mockUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

const TERMINAL_EVENTS = new Set<string>([
  AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_INVALID_INPUT,
  AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
]);

function getTerminalEventCallCount(mocks: {
  logAuthEvent: { mock: { calls: unknown[][] } };
  logAuthError: { mock: { calls: unknown[][] } };
}) {
  const fromLogAuthEvent = mocks.logAuthEvent.mock.calls.filter((call) =>
    TERMINAL_EVENTS.has(String(call[0])),
  ).length;
  const fromLogAuthError = mocks.logAuthError.mock.calls.filter((call) =>
    TERMINAL_EVENTS.has(String(call[0])),
  ).length;

  return fromLogAuthEvent + fromLogAuthError;
}

describe("resetPasswordAction - logging", () => {
  let mocks: ReturnType<typeof setupActionTest>;

  beforeEach(() => {
    mocks = setupActionTest();
  });

  it("validation 실패 시 INVALID_INPUT 기록", async () => {
    await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );

    expect(mocks.logRequested).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_INVALID_INPUT,
      expect.any(Object),
    );
    expect(mocks.logAuthEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthError).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("authenticated user 없음이면 REJECTED 기록", async () => {
    mockUser(null);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.logRequested).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED,
      expect.any(Object),
    );
    expect(mocks.logAuthEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthError).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("updateUser error면 FAILED 기록", async () => {
    mockUpdateUser("error");

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.any(Object),
    );
    expect(mocks.logAuthError).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("updateUser throw면 FAILED 기록", async () => {
    mockUpdateUser("throw");

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.any(Object),
    );
    expect(mocks.logAuthError).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("성공 시 COMPLETED 기록", async () => {
    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED,
      expect.any(Object),
    );
    expect(mocks.logAuthEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthError).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("로그 payload에 password/confirmPassword를 남기지 않는다", async () => {
    await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );

    const payloads = [
      ...mocks.logRequested.mock.calls.map((call) => call[1]),
      ...mocks.logAuthEvent.mock.calls.map((call) => call[1]),
      ...mocks.logAuthError.mock.calls.map((call) => call[1]),
    ] as Array<Record<string, unknown>>;

    for (const payload of payloads) {
      expect(payload).not.toHaveProperty("password");
      expect(payload).not.toHaveProperty("confirmPassword");
    }
  });

  it("same_password error 발생 시 SAME_PASSWORD reasonCode로 실패 로그를 기록한다", async () => {
    mocks.updateUser.mockResolvedValueOnce({
      error: {
        status: 422,
        code: "same_password",
      },
    });

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 422,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SAME_PASSWORD,
      }),
    );
  });

  it("direct clear 실패는 cleanup failure 전용 reason + 303으로 기록하고 completed를 남기지 않는다", async () => {
    mocks.clearSignedResetPasswordIntent.mockRejectedValue(
      new Error("reset intent clear failed"),
    );

    await expect(
      runResetPasswordAction(
        "/notes",
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 303,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PASSWORD_INTENT_CLEANUP_FAILED,
      }),
    );
    expect(mocks.logAuthError).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED,
      expect.anything(),
    );
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });

  it("Provider 429는 PROVIDER_RATE_LIMIT + 429 blocked terminal event를 기록한다", async () => {
    mocks.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 429, code: undefined },
    });

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        status: 429,
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthError).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("throw된 Auth 429도 PROVIDER_RATE_LIMIT + 429 blocked terminal event로 수렴한다", async () => {
    const authRateLimitError = {
      status: 429,
      code: "unexpected_rate_limit_code",
      message: "rate limited",
    };

    mocks.isAuthError.mockImplementation(
      (error) => error === authRateLimitError,
    );
    mocks.updateUser.mockRejectedValueOnce(authRateLimitError);

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        status: 429,
        result: "blocked",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(mocks.logAuthError).not.toHaveBeenCalled();
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("일반 Provider error는 PROVIDER_ERROR + 500으로 기록한다", async () => {
    mockUpdateUser("error");

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 500,
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
    expect(getTerminalEventCallCount(mocks)).toBe(1);
  });

  it("non-Auth throw도 PROVIDER_ERROR + 500으로 기록한다", async () => {
    mockUpdateUser("throw");
    mocks.isAuthError.mockReturnValue(false);

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(mocks.logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
      expect.objectContaining({
        status: 500,
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
  });

  it("Provider error logging payload에 password/confirmPassword를 남기지 않는다", async () => {
    mockUpdateUser("error");

    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    const providerLogPayload = mocks.logAuthError.mock.calls.find(
      (call) => call[0] === AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
    )?.[1] as Record<string, unknown> | undefined;

    expect(providerLogPayload).toBeDefined();
    expect(providerLogPayload).not.toHaveProperty("password");
    expect(providerLogPayload).not.toHaveProperty("confirmPassword");
  });
});
