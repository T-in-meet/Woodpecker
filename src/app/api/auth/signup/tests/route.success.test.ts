/**
 * 회원가입 API의 기본 성공 흐름 전용 테스트
 *
 * 이 파일은 "신규 사용자가 정상 payload로 가입할 때"의 기본 계약만 검증한다.
 * - admin.generateLink 호출 여부
 * - 이메일 소문자 정규화
 * - 200 OK 반환
 * - 성공 응답 계약(success/code/data) 유지
 *
 * 제외:
 * - 입력 validation 실패
 * - 약관 동의 실패
 * - 기존 계정 인증/미인증 분기
 * - rate limit
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
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/lib/supabase/admin");

describe("회원가입 API 기본 성공 흐름 검증", () => {
  const mockCreateUser = vi.fn();
  const mockGenerateLink = vi.fn();

  beforeEach(() => {
    resetEligibilityStore();
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";

    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: { createUser: mockCreateUser, generateLink: mockGenerateLink },
      },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
    mockCreateUser.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
      },
      error: null,
    });
  });

  const requestBody = {
    email: "Test@Example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  const mockSignupGenerateLinkSuccess = () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
  };

  it("TC-01: 신규 이메일 요청 시 generateLink(magiclink)이 1회 호출된다", async () => {
    mockSignupGenerateLinkSuccess();

    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
  });

  it("TC-02: raw email이 generateLink에 전달된다", async () => {
    mockSignupGenerateLinkSuccess();

    await POST(makeRequest(requestBody));

    // canonicalization을 위해 canonical email은 내부용으로만 사용
    // generateLink는 auth.users의 raw email 기준으로 호출
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "magiclink",
        email: "Test@Example.com",
      }),
    );
  });

  it("TC-04: API는 200 OK를 반환한다", async () => {
    mockSignupGenerateLinkSuccess();

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
  });

  it("TC-05: 성공 응답 body는 success true, code SIGNUP_SUCCESS, data 객체를 포함한다", async () => {
    mockSignupGenerateLinkSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).not.toBeNull();
    expect(typeof body.data).toBe("object");
  });

  it("TC-06: 성공 응답 data.email은 사용자 입력 이메일(raw email)을 보존한다", async () => {
    mockSignupGenerateLinkSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    // canonicalization은 내부 identity check용
    // 응답은 사용자 입력 보존 (raw email)
    expect(body.data.email).toBe("Test@Example.com");
  });

  it("TC-07: 성공 응답 data는 email(raw)과 redirectTo만 포함한다", async () => {
    mockSignupGenerateLinkSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data).toEqual({
      email: "Test@Example.com",
      redirectTo: ROUTES.VERIFY_EMAIL,
    });
  });
});
