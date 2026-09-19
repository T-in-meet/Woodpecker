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
import {
  getUserByEmail,
  GetUserByEmailError,
} from "@/features/auth/lib/getUserByEmail";
import { createOtpIssueClient } from "@/features/auth/lib/issueOtp";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";

import { POST } from "../route";

const recordCurrentLegalAcceptancesMock = vi.hoisted(() => vi.fn());
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(() => ({ allowed: true })),
  },
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  recordCurrentLegalAcceptances: recordCurrentLegalAcceptancesMock,
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

vi.mock("@/features/auth/lib/getUserByEmail", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/getUserByEmail")
  >("@/features/auth/lib/getUserByEmail");

  return {
    ...actual,
    getUserByEmail: vi.fn(),
  };
});

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
    recordCurrentLegalAcceptancesMock.mockResolvedValue(undefined);
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
      }),
    );
    const [, failContext] = vi.mocked(logAuthError).mock.calls[0]!;
    expect(failContext).not.toHaveProperty("maskedEmail");
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createOtpIssueClient).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
  });

  it("Local IP short 차단은 AUTH_RATE_LIMIT_BLOCKED와 기존 IP short reason을 기록한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
        maskedIp: "127.0.*.*",
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED]);
  });

  it("final Email attempt 차단은 전용 Provider-start attempt reason으로 기록한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_attempt",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
      }),
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
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

  it("Auth Admin lookup failure는 success-like 응답과 INTERNAL_ERROR 진단 로그를 남긴다", async () => {
    vi.mocked(getUserByEmail).mockRejectedValueOnce(
      new GetUserByEmailError(
        "auth_user_lookup",
        new Error("auth user lookup failed"),
      ),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "auth user lookup failed",
        errorName: "Error",
      }),
    );
    expect(createOtpIssueClient).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.precheckIssue).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
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

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
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
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED]);
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

      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
        expect.objectContaining({
          reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
          errorMessage: `${kind} message`,
          errorName: "ProviderError",
          errorCode: "provider_error_code",
        }),
      );
      expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
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

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.EMAIL_DELIVERY_ERROR,
        errorMessage: "smtp failed",
        errorName: "Error",
        errorCode: "smtp_failed",
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
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
    recordCurrentLegalAcceptancesMock.mockRejectedValueOnce(
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

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "agreement failed",
        errorName: "Error",
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
  });

  it("기존 미인증 agreement 복구 실패도 success-like 응답과 INTERNAL_ERROR failure 로그를 유지한다", async () => {
    recordCurrentLegalAcceptancesMock.mockRejectedValueOnce(
      new Error("agreement recovery failed"),
    );
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (
          input.purpose === "signup" &&
          input.signupMode === "existing-user"
        ) {
          await input.beforeDelivery?.();
        }

        return { ok: true };
      },
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
        errorMessage: "agreement recovery failed",
        errorName: "Error",
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_SIGNUP_FAILED]);
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
