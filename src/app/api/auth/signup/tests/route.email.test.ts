/**
 * 회원가입 API - OTP 이메일 발송 분기 테스트
 *
 * 정책:
 * - 신규 사용자: createUser 이후 signup OTP 이메일 발송
 * - 기존 미인증 사용자: 새 계정을 만들지 않고 signup OTP 이메일 재발송
 * - 기존 인증 사용자: 계정 존재 여부 노출을 막기 위해 동일한 성공 응답 유지
 *
 * 검증:
 * - 분기별 issueOtpAndSendEmail 호출 여부
 * - 발송 email은 canonicalEmail이 아니라 실제 전송 대상 email 기준
 * - 신규 사용자 발송 실패는 SIGNUP_INTERNAL_ERROR
 * - 기존 사용자 발송 실패는 외부 응답 계약을 성공으로 유지
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
  upsertUserAgreement: upsertUserAgreementMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/admin");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

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

const mockCreateUser = vi.fn();

beforeEach(() => {
  resetEligibilityStore();
  vi.clearAllMocks();

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: {
        createUser: mockCreateUser,
      },
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
});

describe("회원가입 이메일 발송 - 신규 사용자", () => {
  it("TC-01. 신규 사용자 분기에서 createUser 이후 signup OTP 이메일 발송 함수가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-02. 신규 사용자 분기에서 issueOtpAndSendEmail이 raw email로 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "Test@Example.com",
      purpose: "signup",
    });
  });

  it("TC-03. 신규 사용자 이메일 발송 실패면 SIGNUP_INTERNAL_ERROR를 반환한다", async () => {
    vi.mocked(issueOtpAndSendEmail).mockRejectedValue(new Error("SMTP error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
  });

  it("TC-03A. 신규 사용자 createUser 실패면 SIGNUP_INTERNAL_ERROR를 반환한다", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: "create user failed",
        status: 500,
        code: "internal_error",
        name: "AuthApiError",
      },
    });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });
});

describe("회원가입 이메일 발송 - 기존 미인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
  });

  it("TC-04. 기존 미인증 사용자 분기에서는 createUser 없이 signup OTP 이메일을 발송한다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-05. 기존 미인증 사용자 분기에서 existingUser.email로 signup OTP 이메일을 발송한다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
  });

  it("TC-06. 기존 미인증 사용자 OTP 발송 실패도 외부 응답은 성공으로 유지된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "test@example.com",
      email_confirmed_at: null,
    } as never);

    vi.mocked(issueOtpAndSendEmail).mockRejectedValueOnce(
      new Error("otp send failed"),
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "Test@Example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("Test@Example.com")}`,
    });

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
  });
});

describe("회원가입 이메일 발송 - 기존 인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
  });

  it("TC-06. 기존 인증 사용자 분기에서도 createUser 없이 signup OTP 이메일을 발송한다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-07. 기존 인증 사용자 분기에서 existingUser.email로 signup OTP 이메일을 발송한다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
  });

  it("TC-08. 기존 인증 사용자 메일 전송 실패는 외부 응답을 실패로 바꾸지 않는다", async () => {
    vi.mocked(issueOtpAndSendEmail).mockRejectedValue(new Error("SMTP error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "Test@Example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("Test@Example.com")}`,
    });
  });
});
