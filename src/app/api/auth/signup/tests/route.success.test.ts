/**
 * 회원가입 API의 신규 사용자 기본 성공 흐름 전용 테스트.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { ROUTES } from "@/lib/constants/routes";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const recordCurrentLegalAcceptancesMock = vi.hoisted(() => vi.fn());
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
  recordCurrentLegalAcceptances: recordCurrentLegalAcceptancesMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: createOtpIssueClientMock,
}));
vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));

describe("회원가입 API 신규 사용자 기본 성공 흐름 검증", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserByEmail).mockResolvedValue(null);
    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    recordCurrentLegalAcceptancesMock.mockResolvedValue(undefined);
    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementation(
      async (input) => {
        if (input.purpose === "signup" && input.signupMode === "new-user") {
          await input.beforeDelivery?.({ userId: "new-user-id" });
        }

        return { ok: true };
      },
    );
  });

  it("TC-01: 신규 이메일은 별도 createUser 없이 new-user Signup OTP Issue 경로로 처리된다", async () => {
    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(issueOtpAndSendEmailWithResult).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "signup",
        signupMode: "new-user",
      }),
      otpIssueClient,
    );
  });

  it("TC-02: raw email, password, nickname, canonical_email을 new-user Provider 입력으로 전달한다", async () => {
    await POST(makeRequest(requestBody));

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
        beforeDelivery: expect.any(Function),
      }),
      otpIssueClient,
    );
  });

  it("TC-03: 신규 사용자 Provider가 반환한 userId로 약관 동의를 저장한다", async () => {
    await POST(makeRequest(requestBody));

    expect(recordCurrentLegalAcceptancesMock).toHaveBeenCalledTimes(1);
    expect(recordCurrentLegalAcceptancesMock).toHaveBeenCalledWith(
      "new-user-id",
      "email",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("TC-04: 사용자 조회 identity에는 canonical email을 사용한다", async () => {
    await POST(makeRequest(requestBody));

    expect(getUserByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("TC-05: 성공한 OTP Issue만 successful quota를 기록하고 마지막에 in-flight를 release한다", async () => {
    await POST(makeRequest(requestBody));

    expect(otpIssueRateLimitMock.recordSuccessfulIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "test@example.com",
    });
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "test@example.com",
    });

    const recordOrder =
      otpIssueRateLimitMock.recordSuccessfulIssue.mock.invocationCallOrder[0]!;
    const releaseOrder =
      otpIssueRateLimitMock.releaseIssue.mock.invocationCallOrder[0]!;
    expect(recordOrder).toBeLessThan(releaseOrder);
  });

  it("TC-06: API는 200 OK와 SIGNUP_SUCCESS를 반환한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
  });

  it("TC-07: 성공 응답은 사용자 입력 raw email과 redirectTo만 포함한다", async () => {
    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data).toEqual({
      email: "Test@Example.com",
      redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("Test@Example.com")}`,
    });
  });
});
