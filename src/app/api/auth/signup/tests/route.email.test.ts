/**
 * 회원가입 API - 이메일 발송 side-effect 전용 테스트
 *
 * 이 파일은 signup route의 이메일 발송 분기 동작만 검증한다.
 * - 기존 미인증 사용자: generateLink → encryptTicket → sendAuthEmail 호출
 * - 기존 인증 사용자: sendAuthEmail 미호출
 * - 신규 사용자: sendAuthEmail 미호출 (Supabase Hook이 처리)
 * - 이메일 발송 실패해도 외부 응답은 동일 (Account Enumeration 방어)
 *
 * 핵심 목적:
 * 이메일 발송이 side-effect임을 명확히 하고, 실패가 외부에 노출되지 않음을 검증한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { encryptTicket } from "@/features/auth/email/ticket";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/admin");
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/features/auth/email/ticket");

const TEST_TOKEN_HASH = "raw-token-hash-abc123";
const TEST_TICKET = "encrypted-ticket-xyz";

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

const mockSignUp = vi.fn();
const mockGenerateLink = vi.fn();

beforeEach(() => {
  resetRateLimitStores();
  vi.clearAllMocks();

  vi.mocked(createClient).mockResolvedValue({
    auth: { signUp: mockSignUp },
  } as never);

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  } as never);

  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(encryptTicket).mockReturnValue(TEST_TICKET);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

  mockSignUp.mockResolvedValue({
    data: { user: { email: "test@example.com" } },
    error: null,
  });

  mockGenerateLink.mockResolvedValue({
    data: {
      properties: {
        hashed_token: TEST_TOKEN_HASH,
        token_hash: TEST_TOKEN_HASH, // fallback 대응
      },
      user: {},
    },
    error: null,
  });
});

describe("회원가입 이메일 발송 - 기존 미인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
  });

  it("TC-01. 기존 미인증 사용자 분기에서 generateLink가 정확히 1회 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
  });

  it("TC-02. generateLink에 소문자로 정규화된 이메일이 전달된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("TC-03. encryptTicket(token_hash) 결과로 sendAuthEmail이 1회 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(encryptTicket)).toHaveBeenCalledWith(TEST_TOKEN_HASH);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TICKET,
      "verify-email",
    );
  });

  it("TC-04. 이메일 발송 성공 시 200 성공 응답을 반환한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });

  it("TC-05. sendAuthEmail이 throw해도 200 성공 응답을 반환한다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("Resend API error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });

  it("TC-06. sendAuthEmail 실패 시에도 sendAuthEmail은 1회 시도된다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("Resend API error"));

    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-07. generateLink 실패 시에도 200 성공 응답을 반환하고 sendAuthEmail은 호출되지 않는다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: "generate link failed" },
    });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });
});

describe("회원가입 이메일 발송 - 기존 인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
  });

  it("TC-08. 기존 인증 사용자 분기에서는 sendAuthEmail이 호출되지 않는다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });

  it("TC-09. 기존 인증 사용자 분기에서는 generateLink가 호출되지 않는다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });
});

describe("회원가입 이메일 발송 - 신규 사용자", () => {
  it("TC-10. 신규 사용자 분기에서는 sendAuthEmail이 직접 호출되지 않는다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });

  it("TC-11. 신규 사용자 분기에서는 generateLink가 호출되지 않는다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-12. 신규 사용자 signUp 호출에는 emailRedirectTo를 포함하지 않는다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        password: requestBody.password,
        options: {
          data: { nickname: requestBody.nickname },
        },
      }),
    );
  });
});
