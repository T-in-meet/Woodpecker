import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { logError, logInfo, logWarn } from "@/lib/logger";

import { logAuthError, logAuthEvent } from "./authLogger";

vi.mock("@/lib/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

describe("authLogger 분기 라우팅", () => {
  const forbiddenFields = [
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

  const expectNoForbiddenFields = (payload: unknown) => {
    expect(payload).toBeTypeOf("object");
    const entry = payload as Record<string, unknown>;
    for (const field of forbiddenFields) {
      expect(entry).not.toHaveProperty(field);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logAuthEvent에서 result === "success"이면 info를 호출한다', () => {
    logAuthEvent(AUTH_EVENTS.AUTH_SIGNUP_COMPLETED, {
      path: "/api/auth/signup",
      method: "POST",
      status: 200,
      provider: "email",
      result: "success",
    });

    expect(vi.mocked(logInfo)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logWarn)).not.toHaveBeenCalled();
    expect(vi.mocked(logError)).not.toHaveBeenCalled();
  });

  it('logAuthEvent에서 result === "blocked"이면 warn을 호출한다', () => {
    // [이유: RATE_LIMIT_IP → RATE_LIMIT_IP_SHORT로 rename됨]
    logAuthEvent(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED, {
      path: "/api/auth/signup",
      method: "POST",
      status: 429,
      provider: "email",
      result: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    });

    expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logInfo)).not.toHaveBeenCalled();
    expect(vi.mocked(logError)).not.toHaveBeenCalled();
  });

  it('logAuthEvent에서 result === "failure"이면 warn을 호출한다', () => {
    logAuthEvent(AUTH_EVENTS.AUTH_INVALID_INPUT, {
      path: "/api/auth/signup",
      method: "POST",
      status: 400,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
    });

    expect(vi.mocked(logWarn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logInfo)).not.toHaveBeenCalled();
    expect(vi.mocked(logError)).not.toHaveBeenCalled();
  });

  it("logAuthError는 error를 호출해야 한다", () => {
    logAuthError(AUTH_EVENTS.AUTH_SIGNUP_FAILED, {
      path: "/api/auth/signup",
      method: "POST",
      status: 500,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      errorMessage: "boom",
      errorName: "Error",
    });

    expect(vi.mocked(logError)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logInfo)).not.toHaveBeenCalled();
    expect(vi.mocked(logWarn)).not.toHaveBeenCalled();
  });

  it("shared logger로 전달되는 payload에는 금지 필드가 없어야 한다", () => {
    logAuthEvent(AUTH_EVENTS.AUTH_SIGNUP_COMPLETED, {
      path: "/api/auth/signup",
      method: "POST",
      status: 200,
      provider: "email",
      result: "success",
    });
    // [이유: RATE_LIMIT_IP → RATE_LIMIT_IP_SHORT로 rename됨]
    logAuthEvent(AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED, {
      path: "/api/auth/signup",
      method: "POST",
      status: 429,
      provider: "email",
      result: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT,
    });
    logAuthError(AUTH_EVENTS.AUTH_CALLBACK_FAILED, {
      path: "/api/auth/callback",
      method: "GET",
      status: 307,
      provider: "email",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      errorMessage: "callback failed",
      errorName: "Error",
    });

    for (const [payload] of vi.mocked(logInfo).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [payload] of vi.mocked(logWarn).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [payload] of vi.mocked(logError).mock.calls) {
      expectNoForbiddenFields(payload);
    }
  });
});
