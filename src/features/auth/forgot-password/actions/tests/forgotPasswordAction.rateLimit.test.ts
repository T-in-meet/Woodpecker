import { describe, expect, it } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";

import { setupActionTest } from "./utils/forgot-password-action-test-utils";

describe("forgotPasswordAction - OTP Issue rate limit", () => {
  it.each([
    ["ip_short", AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT],
    ["ip_long", AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG],
    ["cooldown", AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT],
    ["in_flight", AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT],
    ["email_success", AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG],
  ] as const)(
    "%s Local Rate Limit 차단은 Provider를 시작하지 않고 Recovery success-like redirect한다",
    async (blockedBy, reasonCode) => {
      const mocks = setupActionTest({ blockedBy });

      await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

      expect(mocks.tryStartIssueMock).toHaveBeenCalledWith({
        purpose: "reset-password",
        canonicalEmail: "user@example.com",
        ip: "203.0.113.10",
      });
      expect(mocks.issueOtpAndSendEmailWithResultMock).not.toHaveBeenCalled();
      expect(mocks.recordSuccessfulIssueMock).not.toHaveBeenCalled();
      expect(mocks.releaseIssueMock).not.toHaveBeenCalled();
      expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 429,
          result: "blocked",
          reasonCode,
        }),
      );
    },
  );

  it("허용 시 성공한 Recovery Issue만 successful quota를 기록하고 release한다", async () => {
    const mocks = setupActionTest();

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.recordSuccessfulIssueMock).toHaveBeenCalledTimes(1);
    expect(mocks.releaseIssueMock).toHaveBeenCalledTimes(1);
    expect(
      mocks.issueOtpAndSendEmailWithResultMock.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.recordSuccessfulIssueMock.mock.invocationCallOrder[0]!,
    );
    expect(
      mocks.recordSuccessfulIssueMock.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.releaseIssueMock.mock.invocationCallOrder[0]!);
  });

  it("Provider 429는 Local Rate Limit과 별도 내부 reason으로 기록하지만 외부에는 success-like redirect한다", async () => {
    const mocks = setupActionTest({ issueResult: "provider_rate_limit" });

    await expect(mocks.callAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 429,
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(mocks.recordSuccessfulIssueMock).not.toHaveBeenCalled();
    expect(mocks.releaseIssueMock).toHaveBeenCalledTimes(1);
  });
});
