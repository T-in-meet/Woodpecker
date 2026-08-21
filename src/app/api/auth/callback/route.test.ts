import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OAUTH_CALLBACK_ERROR_REASON } from "@/features/auth/constants/oauthCallbackError";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { GET } from "./route";

const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());
const upsertUserAgreementMock = vi.hoisted(() => vi.fn());
const exchangeCodeForSessionMock = vi.fn();
const signOutMock = vi.fn();
const updateProfileMock = vi.fn();
const updateProfileEqMock = vi.fn();
const selectProfileMock = vi.fn();
const selectProfileEqMock = vi.fn();
const selectProfileSingleMock = vi.fn();

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
  ensureUserAgreement: upsertUserAgreementMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      signOut: signOutMock,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const createAdminClientMock = vi.mocked(createAdminClient);

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "oauth.user@example.com",
          user_metadata: {},
        },
      },
      error: null,
    });
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
    upsertUserAgreementMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue({ error: null });
    updateProfileMock.mockReturnValue({ eq: updateProfileEqMock });
    updateProfileEqMock.mockResolvedValue({ error: null });
    selectProfileMock.mockReturnValue({ eq: selectProfileEqMock });
    selectProfileEqMock.mockReturnValue({ single: selectProfileSingleMock });
    selectProfileSingleMock.mockResolvedValue({
      data: { nickname: "사용자" },
      error: null,
    });
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        update: updateProfileMock,
        select: selectProfileMock,
      })),
      storage: {
        from: vi.fn(),
      },
    } as never);
  });

  /**
   * 테스트용 callback 요청 객체를 생성합니다.
   */
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

  it("login intent에서 최신 확인 기록이 없으면 세션을 유지하고 재확인 화면으로 redirect한다", async () => {
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: false,
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=login"),
    );

    expect(signOutMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/agreements?redirect=%2Fmypage",
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

  it("signup intent에서 provider 이름이 nickname으로 저장되었으면 프로필 안내 query를 추가한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "oauth.user@example.com",
          user_metadata: { name: "GoogleName" },
        },
      },
      error: null,
    });
    selectProfileSingleMock.mockResolvedValue({
      data: { nickname: "GoogleName" },
      error: null,
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}?section=profile&profile_nickname=provider`,
    );
  });

  it("signup intent에서 fallback nickname이면 프로필 안내 query를 추가한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "abcde-user-id",
          email: "oauth.user@example.com",
          user_metadata: { name: "Christopher Kim" },
        },
      },
      error: null,
    });
    selectProfileSingleMock.mockResolvedValue({
      data: { nickname: "user_abcde" },
      error: null,
    });

    const response = await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}?section=profile&profile_nickname=fallback`,
    );
  });

  it("signup intent에서 약관 intent cookie가 있으면 OAuth 이메일을 정규화해 프로필에 저장한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "OAuth.User+alias@Gmail.com",
          user_metadata: {},
        },
      },
      error: null,
    });

    await GET(
      createRequest("/api/auth/callback?code=oauth-code&intent=signup", {
        Cookie: "oauth_agreement_intent=accepted",
      }),
    );

    expect(updateProfileMock).toHaveBeenCalledWith({
      canonical_email: "oauthuser@gmail.com",
    });
    expect(updateProfileEqMock).toHaveBeenCalledWith("id", "user-id");
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

  it("login intent에서 약관 기록이 있으면 OAuth 이메일을 프로필에 저장한다", async () => {
    await GET(createRequest("/api/auth/callback?code=oauth-code&intent=login"));

    expect(updateProfileMock).toHaveBeenCalledWith({
      canonical_email: "oauth.user@example.com",
    });
    expect(updateProfileEqMock).toHaveBeenCalledWith("id", "user-id");
  });

  it("OAuth 이메일이 없으면 프로필 이메일 업데이트를 생략한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          user_metadata: {},
        },
      },
      error: null,
    });

    await GET(createRequest("/api/auth/callback?code=oauth-code&intent=login"));

    expect(updateProfileMock).not.toHaveBeenCalled();
    expect(updateProfileEqMock).not.toHaveBeenCalled();
  });
});
