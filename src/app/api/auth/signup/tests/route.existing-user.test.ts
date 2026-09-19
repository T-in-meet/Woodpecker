/**
 * 기존 계정 재요청 분기 전용 테스트.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { ROUTES } from "@/lib/constants/routes";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const ensureUserAgreementMock = vi.hoisted(() => vi.fn());
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const createOtpIssueClientMock = vi.hoisted(() => vi.fn(() => otpIssueClient));
const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(() => ({ allowed: true })),
  },
}));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: ensureUserAgreementMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: createOtpIssueClientMock,
}));
vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
  ensureUserAgreementMock.mockResolvedValue(undefined);
  vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });
});

describe("회원가입 - 기존 사용자 재요청 분기", () => {
  it.each([
    ["미인증", unverifiedUser],
    ["인증 완료", verifiedUser],
  ] as const)(
    "기존 %s 사용자도 동일한 SIGNUP_SUCCESS 응답을 반환한다",
    async (_label, existingUser) => {
      vi.mocked(getUserByEmail).mockResolvedValue(existingUser as never);

      const response = await POST(makeRequest(requestBody));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(body.data).toEqual({
        email: requestBody.email,
        redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent(requestBody.email)}`,
      });
      expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          purpose: "signup",
          signupMode: "existing-user",
        }),
        otpIssueClient,
      );
    },
  );

  it("기존 미인증 사용자는 beforeDelivery에서 기존 user id로 agreement를 복구한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (
          input.purpose === "signup" &&
          input.signupMode === "existing-user"
        ) {
          await input.beforeDelivery?.();
        }

        return { ok: true };
      },
    );

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
    expect(ensureUserAgreementMock).toHaveBeenCalledTimes(1);
    expect(ensureUserAgreementMock).toHaveBeenCalledWith(
      "unverified-user-id",
      "email",
    );
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        signupMode: "existing-user",
        beforeDelivery: expect.any(Function),
      }),
      otpIssueClient,
    );
  });

  it("기존 인증 완료 사용자에게는 agreement persistence를 새로 확대하지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (
          input.purpose === "signup" &&
          input.signupMode === "existing-user"
        ) {
          await input.beforeDelivery?.();
        }

        return { ok: true };
      },
    );

    await POST(makeRequest(requestBody));

    expect(ensureUserAgreementMock).not.toHaveBeenCalled();

    const issueInput = vi.mocked(issueOtpAndSendEmailWithResult).mock
      .calls[0]?.[0];
    expect(issueInput).toEqual({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
    });
  });

  it("기존 미인증 사용자의 auth email이 null이면 요청 email로 OTP Issue를 시도한다", async () => {
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
        signupMode: "existing-user",
        beforeDelivery: expect.any(Function),
      }),
      otpIssueClient,
    );
  });

  it("기존 미인증 agreement 복구 실패는 SIGNUP_INTERNAL_ERROR가 되고 in-flight를 release한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
    ensureUserAgreementMock.mockRejectedValueOnce(
      new Error("agreement failed"),
    );
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementationOnce(
      async (input) => {
        if (
          input.purpose === "signup" &&
          input.signupMode === "existing-user"
        ) {
          await input.beforeDelivery?.();
        }

        return { ok: true };
      },
    );

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "test@example.com",
    });
  });
});
