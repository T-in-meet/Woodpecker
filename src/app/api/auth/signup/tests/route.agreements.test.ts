/**
 * 회원가입 API 약관 동의 검증 및 persistence 전용 테스트.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmailWithResult } from "@/features/auth/email/issueOtpAndSendEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import type { OtpIssueRateLimitStartResult } from "@/features/auth/lib/rate-limit/otpIssueRateLimit";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

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

const BASE_VALID_PAYLOAD = {
  email: "test@example.com",
  password: "Password123!",
  nickname: "테스터",
  agreements: {
    termsOfService: true,
    privacyPolicyAcknowledged: true,
    age14OrOlder: true,
  },
};

async function expectAgreementFailure(
  response: Response,
  field: string,
  reason: string,
): Promise<void> {
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.success).toBe(false);
  expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
  expect(body.data.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ field, reason })]),
  );
}

describe("PR-API-03 회원가입 약관 동의 검증", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserByEmail).mockResolvedValue(null);
    otpIssueRateLimitMock.tryStartIssue.mockReturnValue({ allowed: true });
    ensureUserAgreementMock.mockResolvedValue(undefined);

    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementation(
      async (input) => {
        if (input.purpose === "signup" && input.signupMode === "new-user") {
          await input.beforeDelivery?.({ userId: "user-id" });
        }

        return { ok: true };
      },
    );
  });

  it("TC-01. termsOfService가 false이면 NOT_AGREED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          termsOfService: false,
          privacyPolicyAcknowledged: true,
          age14OrOlder: true,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.NOT_AGREED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
  });

  it("TC-02. 처리방침 확인이 false이면 NOT_AGREED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          termsOfService: true,
          privacyPolicyAcknowledged: false,
          age14OrOlder: true,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicyAcknowledged",
      VALIDATION_REASON.NOT_AGREED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
  });

  it("TC-03. 연령 확인이 false이면 NOT_AGREED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          termsOfService: true,
          privacyPolicyAcknowledged: true,
          age14OrOlder: false,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.age14OrOlder",
      VALIDATION_REASON.NOT_AGREED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
  });

  it("TC-04. termsOfService가 누락되면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          privacyPolicyAcknowledged: true,
          age14OrOlder: true,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-05. 처리방침 확인이 누락되면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: true, age14OrOlder: true },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicyAcknowledged",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-06. agreements 필드 자체가 누락되면 REQUIRED 오류를 반환한다", async () => {
    const { agreements: _, ...withoutAgreements } = BASE_VALID_PAYLOAD;
    const response = await POST(makeRequest(withoutAgreements));

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-07. agreements가 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({ ...BASE_VALID_PAYLOAD, agreements: null }),
    );

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-08. termsOfService가 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          termsOfService: null,
          privacyPolicyAcknowledged: true,
          age14OrOlder: true,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-09. 처리방침 확인이 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: {
          termsOfService: true,
          privacyPolicyAcknowledged: null,
          age14OrOlder: true,
        },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicyAcknowledged",
      VALIDATION_REASON.REQUIRED,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-10. agreements가 string이면 INVALID_TYPE 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({ ...BASE_VALID_PAYLOAD, agreements: "yes" }),
    );

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.INVALID_TYPE,
    );
    expect(issueOtpAndSendEmailWithResult).not.toHaveBeenCalled();
  });

  it("TC-11. agreements가 모두 true이면 신규 Signup의 beforeDelivery에서 약관 동의를 저장한다", async () => {
    const response = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(vi.mocked(issueOtpAndSendEmailWithResult)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
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
    expect(ensureUserAgreementMock).toHaveBeenCalledTimes(1);
    expect(ensureUserAgreementMock).toHaveBeenCalledWith("user-id", "email");
  });

  it("TC-12. Provider/OTP 단계에서 실패하면 약관 동의를 기록하지 않는다", async () => {
    vi.mocked(issueOtpAndSendEmailWithResult).mockResolvedValueOnce({
      ok: false,
      kind: "provider_error",
      diagnostic: {
        errorMessage: "provider failed",
        errorName: "ProviderError",
      },
    });

    await POST(makeRequest(BASE_VALID_PAYLOAD));

    expect(ensureUserAgreementMock).not.toHaveBeenCalled();
  });

  it("TC-13. agreement persistence 실패는 SIGNUP_INTERNAL_ERROR가 되고 successful quota 없이 release한다", async () => {
    ensureUserAgreementMock.mockRejectedValueOnce(
      new Error("agreement failed"),
    );

    const response = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(ensureUserAgreementMock).toHaveBeenCalledWith("user-id", "email");
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledWith({
      purpose: "signup",
      canonicalEmail: "test@example.com",
    });
  });

  it("TC-14. 신규 Signup agreement 실패 후 재시도하면 existing-unverified 분기에서 동일 user id agreement를 복구한다", async () => {
    const recoveryUser = {
      id: "recovery-user-id",
      email: "test@example.com",
      email_confirmed_at: null,
    };

    // 첫 요청은 신규 사용자, 다음 허용된 재시도는 생성된 미인증 사용자로 조회된다.
    vi.mocked(getUserByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(recoveryUser as never);

    // 첫 beforeDelivery에서만 agreement persistence가 실패한다.
    ensureUserAgreementMock.mockRejectedValueOnce(
      new Error("agreement failed"),
    );

    vi.mocked(issueOtpAndSendEmailWithResult).mockImplementation(
      async (input) => {
        if (input.purpose !== "signup") {
          return { ok: true };
        }

        if (input.signupMode === "new-user") {
          await input.beforeDelivery?.({ userId: "recovery-user-id" });
        } else {
          await input.beforeDelivery?.();
        }

        return { ok: true };
      },
    );

    const firstResponse = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(500);
    expect(firstBody.code).toBe(AUTH_API_CODES.SIGNUP_INTERNAL_ERROR);
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).not.toHaveBeenCalled();
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledTimes(1);

    // 이 테스트는 agreement recovery를 격리하므로 limiter는 허용 상태로 mock한다.
    // cooldown/IP lifecycle 자체는 route.rate-limit.test.ts에서 별도로 검증한다.
    const secondResponse = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

    const issueCalls = vi.mocked(issueOtpAndSendEmailWithResult).mock.calls;
    expect(issueCalls).toHaveLength(2);
    expect(issueCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        purpose: "signup",
        signupMode: "new-user",
      }),
    );
    expect(issueCalls[1]?.[0]).toEqual(
      expect.objectContaining({
        purpose: "signup",
        signupMode: "existing-user",
        beforeDelivery: expect.any(Function),
      }),
    );

    expect(ensureUserAgreementMock).toHaveBeenCalledTimes(2);
    expect(ensureUserAgreementMock).toHaveBeenNthCalledWith(
      1,
      "recovery-user-id",
      "email",
    );
    expect(ensureUserAgreementMock).toHaveBeenNthCalledWith(
      2,
      "recovery-user-id",
      "email",
    );
    expect(otpIssueRateLimitMock.recordSuccessfulIssue).toHaveBeenCalledTimes(
      1,
    );
    expect(otpIssueRateLimitMock.releaseIssue).toHaveBeenCalledTimes(2);
  });
});
