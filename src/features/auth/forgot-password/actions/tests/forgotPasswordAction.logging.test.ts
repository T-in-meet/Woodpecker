import { describe, expect, it } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { IP_SHORT_LIMIT } from "@/features/auth/lib/checkRequestEligibility";
import { ipStore } from "@/features/auth/lib/requestEligibilityStore";

import {
  buildVerifyOtpUrl,
  expectExactlyOneTerminalEvent,
  expectRequestedBeforeTerminalEvent,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

function allLogPayloads(mocks: ReturnType<typeof setupActionTest>) {
  return [
    ...mocks.logRequestedMock.mock.calls.map((c) => c[1]),
    ...mocks.logAuthEventMock.mock.calls.map((c) => c[1]),
    ...mocks.logAuthErrorMock.mock.calls.map((c) => c[1]),
  ] as Array<Record<string, unknown>>;
}

function blockIpShort(ip = "203.0.113.10") {
  ipStore.set(ip, {
    shortWindow: {
      timestamps: Array.from({ length: IP_SHORT_LIMIT }, () => Date.now()),
    },
    longWindow: {
      timestamps: [],
    },
  });
}

describe("forgotPasswordAction - logging & delay", () => {
  it("TC22: 성공 시 REQUESTED + COMPLETED를 기록한다", async () => {
    const mocks = setupActionTest();
    await expect(mocks.callAction()).rejects.toThrow(
      `NEXT_REDIRECT:${buildVerifyOtpUrl({
        email: "user@example.com",
      })}`,
    );

    expect(mocks.logRequestedMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_REQUESTED,
      expect.any(Object),
    );
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
      expect.any(Object),
    );

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
    );

    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("TC23: validation 실패 시 INVALID_INPUT을 기록한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });
    await mocks.callAction();

    expect(mocks.logRequestedMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
      expect.any(Object),
    );

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
    );

    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("TC24: rate limit 실패 시 RATE_LIMITED를 기록한다", async () => {
    const mocks = setupActionTest();
    blockIpShort();

    await mocks.callAction();

    expect(mocks.logRequestedMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
      expect.any(Object),
    );

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
    );

    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("TC25: 내부 예외 시 FAILED를 기록한다", async () => {
    const mocks = setupActionTest({ issueOtpAndSendEmail: "throw" });
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.logRequestedMock).toHaveBeenCalledTimes(1);

    expect(mocks.logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
      expect.any(Object),
    );

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
      expect.any(Object),
    );

    expectRequestedBeforeTerminalEvent(mocks);
  });

  it("TC26: 모든 요청에서 REQUESTED는 1회씩 기록된다", async () => {
    const success = setupActionTest();
    await expect(success.callAction()).rejects.toThrow(
      `NEXT_REDIRECT:${buildVerifyOtpUrl({
        email: "user@example.com",
      })}`,
    );
    expect(success.logRequestedMock).toHaveBeenCalledTimes(1);

    const invalid = setupActionTest({ email: "invalid-email" });
    await invalid.callAction();
    expect(invalid.logRequestedMock).toHaveBeenCalledTimes(1);

    const blocked = setupActionTest();
    blockIpShort();
    await blocked.callAction();
    expect(blocked.logRequestedMock).toHaveBeenCalledTimes(1);

    const failed = setupActionTest({ issueOtpAndSendEmail: "throw" });
    await expect(failed.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(failed.logRequestedMock).toHaveBeenCalledTimes(1);
  });

  it("TC27/TC28: 로그 payload에 raw email/raw IP를 남기지 않는다", async () => {
    const mocks = setupActionTest();
    await expect(mocks.callAction()).rejects.toThrow(
      `NEXT_REDIRECT:${buildVerifyOtpUrl({
        email: "user@example.com",
      })}`,
    );

    for (const payload of allLogPayloads(mocks)) {
      expect(payload).not.toHaveProperty("rawEmail");
      expect(payload).not.toHaveProperty("raw_email");
      expect(payload).not.toHaveProperty("email");
      expect(payload).not.toHaveProperty("rawIp");
      expect(payload).not.toHaveProperty("raw_ip");
      expect(payload).not.toHaveProperty("ip");
    }
  });

  it("TC29: Supabase error.message를 ActionState에 노출하지 않는다", async () => {
    const mocks = setupActionTest({ issueOtpAndSendEmail: "throw" });
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("TC30: 모든 분기에서 applyMinimumActionDelay를 호출한다", async () => {
    const success = setupActionTest();
    await expect(success.callAction()).rejects.toThrow(
      `NEXT_REDIRECT:${buildVerifyOtpUrl({
        email: "user@example.com",
      })}`,
    );
    expect(success.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const invalid = setupActionTest({ email: "invalid-email" });
    await invalid.callAction();
    expect(invalid.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const blocked = setupActionTest();
    blockIpShort();
    await blocked.callAction();
    expect(blocked.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);

    const failed = setupActionTest({ issueOtpAndSendEmail: "throw" });
    await expect(failed.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(failed.applyMinimumActionDelayMock).toHaveBeenCalledTimes(1);
  });
});
