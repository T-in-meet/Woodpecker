/**
 * 회원가입 API - OTP 이메일 발송 분기 테스트
 *
 * 정책:
 * - 신규 / 기존 미인증 / 기존 인증 사용자는 동일 OTP Issue 결과에 동일 외부 계약을 사용한다.
 * - delivery_error는 계정 상태와 무관하게 전용 일반화 오류를 반환한다.
 * - 기존 사용자는 새 계정을 만들지 않고 저장된 auth email로 OTP를 발송한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { AUTH_EMAIL_DELIVERY_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import {
  type IssueOtpAndSendEmailResult,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const upsertUserAgreementMock = vi.hoisted(() => vi.fn());
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const createOtpIssueClientMock = vi.hoisted(() => vi.fn(() => otpIssueClient));
const otpIssueRateLimitMock = vi.hoisted(() => ({
  tryStartIssue: vi.fn(() => ({ allowed: true as const })),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: upsertUserAgreementMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: createOtpIssueClientMock,
}));
vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

const requestBody = {
  email: "Test@Example.com",
  password: "Password123!",
  nickname: "테스터",
  agreements: {
    termsOfService: true as const,
    privacyPolicyAcknowledged: true as const,
    age14OrOlder: true as const,
  },
};

const unverifiedUser = {
  id: "unverified-user-id",
  email: "test@example.com",
  email_confirmed_at: null,
};

const verifiedUser = {
  id: "verified-user-id",
  email: "test@example.com",
  email_confirmed_at: "2026-03-29T00:00:00.000Z",
};

/**
 * Email delivery 실패 result fixture를 생성한다.
 */
function makeDeliveryFailure(): IssueOtpAndSendEmailResult {
  return {
    ok: false,
    kind: "delivery_error",
    diagnostic: {
      errorMessage: "SMTP failed",
      errorName: "Error",
      errorCode: "smtp_failed",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });

  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });

  upsertUserAgreementMock.mockResolvedValue(undefined);
});

describe("회원가입 이메일 발송 - 신규 사용자", () => {
  it("신규 사용자 분기에서 new-user signup OTP Issue가 실행된다", async () => {
    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "Test@Example.com",
        purpose: "signup",
        signupMode: "new-user",
        password: "Password123!",
        metadata: {
          nickname: "테스터",
          canonical_email: "test@example.com",
        },
      }),
      otpIssueClient,
    );
  });

  it("신규 사용자 OTP Issue에는 validation 이후 raw email을 전달한다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "Test@Example.com",
        purpose: "signup",
      }),
      otpIssueClient,
    );
  });

  it("신규 사용자 Provider 실패는 SIGNUP_INTERNAL_ERROR를 유지한다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
      ok: false,
      kind: "provider_error",
      diagnostic: {
        errorMessage: "signup provider failed",
        errorName: "AuthApiError",
        errorCode: "internal_error",
      },
    });

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledTimes(1);
  });
});

describe("회원가입 이메일 발송 - 기존 사용자", () => {
  it.each([
    ["미인증", unverifiedUser],
    ["인증 완료", verifiedUser],
  ] as const)(
    "기존 %s 사용자는 저장된 auth email로 existing-user OTP Issue를 실행한다",
    async (_label, existingUser) => {
      vi.mocked(getUserByEmail).mockResolvedValue(existingUser as never);

      const response = await POST(makeRequest(requestBody));

      expect(response.status).toBe(200);
      expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          purpose: "signup",
        }),
        otpIssueClient,
      );
    },
  );

  it("기존 사용자의 auth email이 null이면 요청 email로 OTP Issue를 실행한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "user-without-email-id",
      email: null,
      email_confirmed_at: null,
    } as never);

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: requestBody.email,
        purpose: "signup",
      }),
      otpIssueClient,
    );
  });
});

describe("회원가입 이메일 발송 - delivery_error 외부 계약", () => {
  it.each([
    ["신규", null],
    ["기존 미인증", unverifiedUser],
    ["기존 인증", verifiedUser],
  ] as const)(
    "%s 사용자의 delivery_error는 동일한 전용 실패 응답을 반환한다",
    async (_label, existingUser) => {
      vi.mocked(getUserByEmail).mockResolvedValue(existingUser as never);
      vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
        makeDeliveryFailure(),
      );

      const response = await POST(makeRequest(requestBody));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.code).toBe(
        AUTH_API_CODES.SIGNUP_EMAIL_DELIVERY_INTERNAL_ERROR,
      );
      expect(body.message).toBe(AUTH_EMAIL_DELIVERY_ERROR_MESSAGE);
    },
  );
});
