import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";
import { ROUTES } from "@/lib/constants/routes";
import {
  getSessionFromMiddlewareRequest,
  updateSession,
} from "@/lib/supabase/middleware";

import { middleware } from "../middleware";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
  getSessionFromMiddlewareRequest: vi.fn(),
}));

const getSessionMock = vi.fn();

function makeRequest(path: string, options?: { hasResetCookie?: boolean }) {
  const url = new URL(path, "http://localhost");
  const request = new NextRequest(url.toString(), { method: "GET" });

  if (options?.hasResetCookie) {
    request.cookies.set(RESET_REQUIRED_COOKIE_NAME, "true");
  }

  return request;
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

  it("TC1: session+cookie 상태로 보호 페이지 접근 시 reset-password로 redirect한다", async () => {
    const response = await middleware(
      makeRequest(ROUTES.NOTES, { hasResetCookie: true }),
    );
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(307);
    expect(location).toContain(ROUTES.RESET_PASSWORD);
    expect(location).toContain("redirect=%2Fnotes");
  });

  it("TC2: session+cookie 상태로 reset-password 접근 시 통과한다", async () => {
    const response = await middleware(
      makeRequest(ROUTES.RESET_PASSWORD, { hasResetCookie: true }),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("TC3: session 없음 + cookie 있음이면 forgot-password로 redirect한다", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const response = await middleware(
      makeRequest(ROUTES.RESET_PASSWORD, { hasResetCookie: true }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
  });

  it("TC4: session 있음 + cookie 없음이면 forgot-password로 redirect한다", async () => {
    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
  });

  it("TC5: session 없음 + cookie 없음이면 forgot-password로 redirect한다", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
  });

  it("TC6/TC7: 제외 경로는 reset-password 강제 redirect를 하지 않는다", async () => {
    const paths = [
      ROUTES.RESET_PASSWORD,
      ROUTES.FORGOT_PASSWORD,
      "/api/anything",
      "/_next/static/chunks/main.js",
      "/favicon.ico",
      "/api/auth/callback?token_hash=a&type=recovery",
    ];

    for (const path of paths) {
      const response = await middleware(
        makeRequest(path, { hasResetCookie: true }),
      );
      const location = response.headers.get("location") ?? "";
      expect(location).not.toContain(ROUTES.RESET_PASSWORD);
    }
  });

  it("TC8: session만 존재 또는 cookie만 존재면 강제 상태로 판단하지 않는다", async () => {
    const onlySessionResponse = await middleware(makeRequest(ROUTES.NOTES));
    expect(onlySessionResponse.headers.get("location")).toBeNull();

    getSessionMock.mockResolvedValueOnce(null);
    const onlyCookieResponse = await middleware(
      makeRequest(ROUTES.NOTES, { hasResetCookie: true }),
    );
    expect(onlyCookieResponse.headers.get("location")).toBeNull();
  });

  it("TC9: updateSession 호출 후 접근 제어를 수행한다", async () => {
    await middleware(makeRequest(ROUTES.NOTES, { hasResetCookie: true }));

    expect(updateSession).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequest).toHaveBeenCalledTimes(1);

    const updateOrder = vi.mocked(updateSession).mock.invocationCallOrder[0]!;
    const sessionOrder = vi.mocked(getSessionFromMiddlewareRequest).mock
      .invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(sessionOrder);
  });

  it("TC10: redirect 시 updateSession response cookie를 유지한다", async () => {
    const base = NextResponse.next();
    base.cookies.set("sb-refresh-token", "refresh-token", { path: "/" });
    vi.mocked(updateSession).mockResolvedValueOnce(base);

    const response = await middleware(
      makeRequest(ROUTES.NOTES, { hasResetCookie: true }),
    );

    expect(response.headers.get("location")).toContain(ROUTES.RESET_PASSWORD);
    expect(response.cookies.get("sb-refresh-token")?.value).toBe(
      "refresh-token",
    );
  });

  it("TC11: cookie 만료(없음) 상태는 cookie 없음과 동일하게 처리한다", async () => {
    const response = await middleware(makeRequest(ROUTES.RESET_PASSWORD));
    expect(response.headers.get("location")).toContain(ROUTES.FORGOT_PASSWORD);
  });

  it("TC12: 강제 상태 해제(session 있음 + cookie 없음)면 notes 접근 시 강제 redirect하지 않는다", async () => {
    const response = await middleware(makeRequest(ROUTES.NOTES));
    expect(response.headers.get("location")).toBeNull();
  });

  it("TC13: 강제 상태에서 allowlist 허용 경로(/notes)는 redirect query를 보존한다", async () => {
    const response = await middleware(
      makeRequest(ROUTES.NOTES, { hasResetCookie: true }),
    );

    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.RESET_PASSWORD);
    expect(location).toContain("redirect=%2Fnotes");
  });

  it("TC14: 강제 상태에서 allowlist 비허용 경로는 redirect query를 붙이지 않는다", async () => {
    const response = await middleware(
      makeRequest("/unknown-path", { hasResetCookie: true }),
    );

    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.RESET_PASSWORD);
    expect(location).not.toContain("redirect=");
    expect(location).not.toContain("redirect=%2Fmypage");
  });
});
