import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

vi.mock("@/lib/supabase/middleware", () => ({
  getSessionFromMiddlewareRequest: vi.fn(),
  updateSession: vi.fn(),
}));

import {
  getSessionFromMiddlewareRequest,
  updateSession,
} from "@/lib/supabase/middleware";

import { config, middleware } from "./middleware";

const updateSessionMock = vi.mocked(updateSession);
const getSessionFromMiddlewareRequestMock = vi.mocked(
  getSessionFromMiddlewareRequest,
);

function matchesMiddleware(pathname: string) {
  const matcher = config.matcher[0];

  if (!matcher) {
    throw new Error("Expected middleware matcher to be configured.");
  }

  return new RegExp(`^${matcher}$`).test(pathname);
}

function createRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

function createBaseResponse() {
  const response = NextResponse.next();
  response.cookies.set("test-cookie", "test-value");
  return response;
}

describe("middleware matcher", () => {
  it.each([
    { expected: false, pathname: "/sw.js" },
    { expected: false, pathname: "/sw.js.map" },
    { expected: false, pathname: "/swe-worker-abc.js" },
    { expected: false, pathname: "/swe-worker-abc.js.map" },
    { expected: false, pathname: "/api/auth/hooks/send-email" },
    { expected: true, pathname: "/notes" },
    { expected: true, pathname: "/mypage" },
    { expected: true, pathname: ROUTES.LOGIN },
    { expected: true, pathname: ROUTES.SIGNUP },
    { expected: true, pathname: ROUTES.FORGOT_PASSWORD },
    { expected: true, pathname: ROUTES.VERIFY_EMAIL },
    { expected: true, pathname: ROUTES.RESET_PASSWORD },
  ])("matches $pathname => $expected", ({ pathname, expected }) => {
    expect(matchesMiddleware(pathname)).toBe(expected);
  });
});

describe("middleware auth page access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ROUTES.LOGIN,
    ROUTES.SIGNUP,
    ROUTES.VERIFY_EMAIL,
    ROUTES.FORGOT_PASSWORD,
  ])(
    "세션이 있는 사용자가 %s에 접근하면 HOME으로 redirect한다",
    async (pathname) => {
      const baseResponse = createBaseResponse();

      updateSessionMock.mockResolvedValue(baseResponse);
      getSessionFromMiddlewareRequestMock.mockResolvedValue({
        user: { id: "user-id" },
      } as Awaited<ReturnType<typeof getSessionFromMiddlewareRequest>>);

      const response = await middleware(createRequest(pathname));

      expect(updateSessionMock).toHaveBeenCalledTimes(1);
      expect(getSessionFromMiddlewareRequestMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `http://localhost:3000${ROUTES.HOME}`,
      );
      expect(response.cookies.get("test-cookie")?.value).toBe("test-value");
    },
  );

  it.each([
    ROUTES.LOGIN,
    ROUTES.SIGNUP,
    ROUTES.VERIFY_EMAIL,
    ROUTES.FORGOT_PASSWORD,
  ])("세션이 없는 사용자가 %s에 접근하면 통과한다", async (pathname) => {
    const baseResponse = createBaseResponse();

    updateSessionMock.mockResolvedValue(baseResponse);
    getSessionFromMiddlewareRequestMock.mockResolvedValue(null);

    const response = await middleware(createRequest(pathname));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequestMock).toHaveBeenCalledTimes(1);
    expect(response).toBe(baseResponse);
    expect(response.headers.get("location")).toBeNull();
  });

  it("세션이 없는 사용자가 reset-password에 접근하면 forgot-password로 redirect한다", async () => {
    const baseResponse = createBaseResponse();

    updateSessionMock.mockResolvedValue(baseResponse);
    getSessionFromMiddlewareRequestMock.mockResolvedValue(null);

    const response = await middleware(createRequest(ROUTES.RESET_PASSWORD));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequestMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.FORGOT_PASSWORD}`,
    );
    expect(response.cookies.get("test-cookie")?.value).toBe("test-value");
  });

  it("세션이 있는 사용자가 reset-password에 접근하면 통과한다", async () => {
    const baseResponse = createBaseResponse();

    updateSessionMock.mockResolvedValue(baseResponse);
    getSessionFromMiddlewareRequestMock.mockResolvedValue({
      user: { id: "user-id" },
    } as Awaited<ReturnType<typeof getSessionFromMiddlewareRequest>>);

    const response = await middleware(createRequest(ROUTES.RESET_PASSWORD));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequestMock).toHaveBeenCalledTimes(1);
    expect(response).toBe(baseResponse);
    expect(response.headers.get("location")).toBeNull();
  });

  it("auth 접근 제어 대상이 아닌 경로는 session을 조회하지 않고 통과한다", async () => {
    const baseResponse = createBaseResponse();

    updateSessionMock.mockResolvedValue(baseResponse);

    const response = await middleware(createRequest("/notes"));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequestMock).not.toHaveBeenCalled();
    expect(response).toBe(baseResponse);
    expect(response.headers.get("location")).toBeNull();
  });

  it("auth callback 경로는 session을 조회하지 않고 통과한다", async () => {
    const baseResponse = createBaseResponse();

    updateSessionMock.mockResolvedValue(baseResponse);

    const response = await middleware(createRequest("/api/auth/callback"));

    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromMiddlewareRequestMock).not.toHaveBeenCalled();
    expect(response).toBe(baseResponse);
    expect(response.headers.get("location")).toBeNull();
  });
});
