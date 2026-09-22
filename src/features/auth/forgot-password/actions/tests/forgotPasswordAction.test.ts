import { describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";

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

describe("forgotPasswordAction", () => {
  it("TC1: 유효한 email이면 typed Recovery OTP Issue 후 verify-otp로 이동한다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(mocks.tryStartIssueMock).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(mocks.issueOtpAndSendEmailWithResultMock).toHaveBeenCalledWith(
      {
        email: "user@example.com",
        purpose: "reset-password",
      },
      mocks.otpIssueClient,
    );
    expect(mocks.recordSuccessfulIssueMock).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
    });
    expect(mocks.releaseIssueMock).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
    });

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
    );
    expectRequestedBeforeTerminalEvent(mocks);
    expect(mocks.redirectMock).toHaveBeenCalledWith(
      buildVerifyOtpUrl({ email: "user@example.com" }),
    );
  });

  it("TC2: email은 validation 전에 trim 처리되고 canonicalEmail을 Rate Limit identity로 사용한다", async () => {
    const mocks = setupActionTest({ email: "  User@Example.COM  " });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.tryStartIssueMock).toHaveBeenCalledWith({
      purpose: "reset-password",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(mocks.issueOtpAndSendEmailWithResultMock).toHaveBeenCalledWith(
      {
        email: "User@Example.COM",
        purpose: "reset-password",
      },
      mocks.otpIssueClient,
    );
  });

  it("TC3/TC4/TC5: 잘못된 email이면 외부 side effect 없이 안전한 field error를 반환한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "invalid_input",
      fieldErrors: {
        email: [VALIDATION_MESSAGES.emailInvalid],
      },
    });
    expectNoLegacyActionFields(state);
    expect(mocks.getTrustedAuthServerActionClientIpMock).not.toHaveBeenCalled();
    expect(mocks.createOtpIssueClientMock).not.toHaveBeenCalled();
    expect(mocks.tryStartIssueMock).not.toHaveBeenCalled();
    expect(mocks.issueOtpAndSendEmailWithResultMock).not.toHaveBeenCalled();
    expect(mocks.redirectMock).not.toHaveBeenCalled();

    expectExactlyOneTerminalEvent(
      mocks,
      AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
    );
  });

  it("TC3-1: 빈 email이면 필수 입력 field error를 반환한다", async () => {
    const mocks = setupActionTest({ email: "   " });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "invalid_input",
      fieldErrors: {
        email: [VALIDATION_MESSAGES.emailRequired],
      },
    });
    expect(mocks.tryStartIssueMock).not.toHaveBeenCalled();
    expect(mocks.issueOtpAndSendEmailWithResultMock).not.toHaveBeenCalled();
  });

  it("TC14/TC15/TC16/TC37: redirect query를 verify-otp URL에 보존 전달한다", async () => {
    const mocks = setupActionTest({ redirect: "/notes?tab=1" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("redirect=%2Fnotes%3Ftab%3D1"),
    );
  });

  it("TC17: forgot-password action에서는 validateRedirectPath를 호출하지 않고 redirect를 보존만 한다", async () => {
    const mocks = setupActionTest({ redirect: "/notes?tab=1" });
    const mod = await import("@/features/auth/lib/validateRedirectPath");

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mod.validateRedirectPath).not.toHaveBeenCalled();
  });

  it("Recovery OTP client 생성 실패는 Rate Limit lifecycle을 시작하지 않고 success-like redirect한다", async () => {
    const mocks = setupActionTest();
    mocks.createOtpIssueClientMock.mockImplementationOnce(() => {
      throw new Error("otp client creation failed");
    });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(mocks.tryStartIssueMock).not.toHaveBeenCalled();
    expect(mocks.issueOtpAndSendEmailWithResultMock).not.toHaveBeenCalled();
    expect(mocks.recordSuccessfulIssueMock).not.toHaveBeenCalled();
    expect(mocks.releaseIssueMock).not.toHaveBeenCalled();
    expect(mocks.redirectMock).toHaveBeenCalledWith(
      buildVerifyOtpUrl({ email: "user@example.com" }),
    );
  });

  it.each([
    "provider_rate_limit",
    "provider_error",
    "invalid_provider_response",
    "delivery_error",
    "throw",
  ] as const)(
    "Recovery %s 실패는 successful quota 없이 release하고 success-like redirect한다",
    async (issueResult) => {
      const mocks = setupActionTest({ issueResult });

      await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

      expect(mocks.recordSuccessfulIssueMock).not.toHaveBeenCalled();
      expect(mocks.releaseIssueMock).toHaveBeenCalledTimes(1);
      expect(mocks.redirectMock).toHaveBeenCalledWith(
        buildVerifyOtpUrl({ email: "user@example.com" }),
      );
    },
  );

  it("trusted IP를 확보하지 못하면 fail-closed하고 OTP Issue를 시작하지 않는다", async () => {
    const mocks = setupActionTest({ trustedIpAvailable: false });

    const state = await mocks.callAction();

    expect(state).toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });
    expect(mocks.createOtpIssueClientMock).not.toHaveBeenCalled();
    expect(mocks.tryStartIssueMock).not.toHaveBeenCalled();
    expect(mocks.issueOtpAndSendEmailWithResultMock).not.toHaveBeenCalled();
    expect(mocks.redirectMock).not.toHaveBeenCalled();
  });

  it("별도 API route 의존 없이 Server Action을 직접 호출한다", async () => {
    const mocks = setupActionTest();
    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");
  });
});
