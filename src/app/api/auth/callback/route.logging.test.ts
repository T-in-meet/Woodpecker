import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import {
  logAuthError,
  logCallback,
  logRequested,
} from "@/features/auth/lib/authLogger";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const verifyOtp = vi.fn();

function makeRequest(params?: {
  token_hash?: string;
  type?: string;
}): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (params?.token_hash !== undefined) {
    url.searchParams.set("token_hash", params.token_hash);
  }
  if (params?.type !== undefined) {
    url.searchParams.set("type", params.type);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function terminalEvents(): string[] {
  const callbackEvents = vi
    .mocked(logCallback)
    .mock.calls.map((call) => call[0]);
  const errorEvents = vi.mocked(logAuthError).mock.calls.map((call) => call[0]);
  return [...callbackEvents, ...errorEvents];
}

function expectRequestedBeforeSingleTerminal(): void {
  const requestedOrders = vi.mocked(logRequested).mock.invocationCallOrder;
  const terminalOrders = [
    ...vi.mocked(logCallback).mock.invocationCallOrder,
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

describe("콜백 라우트 인증 로깅", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["APP_URL"] = "http://localhost";
    vi.mocked(createClient).mockResolvedValue({
      auth: { verifyOtp },
    } as never);
    verifyOtp.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("요청 진입 후 성공이면 AUTH_CALLBACK_COMPLETED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));

    expect(vi.mocked(logRequested)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REQUESTED,
      expect.any(Object),
    );
    expect(vi.mocked(logCallback)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_COMPLETED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_CALLBACK_COMPLETED);
    expect(terminals).not.toEqual(
      expect.arrayContaining([
        AUTH_EVENTS.AUTH_CALLBACK_FAILED,
        AUTH_EVENTS.AUTH_CALLBACK_COMPLETED,
      ]),
    );
  });

  it("예상된 거부면 AUTH_CALLBACK_REJECTED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    await GET(makeRequest({ token_hash: "hash", type: "signup" }));

    expect(vi.mocked(logCallback)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_CALLBACK_REJECTED);
  });

  it("magiclink 검증 실패면 AUTH_CALLBACK_REJECTED가 기록되고 최종 이벤트는 정확히 1개다", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid token" },
    });

    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));

    expect(vi.mocked(logCallback)).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      expect.any(Object),
    );

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_CALLBACK_REJECTED);
    expect(terminals).not.toContain(AUTH_EVENTS.AUTH_CALLBACK_COMPLETED);
  });

  it("APP_URL 설정 오류면 예외를 던지고 terminal 로그를 남기지 않는다", async () => {
    process.env["APP_URL"] = "://invalid";

    await expect(
      GET(makeRequest({ token_hash: "hash", type: "magiclink" })),
    ).rejects.toThrow("Invalid APP_URL");

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(0);
  });

  it("verifyOtp에서 예외가 나면 AUTH_CALLBACK_FAILED가 기록된다", async () => {
    verifyOtp.mockRejectedValueOnce(new Error("verify failed"));

    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));

    const terminals = terminalEvents();
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toBe(AUTH_EVENTS.AUTH_CALLBACK_FAILED);
  });

  it("route에서 authLogger로 전달되는 payload에는 금지 필드가 없다", async () => {
    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));

    for (const [, payload] of vi.mocked(logRequested).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [, payload] of vi.mocked(logCallback).mock.calls) {
      expectNoForbiddenFields(payload);
    }
    for (const [, payload] of vi.mocked(logAuthError).mock.calls) {
      expectNoForbiddenFields(payload);
    }
  });

  it("시퀀스 검증: completed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: rejected 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    await GET(makeRequest({ token_hash: "hash", type: "signup" }));
    expectRequestedBeforeSingleTerminal();
  });

  it("시퀀스 검증: failed 분기는 REQUESTED 이후 terminal 1개로 끝난다", async () => {
    verifyOtp.mockRejectedValueOnce(new Error("verify failed"));

    await GET(makeRequest({ token_hash: "hash", type: "magiclink" }));
    expectRequestedBeforeSingleTerminal();
  });
});
