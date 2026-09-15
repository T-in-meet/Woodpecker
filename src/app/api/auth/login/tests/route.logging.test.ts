/**
 * 로그인 API structured logging 전용 테스트.
 *
 * REQUESTED 이후 terminal event는 정확히 하나이며,
 * Local Rate Limit / Provider Rate Limit / Provider Error / IP_UNAVAILABLE을
 * 내부 reason으로 구분한다.
 */

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
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import {
  mockLoginSuccess,
  mockParsedLoginBody,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
  setupLoginSecurityMocks,
} from "./utils/loginTestHelper";

const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());

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
vi.mock("@/features/auth/lib/parseAuthJsonRequestBody", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/parseAuthJsonRequestBody")
  >("@/features/auth/lib/parseAuthJsonRequestBody");

  return {
    ...actual,
    parseAuthJsonRequestBody: vi.fn(),
  };
});
vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthClientIp: vi.fn(),
}));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
}));
vi.mock("@/features/auth/login/lib/loginRateLimit", () => ({
  loginRateLimit: {
    tryStartAttempt: vi.fn(),
    recordResult: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server");

/**
 * 기록된 terminal event 이름 목록을 반환한다.
 *
 * @returns terminal event 이름 목록
 */
function terminalEvents(): string[] {
  return [
    ...vi.mocked(logAuthEvent).mock.calls.map((call) => call[0]),
    ...vi.mocked(logAuthError).mock.calls.map((call) => call[0]),
  ];
}

/**
 * REQUESTED가 terminal event보다 먼저 정확히 한 번 기록됐는지 확인한다.
 */
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

/**
 * 로그에 포함되면 안 되는 민감 필드 목록.
 */
const FORBIDDEN_LOG_FIELDS = [
  "password",
  "raw_email",
  "raw_ip",
  "token",
  "provider_full_response",
] as const;

/**
 * 구조화 로그 payload에 금지 필드가 없는지 확인한다.
 *
 * @param payload 로그 payload
 */
function expectNoForbiddenFields(payload: unknown): void {
  const entry = payload as Record<string, unknown>;

  for (const field of FORBIDDEN_LOG_FIELDS) {
    expect(entry).not.toHaveProperty(field);
  }
}

/**
 * logging 테스트용 Login 요청을 생성한다.
 *
 * @param overrides 기본 credentials override
 * @returns 테스트 NextRequest
 */
function makeRequest(
  overrides?: Partial<{ email: string; password: string }>,
): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password1!",
      ...overrides,
    }),
  });
}

/**
 * logging 관련 mock 호출 기록을 초기화한다.
 */
function clearLoggingMocks(): void {
  vi.mocked(logRequested).mockClear();
  vi.mocked(logAuthEvent).mockClear();
  vi.mocked(logAuthError).mockClear();
  vi.mocked(parseAuthJsonRequestBody).mockClear();
}

describe("로그인 API 로깅 검증", () => {
  beforeEach(() => {
    resetLoginApiMocks();
    setupLoginApiMocks();
    setupLoginSecurityMocks();
    mockLoginSuccess();
    clearLoggingMocks();

    mockParsedLoginBody();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
  });

  it("AUTH_LOGIN_REQUESTED를 1회 기록한다", async () => {
    await POST(makeRequest());

    expect(logRequested).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_REQUESTED,
      expect.any(Object),
    );
    expect(logRequested).toHaveBeenCalledTimes(1);
  });

  it("성공 시 AUTH_LOGIN_COMPLETED를 terminal event로 기록한다", async () => {
    await POST(makeRequest());

    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_COMPLETED,
      expect.any(Object),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_LOGIN_COMPLETED]);
  });

  it("invalid_credentials는 AUTH_LOGIN_FAILED + INVALID_CREDENTIALS로 기록한다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "Invalid login credentials",
        status: 400,
        code: "invalid_credentials",
      },
    });

    await POST(makeRequest());

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("validation 실패는 AUTH_INVALID_INPUT으로 기록한다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "not-valid",
      password: "pass",
    });

    await POST(makeRequest());

    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("JSON 파싱 실패는 INVALID_JSON으로 기록한다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockRejectedValue(
      new AuthJsonParseError("잘못된 JSON"),
    );

    await POST(makeRequest());

    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INVALID_JSON,
      }),
    );
    expect(terminalEvents()).toEqual([AUTH_EVENTS.AUTH_INVALID_INPUT]);
  });

  it("Local Login IP 제한은 LOGIN_IP_LIMIT으로 기록한다", async () => {
    vi.mocked(loginRateLimit.tryStartAttempt).mockReturnValue({
      allowed: false,
      blockedBy: "ip_short",
    });

    await POST(makeRequest());

    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.LOGIN_IP_LIMIT,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("Provider 429는 PROVIDER_RATE_LIMIT으로 별도 기록한다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "rate limited",
        status: 429,
        code: "over_request_rate_limit",
      },
    });

    await POST(makeRequest());

    expect(logAuthEvent).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_RATE_LIMIT,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("unknown Provider error는 PROVIDER_ERROR로 기록한다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "provider failed",
        status: 503,
        code: "unexpected_failure",
      },
    });

    await POST(makeRequest());

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.PROVIDER_ERROR,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("trusted IP 확보 실패는 IP_UNAVAILABLE로 기록한다", async () => {
    vi.mocked(getTrustedAuthClientIp).mockReturnValue({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });

    await POST(makeRequest());

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("Provider client 준비 중 예외는 INTERNAL_ERROR로 기록한다", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("client init failed"));

    await POST(makeRequest());

    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("성공 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await POST(makeRequest());

    expectRequestedBeforeSingleTerminal();
  });

  it("Provider 실패 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "provider failed",
        status: 500,
        code: "unexpected_failure",
      },
    });

    await POST(makeRequest());

    expectRequestedBeforeSingleTerminal();
  });

  it("로그 payload에 금지 필드가 없다", async () => {
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
});
