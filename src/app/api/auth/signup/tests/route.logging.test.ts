import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
} from "@/features/auth/lib/authLogger";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";

import { POST } from "../route";

const ensureUserAgreementMock = vi.hoisted(() => vi.fn());
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: ensureUserAgreementMock,
}));

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  logCallback: vi.fn(),
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

vi.mock("@/features/auth/lib/parseAuthJsonRequestBody", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/parseAuthJsonRequestBody")
  >("@/features/auth/lib/parseAuthJsonRequestBody");

  return {
    ...actual,
    parseAuthJsonRequestBody: vi.fn(),
  };
});

vi.mock("@/features/auth/lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmailWithResult: vi.fn(),
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: vi.fn(() => otpIssueClient),
}));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password1!",
      nickname: "user",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    }),
  });
}

function terminalEvents(): string[] {
  const eventsFromAuthEvent = vi
    .mocked(logAuthEvent)
    .mock.calls.map((call) => call[0]);
  const eventsFromAuthError = vi
    .mocked(logAuthError)
    .mock.calls.map((call) => call[0]);

  return [...eventsFromAuthEvent, ...eventsFromAuthError];
}

function expectRequestedBeforeSingleTerminal(): void {
  const requestedOrders = vi.mocked(logRequested).mock.invocationCallOrder;
  const terminalOrders = [
    ...vi.mocked(logAuthEvent).mock.invocationCallOrder,
    ...vi.mocked(logAuthError).mock.invocationCallOrder,
  ];

  expect(requestedOrders).toHaveLength(1);
  expect(terminalOrders).toHaveLength(1);
  expect(requestedOrders[0]!).toBeLessThan(terminalOrders[0]!);
}

const FORBIDDEN_FIELDS = [
  "password",
  "token",
  "token_hash",
  "ticket",
  "code",
  "accessToken",
  "refreshToken",
  "cookie",
  "authorization",
  "raw_email",
  "raw_ip",
  "raw_body",
  "provider_full_response",
  "account_state_fields",
] as const;

function expectNoForbiddenFields(payload: unknown): void {
  expect(payload).toBeTypeOf("object");
  const entry = payload as Record<string, unknown>;

  for (const field of FORBIDDEN_FIELDS) {
    expect(entry).not.toHaveProperty(field);
  }
}

describe("signup 라우트 인증 로깅", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "user@example.com",
      password: "Password1!",
      nickname: "user",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    });
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "user@example.com",
      email_confirmed_at: null,
      auth_providers: ["email"],
    });
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });
    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    ensureUserAgreementMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("입력 검증 실패면 AUTH_INVALID_INPUT과 SCHEMA_VALIDATION_FAILED를 기록한다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "invalid-email",
      password: "Password1!",
      nickname: "user",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    });

    await POST(makeRequest());

    expect(vi.mocked(logRequested)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_REQUESTED,
      expect.any(Object),
    );
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_INVALID_INPUT]);
  });

  it("잘못된 JSON이면 AUTH_INVALID_INPUT과 INVALID_JSON을 기록한다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValue(
      new AuthJsonParseError("잘못된 JSON"),
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INVALID_JSON,
      }),
    );
    expect(vi.mocked(logAuthError)).not.toHaveBeenCalled();
  });

  it("Production에서 trusted IP를 확보하지 못하면 IP_UNAVAILABLE로 fail-closed한다", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
        maskedEmail: expect.any(String),
      }),
    );
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createOtpIssueClient).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
  });

  it("Local IP short 차단은 AUTH_RATE_LIMIT_BLOCKED와 기존 IP short reason을 기록한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
        maskedIp: "127.0.*.*",
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED]);
  });

  it("successful Email quota 차단은 기존 Email long reason으로 기록한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_success",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
      }),
    );
  });

  it("Provider 429는 PROVIDER_RATE_LIMIT과 안전한 diagnostic을 blocked 로그에 남긴다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
      ok: false,
      kind: "provider_rate_limit",
      diagnostic: {
        errorMessage: "provider limited",
        errorName: "AuthApiError",
        errorCode: "over_request_rate_limit",
      },
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
        errorMessage: "provider limited",
        errorName: "AuthApiError",
        errorCode: "over_request_rate_limit",
      }),
    );
    expect(vi.mocked(logAuthError)).not.toHaveBeenCalled();
  });

  it.each(["provider_error", "invalid_provider_response"] as const)(
    "%s는 PROVIDER_ERROR와 diagnostic을 failure 로그에 남긴다",
    async (kind) => {
      vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
        ok: false,
        kind,
        diagnostic: {
          errorMessage: `${kind} message`,
          errorName: "ProviderError",
          errorCode: "provider_error_code",
        },
      });

      await POST(makeRequest());

      expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
        expect.objectContaining({
          reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
          errorMessage: `${kind} message`,
          errorName: "ProviderError",
          errorCode: "provider_error_code",
        }),
      );
    },
  );

  it("delivery_error는 EMAIL_DELIVERY_ERROR와 diagnostic을 failure 로그에 남긴다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
      ok: false,
      kind: "delivery_error",
      diagnostic: {
        errorMessage: "smtp failed",
        errorName: "Error",
        errorCode: "smtp_failed",
      },
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR,
        errorMessage: "smtp failed",
        errorName: "Error",
        errorCode: "smtp_failed",
      }),
    );
  });

  it("성공이면 AUTH_SIGNUP_COMPLETED가 기록되고 terminal event는 하나다", async () => {
    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
      expect.any(Object),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_COMPLETED]);
  });

  it("agreement hook 실패는 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR로 기록한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    ensureUserAgreementMock.mockRejectedValueOnce(
      new Error("agreement failed"),
    );
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (input.purpose === "signup" && input.signupMode === "new-user") {
          await input.beforeDelivery?.({ userId: "new-user-id" });
        }

        return { ok: true };
      },
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "agreement failed",
        errorName: "Error",
      }),
    );
  });

  it("예상하지 못한 예외는 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR로 기록한다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValue(
      new Error("unexpected"),
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
  });

  it("route에서 authLogger로 전달되는 payload에는 금지 필드가 없다", async () => {
    await POST(makeRequest());

    for (const [, payload] of vi.mocked(logRequested).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [, payload] of vi.mocked(logAuthEvent).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [, payload] of vi.mocked(logAuthError).mock.calls) {
      expectNoForbiddenFields(payload);
    }
  });

  it("시퀀스 검증: invalid_input 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "invalid-email",
      password: "Password1!",
      nickname: "user",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    });

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: rate_limit 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: completed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: failed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
      ok: false,
      kind: "delivery_error",
      diagnostic: {
        errorMessage: "smtp failed",
        errorName: "Error",
      },
    });

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });
});
