/**
 * 회원가입 API의 기본 성공 흐름 전용 테스트
 *
 * 이 파일은 "신규 사용자가 정상 payload로 가입할 때"의 기본 계약만 검증한다.
 * - createUser 호출 여부
 * - signup OTP 발송 함수 호출 여부
 * - raw email / canonical_email 처리
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
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const upsertUserAgreementMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: upsertUserAgreementMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/lib/supabase/admin");

describe("회원가입 API 기본 성공 흐름 검증", () => {
  const mockCreateUser = vi.fn();

  beforeEach(() => {
    resetEligibilityStore();
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";

    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: { createUser: mockCreateUser },
      },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
    mockCreateUser.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
      },
      error: null,
    });
    upsertUserAgreementMock.mockResolvedValue(undefined);
  });

  const requestBody = {
    email: "Test@Example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  it("TC-01: 신규 이메일 요청 시 createUser 이후 signup OTP 발송 함수가 1회 호출된다", async () => {
    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-02: raw email이 signup OTP 발송 함수에 전달된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "Test@Example.com",
      purpose: "signup",
    });
  });

  it("TC-02A: 신규 이메일 가입 시 약관 동의 기록을 저장한다", async () => {
    await POST(makeRequest(requestBody));

    expect(upsertUserAgreementMock).toHaveBeenCalledWith("user-id", "email");
  });

  it("TC-03: createUser는 raw email을 저장하고 canonical_email은 metadata로 저장한다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "Test@Example.com",
        user_metadata: expect.objectContaining({
          nickname: "테스터",
          canonical_email: "test@example.com",
        }),
      }),
    );
  });

  it("TC-04: API는 200 OK를 반환한다", async () => {
    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
  });

  it("TC-05: 성공 응답 body는 success true, code SIGNUP_SUCCESS, data 객체를 포함한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).not.toBeNull();
    expect(typeof body.data).toBe("object");
  });

  it("TC-06: 성공 응답 data.email은 사용자 입력 이메일(raw email)을 보존한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    // canonicalization은 내부 identity check용
    // 응답은 사용자 입력 보존 (raw email)
    expect(body.data.email).toBe("Test@Example.com");
  });

  it("TC-07: 성공 응답 data는 email(raw)과 redirectTo만 포함한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data).toEqual({
      email: "Test@Example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("Test@Example.com")}`,
    });
  });
});
