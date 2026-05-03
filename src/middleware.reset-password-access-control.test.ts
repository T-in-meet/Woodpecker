import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import {
  getSessionFromMiddlewareRequest,
  updateSession,
} from "@/lib/supabase/middleware";

import { middleware } from "./middleware";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
  getSessionFromMiddlewareRequest: vi.fn(),
}));

const getSessionMock = vi.fn();

function makeRequest(path: string) {
  const url = new URL(path, "http://localhost");
  return new NextRequest(url.toString(), { method: "GET" });
}

function makeUpdateSessionResponse() {
  return NextResponse.next();
}

describe("middleware reset-password access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateSession).mockResolvedValue(makeUpdateSessionResponse());
    vi.mocked(getSessionFromMiddlewareRequest).mockImplementation(async () =>
      getSessionMock(),
    );
    getSessionMock.mockResolvedValue({});
  });

  it("TC1: reset-password가 아닌 경로는 session 검사 없이 통과한다", async () => {
    const response = await middleware(makeRequest(ROUTES.NOTES));

    expect(response.headers.get("location")).toBeNull();
    expect(getSessionFromMiddlewareRequest).not.toHaveBeenCalled();
  });

  it("TC2: session이 있으면 reset-password 접근을 허용한다", async () => {
    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(response.headers.get("location")).toBeNull();
    expect(getSessionFromMiddlewareRequest).toHaveBeenCalledTimes(1);
  });

  it("TC3: session이 없으면 reset-password 접근 시 forgot-password로 redirect한다", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
  });

  it("TC4: updateSession 호출 후 reset-password 접근 제어를 수행한다", async () => {
    await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(updateSession).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequest).toHaveBeenCalledTimes(1);

    const updateOrder = vi.mocked(updateSession).mock.invocationCallOrder[0]!;
    const sessionOrder = vi.mocked(getSessionFromMiddlewareRequest).mock
      .invocationCallOrder[0]!;

    expect(updateOrder).toBeLessThan(sessionOrder);
  });

  it("TC5: redirect 시 updateSession response cookie를 유지한다", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const base = NextResponse.next();
    base.cookies.set("sb-refresh-token", "refresh-token", { path: "/" });
    vi.mocked(updateSession).mockResolvedValueOnce(base);

    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
    expect(response.cookies.get("sb-refresh-token")?.value).toBe(
      "refresh-token",
    );
  });
});
