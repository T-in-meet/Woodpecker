import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import {
  logAuthError,
  logCallback,
  logRequested,
} from "@/features/auth/lib/authLogger";
import { createClient } from "@/lib/supabase/server";

import { GET } from "../route";

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: vi.fn(),
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

function makeRequest(params: {
  token_hash?: string;
  type?: string;
}): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (params.token_hash !== undefined) {
    url.searchParams.set("token_hash", params.token_hash);
  }
  if (params.type !== undefined) {
    url.searchParams.set("type", params.type);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("callback recovery 로깅", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["APP_URL"] = "https://app.example.com";
    vi.mocked(createClient).mockResolvedValue({
      auth: { verifyOtp },
    } as never);
    verifyOtp.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("TC1: success면 REQUESTED 1회 + COMPLETED 1회 기록", async () => {
    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    expect(logRequested).toHaveBeenCalledTimes(1);
    expect(logRequested).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REQUESTED,
      expect.any(Object),
    );
    expect(logCallback).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_COMPLETED,
      expect.any(Object),
    );
    expect(logAuthError).not.toHaveBeenCalled();
  });

  it("TC2: unsupported type도 rejected로 기록", async () => {
    await GET(makeRequest({ token_hash: "valid-token", type: "signup" }));

    expect(logRequested).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      expect.any(Object),
    );
    expect(logAuthError).not.toHaveBeenCalled();
  });

  it("TC3: rejected면 REQUESTED 1회 + REJECTED 1회 기록", async () => {
    await GET(makeRequest({ type: "recovery" }));

    expect(logRequested).toHaveBeenCalledTimes(1);
    expect(logRequested).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REQUESTED,
      expect.any(Object),
    );
    expect(logCallback).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      expect.any(Object),
    );
    expect(logAuthError).not.toHaveBeenCalled();
  });

  it("TC4: verifyOtp error도 rejected로 기록", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid token" },
    });

    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    expect(logRequested).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledTimes(1);
    expect(logCallback).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_REJECTED,
      expect.any(Object),
    );
    expect(logAuthError).not.toHaveBeenCalled();
  });

  // verifyOtp throw는 시스템 예외이므로 rejected가 아니라 failed로 기록한다.
  // terminal event는 logAuthError(AUTH_CALLBACK_FAILED) 1회만 남긴다.
  it("TC5: verifyOtp throw면 REQUESTED 1회 + FAILED 1회 기록", async () => {
    verifyOtp.mockRejectedValueOnce(new Error("boom"));

    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    expect(logRequested).toHaveBeenCalledTimes(1);
    expect(logCallback).not.toHaveBeenCalled();
    expect(logAuthError).toHaveBeenCalledTimes(1);
    expect(logAuthError).toHaveBeenCalledWith(
      AUTH_EVENTS.AUTH_CALLBACK_FAILED,
      expect.any(Object),
    );
  });
});
