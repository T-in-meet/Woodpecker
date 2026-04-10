/**
 * 회원가입 API - 이메일 발송 분기 테스트 (정책 기준)
 *
 * 정책:
 * - 신규 사용자: signup generateLink → sendAuthEmail(email, tokenHash, "signup")
 * - 기존 미인증 사용자: magiclink generateLink → sendAuthEmail(email, tokenHash, "magiclink")
 * - 기존 인증 사용자: magiclink generateLink → sendAuthEmail(email, tokenHash, "magiclink")
 *
 * ticket 암호화 없음. Supabase hashed_token을 직접 사용.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/admin");
vi.mock("@/features/auth/email/sendAuthEmail");

const TEST_TOKEN_HASH = "raw-token-hash-abc123";

const requestBody = {
  email: "Test@Example.com",
  password: "Password123!",
  nickname: "테스터",
  agreements: { termsOfService: true as const, privacyPolicy: true as const },
};

const unverifiedUser = {
  email: "test@example.com",
  email_confirmed_at: null,
};

const verifiedUser = {
  email: "test@example.com",
  email_confirmed_at: "2026-03-29T00:00:00.000Z",
};

const mockGenerateLink = vi.fn();

beforeEach(() => {
  resetEligibilityStore();
  vi.clearAllMocks();

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  } as never);

  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

  mockGenerateLink.mockResolvedValue({
    data: {
      properties: {
        hashed_token: TEST_TOKEN_HASH,
      },
      user: { id: "user-id", email: "test@example.com" },
    },
    error: null,
  });
});

describe("회원가입 이메일 발송 - 신규 사용자", () => {
  it("TC-01. 신규 사용자 분기에서 signup generateLink가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "signup",
        email: "test@example.com",
        password: requestBody.password,
      }),
    );
  });

  it("TC-02. 신규 사용자 분기에서 sendAuthEmail이 tokenHash와 type=signup으로 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TOKEN_HASH,
      "signup",
    );
  });

  it("TC-03. 신규 사용자 이메일 발송 실패 시에도 SIGNUP_SUCCESS 응답을 반환한다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("SMTP error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.VERIFY_EMAIL,
    });
  });
});

describe("회원가입 이메일 발송 - 기존 미인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
  });

  it("TC-04. 기존 미인증 사용자 분기에서 magiclink generateLink가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "magiclink",
        email: "test@example.com",
      }),
    );
  });

  it("TC-05. 기존 미인증 사용자 분기에서 sendAuthEmail이 tokenHash와 type=magiclink으로 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TOKEN_HASH,
      "magiclink",
    );
  });
});

describe("회원가입 이메일 발송 - 기존 인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
  });

  it("TC-06. 기존 인증 사용자 분기에서도 magiclink generateLink가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "magiclink",
        email: "test@example.com",
      }),
    );
  });

  it("TC-07. 기존 인증 사용자 분기에서 sendAuthEmail이 tokenHash와 type=magiclink으로 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TOKEN_HASH,
      "magiclink",
    );
  });

  it("TC-08. 기존 인증 사용자 메일 전송 실패는 외부 응답을 실패로 바꾸지 않는다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("SMTP error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.VERIFY_EMAIL,
    });
  });
});
