import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  type IssueOtpAndSendEmailResult,
  issueOtpAndSendEmailWithResult,
} from "@/features/auth/email/issueOtpAndSendEmail";
import {
  getUserByEmail,
  GetUserByEmailError,
} from "@/features/auth/lib/getUserByEmail";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { ROUTES } from "@/lib/constants/routes";

import { POST } from "../route";

const recordCurrentLegalAcceptancesMock = vi.hoisted(() => vi.fn());
const otpIssueRateLimitMock = vi.hoisted(() => ({
  precheckIssue: vi.fn((): OtpIssueRateLimitStartResult => ({ allowed: true })),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
}));
const otpIssueClient = vi.hoisted(() => ({ client: "otp-issue-client" }));
const createOtpIssueClientMock = vi.hoisted(() => vi.fn(() => otpIssueClient));

vi.mock("@/features/auth/lib/userAgreements", () => ({
  recordCurrentLegalAcceptances: recordCurrentLegalAcceptancesMock,
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

vi.mock("@/features/auth/lib/getUserByEmail", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/getUserByEmail")
  >("@/features/auth/lib/getUserByEmail");

  return {
    ...actual,
    getUserByEmail: vi.fn(),
  };
});
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

const accountStates = [
  { label: "new-user", user: null },
  {
    label: "existing-unverified",
    user: {
      id: "existing-unverified-id",
      email: "user@example.com",
      email_confirmed_at: null,
    },
  },
  {
    label: "existing-verified",
    user: {
      id: "existing-verified-id",
      email: "user@example.com",
      email_confirmed_at: "2026-09-19T00:00:00.000Z",
    },
  },
] as const;

const maskedFailureKinds = [
  "provider_rate_limit",
  "provider_error",
  "invalid_provider_response",
  "delivery_error",
] as const;

const maskedFailureCases = accountStates.flatMap((accountState) =>
  maskedFailureKinds.map((kind) => ({ ...accountState, kind })),
);

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
    recordCurrentLegalAcceptancesMock.mockResolvedValue(undefined);
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

  it("Email attempt precheck 차단은 success-like로 응답하고 account lookup 전에 종료한다", async () => {
    otpIssueRateLimitMock.precheckIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_attempt",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
  });

  it("profiles lookup failure는 기존 SIGNUP_INTERNAL_ERROR를 유지하고 Provider lifecycle에 진입하지 않는다", async () => {
    vi.mocked(getUserByEmail).mockRejectedValueOnce(
      new GetUserByEmailError(
        "profile_lookup",
        new Error("profiles lookup failed"),
      ),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.precheckIssue).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("Auth Admin lookup failure는 success-like로 masking하고 Provider lifecycle에 진입하지 않는다", async () => {
    vi.mocked(getUserByEmail).mockRejectedValueOnce(
      new GetUserByEmailError(
        "auth_user_lookup",
        new Error("auth user lookup failed"),
      ),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: AUTH_API_CODES.SIGNUP_SUCCESS,
      data: {
        email: "user@example.com",
        redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("user@example.com")}`,
      },
    });
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.precheckIssue).toHaveBeenCalledTimes(1);
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("final Local Rate Limit 차단은 Provider operation 없이 success-like 응답을 반환한다", async () => {
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "ip_short",
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
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

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(getUserByEmail).toHaveBeenCalledWith("user@example.com");
    expect(createOtpIssueClientMock).toHaveBeenCalledTimes(1);
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("prepared client → tryStartIssue → Provider/Email → success 기록 → release 순서를 지킨다", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);

    const createClientOrder =
      createOtpIssueClientMock.mock.invocationCallOrder[0]!;
    const precheckOrder =
      otpIssueRateLimitMock.precheckIssue.mock.invocationCallOrder[0]!;
    const lookupOrder = vi.mocked(getUserByEmail).mock.invocationCallOrder[0]!;
    const tryStartOrder =
      otpIssueRateLimitMock.tryStartIssue.mock.invocationCallOrder[0]!;
    const issueOrder = vi.mocked(issueOtpAndSendEmailWithResult).mock
      .invocationCallOrder[0]!;
    const recordOrder =
      otpIssueRateLimitMock.recordSuccessfulIssue.mock.invocationCallOrder[0]!;
    const releaseOrder =
      otpIssueRateLimitMock.releaseIssue.mock.invocationCallOrder[0]!;

    expect(createClientOrder).toBeLessThan(precheckOrder);
    expect(precheckOrder).toBeLessThan(lookupOrder);
    expect(lookupOrder).toBeLessThan(tryStartOrder);
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

  it("OTP Issue helper의 unexpected rejection은 500을 유지하고 in-flight를 release한다", async () => {
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

  it.each(accountStates)(
    "$label account state에서 atomic tryStartIssue 차단은 동일 success-like 응답을 유지한다",
    async ({ user }) => {
      vi.mocked(getUserByEmail).mockResolvedValue(user as never);
      otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
        allowed: false,
        blockedBy: "ip_short",
      });

      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
      expect(
        otpIssueRateLimitMock.recordSuccessfulIssue,
      ).not.toHaveBeenCalled();
      expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
    },
  );

  it.each(maskedFailureCases)(
    "$label account state의 $kind failure는 동일 success-like 응답으로 masking한다",
    async ({ user, kind }) => {
      vi.mocked(getUserByEmail).mockResolvedValue(user as never);
      vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce(
        makeIssueFailure(kind),
      );

      const response = await POST(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        success: true,
        code: AUTH_API_CODES.SIGNUP_SUCCESS,
        data: {
          email: "user@example.com",
          redirectTo: `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("user@example.com")}`,
        },
      });
      expect(
        otpIssueRateLimitMock.recordSuccessfulIssue,
      ).not.toHaveBeenCalled();
      expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
        purpose: "signup",
        canonicalEmail: "user@example.com",
      });
    },
  );

  it("createOtpIssueClient 실패는 precheck/account lookup 전 common 500으로 종료한다", async () => {
    createOtpIssueClientMock.mockImplementationOnce(() => {
      throw new Error("otp issue client failed");
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(otpIssueRateLimitMock.precheckIssue).not.toHaveBeenCalled();
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.tryStartIssue).not.toHaveBeenCalled();
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).not.toHaveBeenCalled();
  });

  it("정상/precheck blocked/final blocked success-like 응답은 API-controlled content-type을 동일하게 유지한다", async () => {
    const successResponse = await POST(makeRequest());

    otpIssueRateLimitMock.precheckIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "email_attempt",
    });
    const precheckBlockedResponse = await POST(makeRequest());

    otpIssueRateLimitMock.precheckIssue.mockReturnValue({ allowed: true });
    otpIssueRateLimitMock.tryStartIssue.mockReturnValueOnce({
      allowed: false,
      blockedBy: "cooldown",
    });
    const finalBlockedResponse = await POST(makeRequest());

    const successContentType = successResponse.headers.get("content-type");

    expect(successContentType).toBeTruthy();
    expect(precheckBlockedResponse.headers.get("content-type")).toBe(
      successContentType,
    );
    expect(finalBlockedResponse.headers.get("content-type")).toBe(
      successContentType,
    );
  });
});
