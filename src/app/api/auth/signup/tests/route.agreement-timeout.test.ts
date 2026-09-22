import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { logAuthError } from "@/features/auth/lib/authLogger";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import { OTP_ISSUE_COOLDOWN_MS } from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { otpIssueRateLimit } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { OTP_AGREEMENT_TIMEOUT_ERROR_NAME } from "@/features/auth/test-utils/otpAgreementTimeoutTestContract";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
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

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(() => ({ allowed: true })),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthClientIp: vi.fn(),
}));

vi.mock("@/features/auth/lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
  GetUserByEmailError: class GetUserByEmailError extends Error {},
}));

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmailWithResult: vi.fn(),
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(),
}));

vi.mock(
  "@/features/auth/lib/rate-limit/otpIssueRateLimit",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/auth/lib/rate-limit/otpIssueRateLimit")
      >();
    const { createInMemoryAuthRateLimitStore } = await vi.importActual<
      typeof import("@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore")
    >("@/features/auth/lib/rate-limit/inMemoryAuthRateLimitStore");

    return {
      ...actual,
      otpIssueRateLimit: actual.createOtpIssueRateLimit(
        createInMemoryAuthRateLimitStore(),
      ),
    };
  },
);

const BASE_VALID_PAYLOAD = {
  email: "test@example.com",
  password: "Password123!",
  nickname: "테스터",
  agreements: {
    termsOfService: true,
    privacyPolicyAcknowledged: true,
    age14OrOlder: true,
  },
};

const OTP_ISSUE_CLIENT = { kind: "otp-issue-client" } as never;
const BASE_NOW = 1_000_000;

async function waitForTransportStart(
  transportFetch: ReturnType<typeof vi.fn>,
): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (transportFetch.mock.calls.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("agreement persistence transport did not start");
}

describe("Signup agreement persistence bounded-settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    vi.mocked(getTrustedAuthClientIp).mockReturnValue({
      available: true,
      ip: "203.0.113.10",
    });
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createOtpIssueClient).mockReturnValue(OTP_ISSUE_CLIENT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("agreement timeout 후 real store의 in-flight를 release하고 cooldown 이후 동일 요청을 다시 허용한다", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(BASE_NOW);
    const recordSuccessfulIssueSpy = vi.spyOn(
      otpIssueRateLimit,
      "recordSuccessfulIssue",
    );
    const releaseIssueSpy = vi.spyOn(otpIssueRateLimit, "releaseIssue");

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
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (input.purpose !== "signup" || input.signupMode !== "new-user") {
          throw new Error("expected new-user signup input");
        }

        await input.beforeDelivery?.({ userId: "new-user-id" });
        deliveryReached = true;
        return { ok: true };
      },
    );

    const requestPromise = POST(makeRequest(BASE_VALID_PAYLOAD));

    try {
      await waitForTransportStart(transportFetch);

      expect(timeoutSpy).toHaveBeenCalledWith(10_000);

      timeoutController.abort(
        new DOMException("agreement timeout", "TimeoutError"),
      );

      const response = await requestPromise;
      const body = await response.json();

      expect(observedSignal?.aborted).toBe(true);
      expect(response.status).toBe(200);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(deliveryReached).toBe(false);
      expect(recordSuccessfulIssueSpy).not.toHaveBeenCalled();
      expect(releaseIssueSpy).toHaveBeenCalledTimes(1);
      expect(releaseIssueSpy).toHaveBeenCalledWith({
        purpose: "signup",
        canonicalEmail: "test@example.com",
      });
      expect(logAuthError).toHaveBeenCalledWith(
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
        expect.objectContaining({
          reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
          errorName: OTP_AGREEMENT_TIMEOUT_ERROR_NAME,
        }),
      );

      nowSpy.mockReturnValue(BASE_NOW + OTP_ISSUE_COOLDOWN_MS);
      vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
        ok: true,
      });

      const retryResponse = await POST(makeRequest(BASE_VALID_PAYLOAD));
      const retryBody = await retryResponse.json();

      expect(retryResponse.status).toBe(200);
      expect(retryBody.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(issueOtpAndSendEmailWithResult).toHaveBeenCalledTimes(2);
      expect(recordSuccessfulIssueSpy).toHaveBeenCalledTimes(1);
      expect(releaseIssueSpy).toHaveBeenCalledTimes(2);
    } finally {
      rejectPendingTransport?.(new Error("test cleanup"));
      await requestPromise.catch(() => undefined);
    }
  });
});
