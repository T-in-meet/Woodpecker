import { beforeEach, describe, expect, it } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";

import {
  makeFormData,
  mockSession,
  mockUpdateUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

const TERMINAL_EVENTS = new Set<string>([
  AUTH_EVENTS.AUTH_RESET_PASSWORD_COMPLETED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_REJECTED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_FAILED,
  AUTH_EVENTS.AUTH_RESET_PASSWORD_INVALID_INPUT,
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

  it("TC18: validation 실패 시 INVALID_INPUT 기록", async () => {
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

  it("TC19: session/cookie 없음이면 REJECTED 기록", async () => {
    mockSession(null);
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

  it("TC20: updateUser error면 FAILED 기록", async () => {
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

  it("TC21: updateUser throw면 FAILED 기록", async () => {
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

  it("TC22: 성공 시 COMPLETED 기록", async () => {
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

  it("TC23: 로그 payload에 password/confirmPassword를 남기지 않는다", async () => {
    await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );
    const payloads = [
      ...mocks.logRequested.mock.calls.map((c) => c[1]),
      ...mocks.logAuthEvent.mock.calls.map((c) => c[1]),
      ...mocks.logAuthError.mock.calls.map((c) => c[1]),
    ] as Array<Record<string, unknown>>;
    for (const payload of payloads) {
      expect(payload).not.toHaveProperty("password");
      expect(payload).not.toHaveProperty("confirmPassword");
    }
  });

  it("same_password error 발생 시 SAME_PASSWORD reasonCode로 실패 로그를 기록한다", async () => {
    const mocks = setupActionTest();

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
});
