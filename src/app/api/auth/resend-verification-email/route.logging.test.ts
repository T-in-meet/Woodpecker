import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
} from "@/features/auth/lib/authLogger";
import {
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { resendVerificationEmail } from "@/features/auth/resend-verification-email/lib/resendVerificationEmail";

import { POST } from "./route";

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

vi.mock("@/features/auth/lib/checkRequestEligibility", () => ({
  checkIpRateLimitPrecheck: vi.fn(),
  checkRequestEligibility: vi.fn(),
  mapBlockedByToReason: vi.fn((blockedBy: "ip" | "emailShort" | "emailLong") =>
    blockedBy === "ip"
      ? "RATE_LIMIT_IP"
      : blockedBy === "emailShort"
        ? "RATE_LIMIT_EMAIL_SHORT"
        : "RATE_LIMIT_EMAIL_LONG",
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

vi.mock(
  "@/features/auth/resend-verification-email/lib/resendVerificationEmail",
  () => ({
    resendVerificationEmail: vi.fn(),
  }),
);

vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/auth/resend-verification-email",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    },
  );
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
  const requestedOrder = requestedOrders[0]!;
  const terminalOrder = terminalOrders[0]!;
  expect(requestedOrder).toBeLessThan(terminalOrder);
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

describe("resend 라우트 인증 로깅", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: true });
    vi.mocked(checkRequestEligibility).mockReturnValue({ allowed: true });
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "user@example.com",
    });
    vi.mocked(getUserByEmail).mockResolvedValue({
      email: "user@example.com",
      email_confirmed_at: null,
    });
    vi.mocked(resendVerificationEmail).mockResolvedValue(undefined);
  });

  it("입력 검증 실패면 AUTH_INVALID_INPUT이 기록되고 최종 이벤트는 정확히 1개다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "invalid-email",
    });

    await POST(makeRequest());

    expect(vi.mocked(logRequested)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_REQUESTED,
      expect.any(Object),
    );
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      }),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_INVALID_INPUT);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_RESEND_COMPLETED,
        AUTH_EVENTS.AUTH_RESEND_FAILED,
      ]),
    );
  });

  it("잘못된 JSON이면 AUTH_INVALID_INPUT과 INVALID_JSON 사유코드가 기록된다", async () => {
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
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledTimes(1);
  });

  it("요청 제한 차단이면 AUTH_RATE_LIMIT_BLOCKED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "ip",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP,
      }),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_RESEND_COMPLETED,
        AUTH_EVENTS.AUTH_RESEND_FAILED,
      ]),
    );
  });

  it("요청 제한 차단(emailShort)이면 RATE_LIMIT_EMAIL_SHORT 사유코드가 기록된다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "emailShort",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT,
      }),
    );
    expect(vi.mocked(logAuthError)).not.toHaveBeenCalled();
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledTimes(1);
  });

  it("요청 제한 차단(emailLong)이면 RATE_LIMIT_EMAIL_LONG 사유코드가 기록된다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "emailLong",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
      }),
    );
    expect(vi.mocked(logAuthError)).not.toHaveBeenCalled();
    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledTimes(1);
  });

  it("성공이면 AUTH_RESEND_COMPLETED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_COMPLETED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_RESEND_COMPLETED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_RESEND_COMPLETED,
        AUTH_EVENTS.AUTH_RESEND_FAILED,
      ]),
    );
  });

  it("예외면 AUTH_RESEND_FAILED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValue(
      new Error("unexpected"),
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_FAILED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_RESEND_FAILED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_RESEND_COMPLETED,
        AUTH_EVENTS.AUTH_RESEND_FAILED,
      ]),
    );
  });

  it("재전송 side-effect 실패면 AUTH_RESEND_FAILED와 INTERNAL_ERROR가 기록된다", async () => {
    vi.mocked(resendVerificationEmail).mockRejectedValueOnce(
      new Error("mailer down"),
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(vi.mocked(logAuthEvent)).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RESEND_COMPLETED,
      expect.any(Object),
    );
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
    });

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: rate_limit 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "ip",
    });

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: completed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: failed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValueOnce(
      new Error("unexpected"),
    );

    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });
});
