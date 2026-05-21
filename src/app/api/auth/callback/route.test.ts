import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { GET } from "./route";

const exchangeCodeForSessionMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  })),
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    exchangeCodeForSessionMock.mockResolvedValue({
      error: null,
    });
  });

  function createRequest(path: string) {
    return new NextRequest(`http://localhost:3000${path}`);
  }

  it("code가 없으면 login으로 redirect한다", async () => {
    const response = await GET(createRequest("/api/auth/callback"));

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.LOGIN}`,
    );

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("code가 있으면 OAuth code를 session으로 교환한다", async () => {
    await GET(createRequest("/api/auth/callback?code=oauth-code"));

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
  });

  it("OAuth 교환에 성공하면 redirect query 경로로 redirect한다", async () => {
    const response = await GET(
      createRequest(
        `/api/auth/callback?code=oauth-code&redirect=${ROUTES.MYPAGE}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("redirect query가 없으면 mypage로 redirect한다", async () => {
    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code"),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("OAuth 교환에 실패하면 login으로 redirect한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: new Error("OAuth exchange failed"),
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code"),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.LOGIN}`,
    );
  });
});
