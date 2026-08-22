/**
 * 회원가입 API 약관 동의 검증 전용 테스트
 *
 * 이 파일은 agreements 필드의 구조와 값만 검증한다.
 * - 이용약관 동의, 처리방침 확인, 연령 확인이 false인 경우 NOT_AGREED
 * - agreements 또는 하위 필드 누락 시 REQUIRED
 * - null 입력 시 REQUIRED
 * - 잘못된 타입 입력 시 INVALID_TYPE
 * - 두 약관이 모두 true일 때 정상 가입 성공
 *
 * 핵심 목적:
 * "약관 동의 검증 책임"을 일반 입력 validation과 분리해 읽기 쉽게 유지한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

const upsertUserAgreementMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  ensureUserAgreement: upsertUserAgreementMock,
}));
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/lib/supabase/admin");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetEligibilityStore();
});

describe("PR-API-03 회원가입 약관 동의 검증", () => {
  const mockCreateUser = vi.fn();

  // 약관만 바꿔가며 테스트하기 위한 기준 payload
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

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: { createUser: mockCreateUser },
      },
    } as never);
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "user-id", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
  });

  // 약관 실패 케이스마다 동일한 실패 계약을 검증하는 helper
  async function expectAgreementFailure(
    response: Response,
    field: string,
    reason: string,
  ) {
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field, reason })]),
    );
  }

  // TC-01: termsOfService = false
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-02: privacyPolicyAcknowledged = false
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-04: termsOfService missing
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-05: privacyPolicyAcknowledged missing
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-06: agreements missing
  it("TC-06. agreements 필드 자체가 누락되면 REQUIRED 오류를 반환한다", async () => {
    const { agreements: _, ...withoutAgreements } = BASE_VALID_PAYLOAD;
    const response = await POST(makeRequest(withoutAgreements));

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-07: agreements null
  it("TC-07. agreements가 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({ ...BASE_VALID_PAYLOAD, agreements: null }),
    );

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-08: termsOfService null
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-09: privacyPolicyAcknowledged null
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
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-10: agreements invalid type
  it("TC-10. agreements가 string이면 INVALID_TYPE 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({ ...BASE_VALID_PAYLOAD, agreements: "yes" }),
    );

    await expectAgreementFailure(
      response,
      "agreements",
      VALIDATION_REASON.INVALID_TYPE,
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(vi.mocked(issueOtpAndSendEmail)).not.toHaveBeenCalled();
  });

  // TC-11: both true
  it("TC-11. agreements가 모두 true이면 회원가입이 성공한다", async () => {
    const response = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
      email: "test@example.com",
      purpose: "signup",
    });
    expect(upsertUserAgreementMock).toHaveBeenCalledTimes(1);
    expect(upsertUserAgreementMock).toHaveBeenCalledWith("user-id", "email");
  });

  it("TC-12. 사용자 생성에 실패하면 약관 동의를 기록하지 않는다", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("create user failed"),
    });

    await POST(makeRequest(BASE_VALID_PAYLOAD));

    expect(upsertUserAgreementMock).not.toHaveBeenCalled();
  });
});
