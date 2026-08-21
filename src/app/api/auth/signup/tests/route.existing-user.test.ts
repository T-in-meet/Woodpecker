/**
 * 기존 계정 재요청 분기 전용 테스트
 *
 * 이 파일은 signup API가 "이미 존재하는 계정"을 만났을 때의 분기 정책만 검증한다.
 * - 기존 미인증/인증 계정이면 200
 * - 두 경우 모두 getUserByEmail 호출 확인
 * - src\app\api\auth\signup\tests\route.existing-user.test.ts
 * - 이메일 발송 실패를 외부에 노출하지 않고 성공 계약 유지
 * - 응답 계약(success/code/data) 유지
 *
 * 핵심 목적:
 * "신규 가입"과 "기존 계정 분기"를 테스트 책임상 분리한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { ROUTES } from "@/lib/constants/routes";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const upsertUserAgreementMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: upsertUserAgreementMock,
}));
// 기존 인증/미인증 계정 분기 판단에 사용하는 기존 유저 조회 mock
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetEligibilityStore();
});

describe("회원가입 - 기존 미인증 사용자 재요청 분기", () => {
  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: {
      termsOfService: true as const,
      privacyPolicyAcknowledged: true as const,
      age14OrOlder: true as const,
    },
  };

  // 기존 미인증 계정: 이메일은 존재하지만 아직 인증되지 않은 상태
  const unverifiedUser = {
    id: "unverified-user-id",
    email: "test@example.com",
    email_confirmed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
  });

  it("TC-01. 기존 미인증 사용자도 동일한 성공 응답을 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(json.data).toEqual({
      email: "test@example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
    });
  });

  it("TC-02. 기존 인증 사용자 분기에서는 signup OTP 발송 함수가 1회 호출된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
  });

  it("TC-03. 기존 미인증 사용자 분기에서는 signup OTP 발송 함수가 1회 호출된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
  });

  it("TC-03A. 기존 미인증 사용자도 약관 동의 기록을 저장한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(upsertUserAgreementMock).toHaveBeenCalledWith(
      "unverified-user-id",
      "email",
    );
  });

  it("TC-04. 기존 미인증 사용자 메일 발송 실패도 외부 계약은 성공으로 유지된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
    vi.mocked(issueOtpAndSendEmail).mockRejectedValueOnce(
      new Error("mail send failed"),
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
    });
  });

  it("TC-05. 기존 미인증 사용자의 auth email이 null이어도 요청 email로 signup OTP 발송을 시도한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "user-without-email-id",
      email: null,
      email_confirmed_at: null,
    } as never);

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: requestBody.email,
      purpose: "signup",
    });
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: requestBody.email,
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
    });
  });
});

describe("회원가입 - 기존 인증 사용자 재요청 분기", () => {
  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "tester",
    agreements: {
      termsOfService: true as const,
      privacyPolicyAcknowledged: true as const,
      age14OrOlder: true as const,
    },
  };

  // 기존 인증 계정: 이메일 인증이 완료된 기존 가입 상태
  const verifiedUser = {
    id: "user-123",
    email: "test@example.com",
    email_confirmed_at: "2026-03-29T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
  });

  it("TC-01. 기존 인증 사용자도 동일한 성공 응답을 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
    });
  });

  it("TC-03. 기존 인증 사용자 분기 응답은 API 계약 구조를 유지한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: AUTH_API_CODES.SIGNUP_SUCCESS,
      data: {
        email: "test@example.com",
        redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
      },
    });
    expect(body).not.toHaveProperty("errors");
    expect(body).not.toHaveProperty("error");
  });

  it("TC-03A. 기존 인증 사용자도 약관 동의 기록을 저장한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(upsertUserAgreementMock).toHaveBeenCalledWith("user-123", "email");
  });

  it("TC-04. 기존 인증 사용자 메일 발송 실패도 외부 계약은 성공으로 유지된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
    vi.mocked(issueOtpAndSendEmail).mockRejectedValueOnce(
      new Error("mail send failed"),
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("test@example.com")}`,
    });
  });
});
