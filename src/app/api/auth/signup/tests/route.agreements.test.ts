/**
 * 회원가입 API 약관 동의 검증 전용 테스트
 *
 * 이 파일은 agreements 필드의 구조와 값만 검증한다.
 * - termsOfService / privacyPolicy가 false인 경우 NOT_AGREED
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
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { createClient } from "@/lib/supabase/server";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-03 회원가입 약관 동의 검증", () => {
  const mockSignUp = vi.fn();
  // 약관만 바꿔가며 테스트하기 위한 기준 payload
  const BASE_VALID_PAYLOAD = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: {
      termsOfService: true,
      privacyPolicy: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
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
        agreements: { termsOfService: false, privacyPolicy: true },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.NOT_AGREED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-02: privacyPolicy = false
  it("TC-02. privacyPolicy가 false이면 NOT_AGREED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: true, privacyPolicy: false },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicy",
      VALIDATION_REASON.NOT_AGREED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-03: both false
  it("TC-03. termsOfService와 privacyPolicy 모두 false이면 두 필드 모두 NOT_AGREED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: false, privacyPolicy: false },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "agreements.termsOfService",
          reason: VALIDATION_REASON.NOT_AGREED,
        }),
        expect.objectContaining({
          field: "agreements.privacyPolicy",
          reason: VALIDATION_REASON.NOT_AGREED,
        }),
      ]),
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-04: termsOfService missing
  it("TC-04. termsOfService가 누락되면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { privacyPolicy: true },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-05: privacyPolicy missing
  it("TC-05. privacyPolicy가 누락되면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: true },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicy",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-08: termsOfService null
  it("TC-08. termsOfService가 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: null, privacyPolicy: true },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.termsOfService",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-09: privacyPolicy null
  it("TC-09. privacyPolicy가 null이면 REQUIRED 오류를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        ...BASE_VALID_PAYLOAD,
        agreements: { termsOfService: true, privacyPolicy: null },
      }),
    );

    await expectAgreementFailure(
      response,
      "agreements.privacyPolicy",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-11: both true
  it("TC-11. agreements가 모두 true이면 회원가입이 성공한다", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });

    const response = await POST(makeRequest(BASE_VALID_PAYLOAD));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});
