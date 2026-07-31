import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { IP_SHORT_LIMIT } from "@/features/auth/lib/checkRequestEligibility";
import {
  emailStore,
  ipStore,
} from "@/features/auth/lib/requestEligibilityStore";

import {
  buildVerifyOtpUrl,
  expectExactlyOneTerminalEvent,
  expectNoLegacyActionFields,
  expectRequestedBeforeTerminalEvent,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: vi.fn(),
}));

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

describe("forgotPasswordAction", () => {
  beforeEach(() => {
    setupActionTest();
  });

  it("TC1: 유효한 email이면 OTP 발급 후 verify-otp로 이동한다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");
    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
    );

    expectRequestedBeforeTerminalEvent(mocks);

    expect(mocks.issueOtpAndSendEmailMock).toHaveBeenCalledTimes(1);
    expect(mocks.issueOtpAndSendEmailMock).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "reset-password",
    });

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      buildVerifyOtpUrl({
        email: "user@example.com",
      }),
    );
  });

  it("TC2: email은 validation 전에 trim 처리된다", async () => {
    const mocks = setupActionTest({ email: "  user@example.com  " });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.issueOtpAndSendEmailMock).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "reset-password",
    });
  });

  it("TC3/TC4/TC5: invalid 입력이면 field_error를 반환한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });
    const state = await mocks.callAction();

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
    );

    expectRequestedBeforeTerminalEvent(mocks);

    expect(state).toMatchObject({
      status: "invalid_input",
      fieldErrors: { email: expect.any(Array) },
    });

    expectNoLegacyActionFields(state);

    expect(mocks.issueOtpAndSendEmailMock).not.toHaveBeenCalled();
    expect(mocks.redirectMock).not.toHaveBeenCalled();

    // checkRequestEligibilityMock 제거됨.
    // 대신 rate limit store가 변경되지 않았는지 검증.
    expect(ipStore.size).toBe(0);
    expect(emailStore.size).toBe(0);
  });

  it("TC14/TC15/TC16/TC37: redirect query를 verify-otp URL에 보존 전달한다", async () => {
    const mocks = setupActionTest({ redirect: "/notes?tab=1" });
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("redirect=%2Fnotes%3Ftab%3D1"),
    );
  });

  it("TC17: forgot-password action에서는 validateRedirectPath를 호출하지 않고 redirect를 verify-otp URL에 보존만 한다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes?tab=1",
    });

    const mod = await import("@/features/auth/lib/validateRedirectPath");

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mod.validateRedirectPath).not.toHaveBeenCalled();
    expect(mocks.redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("redirect=%2Fnotes%3Ftab%3D1"),
    );
  });

  it("TC18: verify-otp 이동 시 purpose=reset-password query를 포함한다", async () => {
    const mocks = setupActionTest({ issueOtpAndSendEmail: "success" });
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("purpose=reset-password"),
    );
  });

  it("TC21: OTP 발급/이메일 발송 실패 시에도 verify-otp로 이동해 계정 탐지를 방어한다", async () => {
    const mocks = setupActionTest({ issueOtpAndSendEmail: "throw" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.logAuthErrorMock).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
      expect.any(Object),
    );

    expectRequestedBeforeTerminalEvent(mocks);

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      buildVerifyOtpUrl({
        email: "user@example.com",
      }),
    );
  });

  it("TC21-1: rate limit이면 blocked 상태를 반환한다", async () => {
    const mocks = setupActionTest();
    blockIpShort();
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "blocked",
      fieldErrors: null,
    });

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
    );

    expectRequestedBeforeTerminalEvent(mocks);

    expectNoLegacyActionFields(state);
  });

  it("TC21-2: 예상하지 못한 시스템 예외가 발생하면 internal_error 상태를 반환한다", async () => {
    const mocks = setupActionTest();

    mocks.getServerActionClientIp.mockRejectedValueOnce(
      new Error("ip lookup failed"),
    );

    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "internal_error",
      reasonCode: "INTERNAL_ERROR",
      fieldErrors: null,
    });

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
    );

    expectRequestedBeforeTerminalEvent(mocks);
    expect(mocks.redirectMock).not.toHaveBeenCalled();
  });

  it("TC32: invalid_input 응답 state에는 redirect 관련 필드가 포함되지 않는다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes",
      email: "invalid-email",
    });

    const state = await mocks.callAction();

    expect(state.status).toBe("invalid_input");
    expect(state).not.toHaveProperty("redirect");
    expect(state).not.toHaveProperty("redirectTo");
  });

  it("TC32-1: OTP 발송 실패 시에도 state를 반환하지 않고 redirect로 종료한다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes",
      issueOtpAndSendEmail: "throw",
    });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      buildVerifyOtpUrl({
        email: "user@example.com",
        redirect: "/notes",
      }),
    );
  });

  it("TC33: 별도 API route 의존 없이 Server Action을 직접 호출한다", async () => {
    const mocks = setupActionTest();
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("TC34: validation/rate-limit 실패 시 OTP 발급/이메일 발송 호출 없이 종료한다", async () => {
    const invalid = setupActionTest({ email: "invalid-email" });

    await invalid.callAction();

    const blocked = setupActionTest();
    blockIpShort();

    await blocked.callAction();

    expect(invalid.issueOtpAndSendEmailMock).not.toHaveBeenCalled();
    expect(blocked.issueOtpAndSendEmailMock).not.toHaveBeenCalled();
  });

  it("TC35/TC36: 이메일 발송은 issueOtpAndSendEmail 호출로 위임한다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.issueOtpAndSendEmailMock).toHaveBeenCalledTimes(1);
  });
});
