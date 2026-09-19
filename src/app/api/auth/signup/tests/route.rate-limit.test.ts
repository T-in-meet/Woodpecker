import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  type IssueOtpAndSendEmailResult,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";

import { POST } from "../route";

const ensureUserAgreementMock = vi.hoisted(() => vi.fn());
const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const createOtpIssueClientMock = vi.hoisted(() => vi.fn(() => otpIssueClient));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: ensureUserAgreementMock,
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: otpIssueRateLimitMock,
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: createOtpIssueClientMock,
}));

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");

function makeRequest(
  email = "user@example.com",
  ip = "203.0.113.10",
): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      email,
      password: "Password123!",
      nickname: "tester",
      agreements: {
        termsOfService: true,
        privacyPolicyAcknowledged: true,
        age14OrOlder: true,
      },
    }),
  });
}

function makeIssueFailure(
  kind:
    | "provider_rate_limit"
    | "provider_error"
    | "invalid_provider_response"
    | "delivery_error",
): IssueOtpAndSendEmailResult {
  return {
    ok: false,
    kind,
    diagnostic: {
      errorMessage: `${kind} message`,
      errorName: "TestError",
      errorCode: "test_code",
    },
  };
}

describe("Signup Route OTP Issue Rate Limit 연결", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });

    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "user@example.com",
      email_confirmed_at: null,
    } as never);

    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValue({ ok: true });
    ensureUserAgreementMock.mockResolvedValue(undefined);
  });

  it("Auth Global 차단은 malformed body보다 먼저 429로 종료하고 downstream에 진입하지 않는다", async () => {
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: false,
      blockedBy: "ip_short",
    });

    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: "{malformed",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(otpIssueRateLimitMock.precheckIssue).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createOtpIssueClientMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("Email attempt precheck 차단은 account lookup 전에 429로 종료하고 downstream에 진입하지 않는다", async () => {
    otpIssueRateLimitMock.precheckIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_attempt",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createOtpIssueClientMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
  });

  it("Local Rate Limit 차단 시 Provider operation을 시작하지 않고 429를 반환한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("신규 사용자 Local Rate Limit 차단 시 사용자 생성 Provider와 agreement side effect에 도달하지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_success",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(getUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("prepared client → tryStartIssue → Provider/Email → success 기록 → release 순서를 지킨다", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    const createClientOrder =
      createOtpIssueClientMock.mock.invocationCallOrder[0]!;
    const tryStartOrder =
      otpIssueRateLimitMock.tryStartIssue.mock.invocationCallOrder[0]!;
    const issueOrder = vi.mocked(issueOtpAndSendEmailWithResult).mock
      .invocationCallOrder[0]!;
    const recordOrder =
      otpIssueRateLimitMock.recordSuccessfulIssue.mock.invocationCallOrder[0]!;
    const releaseOrder =
      otpIssueRateLimitMock.releaseIssue.mock.invocationCallOrder[0]!;

    expect(createClientOrder).toBeLessThan(tryStartOrder);
    expect(tryStartOrder).toBeLessThan(issueOrder);
    expect(issueOrder).toBeLessThan(recordOrder);
    expect(recordOrder).toBeLessThan(releaseOrder);

    expect(otpIssueRateLimitMock.tryStartIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
      ip: "203.0.113.10",
    });
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        purpose: "signup",
        signupMode: "existing-user",
        beforeDelivery: expect.any(Function),
      }),
      otpIssueClient,
    );
  });

  it("OTP Issue typed failure 시 successful quota를 기록하지 않고 in-flight만 release한다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
      makeIssueFailure("provider_error"),
    );

    await POST(makeRequest());

    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
    });
  });

  it("beforeDelivery 같은 caller-specific rejection도 successful quota 없이 in-flight를 release한다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockRejectedValueOnce(
      new Error("agreement failed"),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "user@example.com",
    });
  });

  it("Provider 429는 Local Rate Limit과 같은 Signup 429 외부 계약으로 매핑한다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
      makeIssueFailure("provider_rate_limit"),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledTimes(1);
  });

  it.each(["provider_error", "invalid_provider_response"] as const)(
    "%s는 SIGNUP_INTERNAL_ERROR로 매핑한다",
    async (kind) => {
      vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
        makeIssueFailure(kind),
      );

      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
      expect(
        otpIssueRateLimitMock.recordSuccessfulIssue,
      ).not.toHaveBeenCalled();
      expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledTimes(1);
    },
  );

  it("delivery_error는 전용 Signup delivery code와 일반화된 메시지로 매핑한다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
      makeIssueFailure("delivery_error"),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_EMAIL_DELIVERY_INTERNAL_ERROR);
    expect(body.message).toBe(
      "인증 이메일을 전송하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledTimes(1);
  });
});
