import { describe, expect, it } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";

import {
  buildVerifyOtpUrl,
  expectExactlyOneTerminalEvent,
  expectRequestedBeforeTerminalEvent,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

function allLogPayloads(mocks: ReturnType<typeof setupActionTest>) {
  return [
    ...mocks.logRequestedMock.mock.calls.map((call) => call[1]),
    ...mocks.logAuthEventMock.mock.calls.map((call) => call[1]),
    ...mocks.logAuthErrorMock.mock.calls.map((call) => call[1]),
  ] as Array<Record<string, unknown>>;
}

describe("forgotPasswordAction - logging & delay", () => {
  it("성공 시 REQUESTED + COMPLETED를 기록한다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow(
      `NEXT_REDIRECT:${buildVerifyOtpUrl({ email: "user@example.com" })}`,
    );

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
    );
    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("validation 실패 시 INVALID_INPUT을 기록한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });

    await mocks.callAction();

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
    );
    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("Local Rate Limit 차단은 RATE_LIMITED를 기록하고 success-like redirect한다", async () => {
    const mocks = setupActionTest({ blockedBy: "cooldown" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
    );
    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("Delivery 실패는 EMAIL_DELIVERY_ERROR로 기록하고 외부 redirect는 유지한다", async () => {
    const mocks = setupActionTest({ issueResult: "delivery_error" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR,
      }),
    );
  });

  it("Provider/System 실패는 PROVIDER_ERROR로 기록한다", async () => {
    const mocks = setupActionTest({ issueResult: "provider_error" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
  });

  it("로그 payload에 raw email/raw IP를 남기지 않는다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    for (const payload of allLogPayloads(mocks)) {
      expect(payload).not.toHaveProperty("rawEmail");
      expect(payload).not.toHaveProperty("raw_email");
      expect(payload).not.toHaveProperty("email");
      expect(payload).not.toHaveProperty("rawIp");
      expect(payload).not.toHaveProperty("raw_ip");
      expect(payload).not.toHaveProperty("ip");
    }
  });

  it("모든 종료 경로에서 applyMinimumActionDelay를 호출한다", async () => {
    const success = setupActionTest();
    await expect(success.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(success.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const invalid = setupActionTest({ email: "invalid-email" });
    await invalid.callAction();
    expect(invalid.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const blocked = setupActionTest({ blockedBy: "ip_short" });
    await expect(blocked.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(blocked.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const failed = setupActionTest({ issueResult: "provider_error" });
    await expect(failed.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(failed.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);
  });
});
