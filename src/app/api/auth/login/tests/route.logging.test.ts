/**
 * 로그인 API 로깅 전용 테스트
 *
 * 검증 범위:
 * - REQUESTED 이벤트가 1회 기록됨
 * - 각 결과(성공/인증실패/검증실패/rate limit/내부오류)에 대해 terminal event 1회만 기록
 * - REQUESTED 이후 terminal event 1개 규칙 (Single Resolution Rule)
 * - 로그 payload에 금지 필드가 없음 (password, raw_email 등)
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
  checkIpRateLimitPrecheck,
  checkRequestEligibility,
} from "@/features/auth/lib/checkRequestEligibility";
import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

// applyMinimumResponseTime을 우회하여 타이밍 영향 제거
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

vi.mock("@/features/auth/lib/checkRequestEligibility", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/checkRequestEligibility")
  >("@/features/auth/lib/checkRequestEligibility");
  return {
    ...actual,
    checkIpRateLimitPrecheck: vi.fn(),
    checkRequestEligibility: vi.fn(),
    mapBlockedByToReason: vi.fn((blockedBy: string) => {
      if (blockedBy === "ip") return "RATE_LIMIT_IP";
      if (blockedBy === "emailShort") return "RATE_LIMIT_EMAIL_SHORT";
      return "RATE_LIMIT_EMAIL_LONG";
    }),
  };
});

vi.mock("@/features/auth/lib/parseAuthJsonRequestBody", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/parseAuthJsonRequestBody")
  >("@/features/auth/lib/parseAuthJsonRequestBody");
  return { ...actual, parseAuthJsonRequestBody: vi.fn() };
});

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

/** 기록된 terminal event 이름 목록 */
function terminalEvents(): string[] {
  return [
    ...vi.mocked(logAuthEvent).mock.calls.map((c) => c[0]),
    ...vi.mocked(logAuthError).mock.calls.map((c) => c[0]),
  ];
}

/** REQUESTED → terminal 순서 및 각 1회 기록 검증 */
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

const FORBIDDEN_LOG_FIELDS = [
  "password",
  "raw_email",
  "raw_ip",
  "token",
  "provider_full_response",
] as const;

function expectNoForbiddenFields(payload: unknown): void {
  const entry = payload as Record<string, unknown>;
  for (const field of FORBIDDEN_LOG_FIELDS) {
    expect(entry).not.toHaveProperty(field);
  }
}

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

describe("로그인 API 로깅 검증", () => {
  const mockSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkIpRateLimitPrecheck).mockReturnValue({ allowed: true });
    vi.mocked(checkRequestEligibility).mockReturnValue({ allowed: true });
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "user@example.com",
      password: "Password1!",
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signInWithPassword: mockSignIn },
    } as never);
    mockSignIn.mockResolvedValue({
      data: { user: { id: "uid" }, session: {} },
      error: null,
    });
  });

  it("AUTH_LOGIN_REQUESTED가 1회 기록된다", async () => {
    await POST(makeRequest());

    expect(vi.mocked(logRequested)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_REQUESTED,
      expect.any(Object),
    );
    expect(vi.mocked(logRequested)).toHaveBeenCalledTimes(1);
  });

  it("성공 시 AUTH_LOGIN_COMPLETED가 기록되고 terminal event는 정확히 1개다", async () => {
    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_COMPLETED,
      expect.any(Object),
    );
    expect(terminalEvents()).toHaveLength(1);
    expect(terminalEvents()[0]).toBe(AUTH_EVENTS.AUTH_LOGIN_COMPLETED);
  });

  it("인증 실패 시 AUTH_LOGIN_FAILED + INVALID_CREDENTIALS가 기록된다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INVALID_CREDENTIALS,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("검증 실패 시 AUTH_INVALID_INPUT이 기록되고 terminal event는 정확히 1개다", async () => {
    vi.mocked(parseAuthJsonRequestBody).mockResolvedValue({
      email: "not-valid",
      password: "pass",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_INVALID_INPUT,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("JSON 파싱 실패 시 AUTH_INVALID_INPUT + INVALID_JSON이 기록된다", async () => {
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
  });

  it("rate limit 차단 시 AUTH_RATE_LIMIT_BLOCKED가 기록된다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "ip",
    });

    await POST(makeRequest());

    expect(vi.mocked(logAuthEvent)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED,
      expect.objectContaining({ reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("예상치 못한 예외 시 AUTH_LOGIN_FAILED + INTERNAL_ERROR가 기록된다", async () => {
    mockSignIn.mockRejectedValue(new Error("unexpected"));

    await POST(makeRequest());

    expect(vi.mocked(logAuthError)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_LOGIN_FAILED,
      expect.objectContaining({
        reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      }),
    );
    expect(terminalEvents()).toHaveLength(1);
  });

  it("시퀀스 검증: 성공 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: 인증 실패 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });
    await POST(makeRequest());
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: 내부 오류 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    mockSignIn.mockRejectedValue(new Error("boom"));
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
