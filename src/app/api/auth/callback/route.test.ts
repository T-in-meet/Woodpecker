import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OAUTH_CALLBACK_ERROR_REASON } from "@/features/auth/constants/oauthCallbackError";
import { ROUTES } from "@/lib/constants/routes";

import { GET } from "./route";

const hasUserAgreementMock = vi.hoisted(() => vi.fn());
const upsertUserAgreementMock = vi.hoisted(() => vi.fn());
const exchangeCodeForSessionMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/features/auth/lib/userAgreements", () => ({
  AGREEMENT_REQUIRED_REDIRECT: "/signup?agreement_required=1",
  hasUserAgreement: hasUserAgreementMock,
  upsertUserAgreement: upsertUserAgreementMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      signOut: signOutMock,
    },
  })),
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: { id: "user-id", user_metadata: {} },
      },
      error: null,
    });
    hasUserAgreementMock.mockResolvedValue(true);
    upsertUserAgreementMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue({ error: null });
  });

  function createRequest(path: string, headers?: HeadersInit) {
    return new NextRequest(
      `http://localhost:3000${path}`,
      headers ? { headers } : undefined,
    );
  }

  it("code가 없으면 login으로 redirect한다", async () => {
    const response = await GET(createRequest("/api/auth/callback"));

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.LOGIN}?oauth_error=${OAUTH_CALLBACK_ERROR_REASON.MISSING_CODE}`,
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
      data: { user: null },
      error: new Error("OAuth exchange failed"),
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code"),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.LOGIN}?oauth_error=${OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED}`,
    );
  });

  it("signup intent에서 OAuth 교환에 실패하면 signup으로 redirect한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: null },
      error: new Error("OAuth exchange failed"),
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup"),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.SIGNUP}?oauth_error=${OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED}`,
    );
  });

  it("intent query가 없어도 signup 약관 cookie가 있으면 OAuth 교환 실패 시 signup으로 redirect한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: null },
      error: new Error("OAuth exchange failed"),
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.SIGNUP}?oauth_error=${OAUTH_CALLBACK_ERROR_REASON.EXCHANGE_FAILED}`,
    );
  });

  it("login intent에서 약관 기록이 없으면 세션을 종료하고 회원가입으로 redirect한다", async () => {
    hasUserAgreementMock.mockResolvedValue(false);

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=login"),
    );

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/signup?agreement_required=1",
    );
  });

  it("signup intent에서 약관 intent cookie가 있으면 약관 기록을 저장한다", async () => {
    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
    expect(upsertUserAgreementMock).toHaveBeenCalledWith("user-id", "oauth");
  });

  it("intent query가 없어도 signup 약관 cookie가 있으면 약관 기록을 저장한다", async () => {
    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
    expect(upsertUserAgreementMock).toHaveBeenCalledWith("user-id", "oauth");
  });

  it("signup intent에서 약관 intent cookie가 없으면 세션을 종료하고 회원가입으로 redirect한다", async () => {
    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup"),
    );

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(upsertUserAgreementMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/signup?agreement_required=1",
    );
  });
});
