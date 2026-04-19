import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
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

import { POST } from "../route";

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

vi.mock("@/features/auth/email/issueAuthEmailLinkAndSend", () => ({
  issueAuthEmailLinkAndSend: vi.fn(),
}));

vi.mock("@/features/auth/email/sendAuthEmail", () => ({
  sendAuthEmail: vi.fn(),
}));

vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const mockCreateUser = vi.fn(async () => ({ error: null }));
const mockGenerateLink = vi.fn(async () => ({
  data: { properties: { hashed_token: "hashed-token" } },
  error: null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        generateLink: mockGenerateLink,
      },
    },
  })),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password1!",
      nickname: "user",
      agreements: { termsOfService: true, privacyPolicy: true },
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

describe("signup 라우트 인증 로깅", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: true });
    vi.mocked(checkRequestEligibility).mockReturnValue({ allowed: true });
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "user@example.com",
      password: "Password1!",
      nickname: "user",
      agreements: { termsOfService: true, privacyPolicy: true },
    });
    vi.mocked(getUserByEmail).mockResolvedValue({
      email: "user@example.com",
      email_confirmed_at: null,
    });
    vi.mocked(issueAuthEmailLinkAndSend).mockResolvedValue(undefined);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
    mockCreateUser.mockResolvedValue({ error: null });
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-token" } },
      error: null,
    });
  });

  it("입력 검증 실패면 AUTH_INVALID_INPUT이 기록되고 최종 이벤트는 정확히 1개다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "invalid-email",
      password: "Password1!",
      nickname: "user",
      agreements: { termsOfService: true, privacyPolicy: true },
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

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_INVALID_INPUT);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
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
        AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
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

  it("성공이면 AUTH_SIGNUP_COMPLETED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_SIGNUP_COMPLETED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      ]),
    );
  });

  it("createUser 실패면 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR가 기록된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({
      error: new Error("create user failed"),
    } as never);

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(vi.mocked(logAuthEvent)).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
      expect.any(Object),
    );
  });

  it("generateLink 실패면 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR가 기록된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: new Error("generate link failed"),
    } as never);

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(vi.mocked(logAuthEvent)).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
      expect.any(Object),
    );
  });

  it("tokenHash가 없으면 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR가 기록된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: null,
    } as never);

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
  });

  it("sendAuthEmail 실패면 AUTH_SIGNUP_FAILED와 INTERNAL_ERROR가 기록된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    vi.mocked(sendAuthEmail).mockRejectedValueOnce(new Error("smtp failure"));

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(vi.mocked(logAuthEvent)).not.toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
      expect.any(Object),
    );
  });

  it("예외면 AUTH_SIGNUP_FAILED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValue(
      new Error("unexpected"),
    );

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_SIGNUP_FAILED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_SIGNUP_COMPLETED,
        AUTH_EVENTS.AUTH_SIGNUP_FAILED,
      ]),
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
      password: "Password1!",
      nickname: "user",
      agreements: { termsOfService: true, privacyPolicy: true },
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
