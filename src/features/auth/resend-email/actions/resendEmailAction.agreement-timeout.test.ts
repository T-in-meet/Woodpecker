import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { applyMinimumActionDelay } from "@/features/auth/lib/applyMinimumActionDelay";
import { logAuthError } from "@/features/auth/lib/authLogger";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { otpIssueRateLimit } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { signupResendRequestRateLimit } from "@/features/auth/lib/rate-limit/signupResendRequestRateLimit";
import { getTrustedAuthServerActionClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { OTP_AGREEMENT_TIMEOUT_ERROR_NAME } from "@/features/auth/test-utils/otpAgreementTimeoutTestContract";

import { resendEmailAction } from "./resendEmailAction";
import { INITIAL_RESEND_EMAIL_ACTION_STATE } from "./resendEmailActionState";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
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

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmailWithResult: vi.fn(),
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(),
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: {
    precheckIpIssue: vi.fn(),
    tryStartIssue: vi.fn(),
    recordSuccessfulIssue: vi.fn(),
    releaseIssue: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/signupResendRequestRateLimit", () => ({
  signupResendRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp: vi.fn(),
}));

vi.mock("@/features/auth/lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
  GetUserByEmailError: class GetUserByEmailError extends Error {},
}));

vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

const OTP_ISSUE_CLIENT = { kind: "otp-issue-client" } as never;

function createFormData(): FormData {
  const formData = new FormData();
  formData.set("email", "user@example.com");
  formData.set("purpose", "signup");
  return formData;
}

async function waitForTransportStart(
  transportFetch: ReturnType<typeof vi.fn>,
): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (transportFetch.mock.calls.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("agreement persistence transport did not start");
}

describe("Signup Resend agreement persistence bounded-settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    vi.mocked(getTrustedAuthServerActionClientIp).mockResolvedValue({
      available: true,
      ip: "203.0.113.10",
    });
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });
    vi.mocked(otpIssueRateLimit.precheckIpIssue).mockReturnValue({
      allowed: true,
    });
    vi.mocked(signupResendRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });
    vi.mocked(otpIssueRateLimit.tryStartIssue).mockReturnValue({
      allowed: true,
    });
    vi.mocked(createOtpIssueClient).mockReturnValue(OTP_ISSUE_CLIENT);
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "unverified-user-id",
      email: "user@example.com",
      email_confirmed_at: null,
      auth_providers: ["email"],
    } as never);
    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("pending agreement transport에 10초 own timeout을 적용하고 timeout 후 success-like redirect + release한다", async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);

    let rejectPendingTransport: ((reason?: unknown) => void) | undefined;
    let observedSignal: AbortSignal | undefined;

    const transportFetch = vi.fn(
      (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) =>
        new Promise<Response>((_resolve, reject) => {
          rejectPendingTransport = reject;
          observedSignal =
            init?.signal ??
            (input instanceof Request ? input.signal : undefined) ??
            undefined;

          const rejectAbort = () =>
            reject(
              observedSignal?.reason ??
                new DOMException("Aborted", "AbortError"),
            );

          if (observedSignal?.aborted) {
            rejectAbort();
            return;
          }

          observedSignal?.addEventListener("abort", rejectAbort, {
            once: true,
          });
        }),
    );

    vi.stubGlobal("fetch", transportFetch);

    let deliveryReached = false;
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementation(
      async (input) => {
        if (input.purpose !== "signup") {
          throw new Error("expected signup input");
        }

        if (input.signupMode !== "existing-user") {
          throw new Error("expected existing-user signup input");
        }

        await input.beforeDelivery?.();
        deliveryReached = true;

        return { ok: true };
      },
    );

    const actionPromise = resendEmailAction(
      null,
      INITIAL_RESEND_EMAIL_ACTION_STATE,
      createFormData(),
    );

    try {
      await waitForTransportStart(transportFetch);

      expect(timeoutSpy).toHaveBeenCalledWith(10_000);

      timeoutController.abort(
        new DOMException("agreement timeout", "TimeoutError"),
      );

      await expect(actionPromise).rejects.toThrow("NEXT_REDIRECT:");

      expect(observedSignal?.aborted).toBe(true);
      expect(deliveryReached).toBe(false);
      expect(otpIssueRateLimit.recordSuccessfulIssue).not.toHaveBeenCalled();
      expect(otpIssueRateLimit.releaseIssue).toHaveBeenCalledTimes(1);
      expect(otpIssueRateLimit.releaseIssue).toHaveBeenCalledWith({
        purpose: "signup",
        canonicalEmail: "user@example.com",
      });
      expect(redirect).toHaveBeenCalledTimes(1);
      expect(logAuthError).toHaveBeenCalledWith(
        AUTH_EVENTS.AUTH_RESEND_EMAIL_FAILED,
        expect.objectContaining({
          reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
          errorName: OTP_AGREEMENT_TIMEOUT_ERROR_NAME,
        }),
      );
    } finally {
      rejectPendingTransport?.(new Error("test cleanup"));
      await actionPromise.catch(() => undefined);
    }
  });
});
