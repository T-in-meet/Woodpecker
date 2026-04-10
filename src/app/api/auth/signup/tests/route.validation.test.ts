/**
 * 회원가입 API 입력 검증 전용 테스트
 *
 * 이 파일은 payload 자체의 유효성만 검증한다.
 * - 필수값 누락
 * - null 입력
 * - 빈 문자열 / trim 후 공백
 * - 이메일 형식
 * - 비밀번호 최소 길이
 * - 닉네임 최대/최소 길이
 * - 이메일/닉네임 trim 정규화
 * - 비밀번호 원본 유지
 * - validation 실패 응답 계약
 * - validation 실패 시 외부 호출 차단
 * - 다중 오류 수집
 *
 * 제외:
 * - 약관 전용 세부 분기
 * - 기존 계정 분기
 * - rate limit
 * - avatar 업로드
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/lib/supabase/admin");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetEligibilityStore();
});

describe("PR-API-02 회원가입 입력 검증 - 필수값 검증", () => {
  const mockGenerateLink = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
    } as never);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
  });

  // validation 실패 응답 계약을 공통 검증하는 helper
  async function expectValidationFailure(
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

  // TC-01 ~ TC-03: 필드 누락
  it("TC-01. 이메일 필드 누락 시 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({ password: "Password123!", nickname: "테스터" }),
    );

    await expectValidationFailure(
      response,
      "email",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-02. 비밀번호 필드 누락 시 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({ email: "test@example.com", nickname: "테스터" }),
    );

    await expectValidationFailure(
      response,
      "password",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-03. 닉네임 필드 누락 시 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({ email: "test@example.com", password: "Password123!" }),
    );

    await expectValidationFailure(
      response,
      "nickname",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  // TC-04 ~ TC-06: null 입력
  it("TC-04. 이메일이 null이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: null,
        password: "Password123!",
        nickname: "테스터",
      }),
    );

    await expectValidationFailure(
      response,
      "email",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-05. 비밀번호가 null이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: null,
        nickname: "테스터",
      }),
    );

    await expectValidationFailure(
      response,
      "password",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-06. 닉네임이 null이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: null,
      }),
    );

    await expectValidationFailure(
      response,
      "nickname",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  // TC-07 ~ TC-09: 빈값 / 공백 입력
  it("TC-07. trim 후 이메일이 빈 문자열이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "   ",
        password: "Password123!",
        nickname: "테스터",
      }),
    );

    await expectValidationFailure(
      response,
      "email",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-08. 비밀번호가 빈 문자열이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "",
        nickname: "테스터",
      }),
    );

    await expectValidationFailure(
      response,
      "password",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-09. trim 후 닉네임이 빈 문자열이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: "   ",
      }),
    );

    await expectValidationFailure(
      response,
      "nickname",
      VALIDATION_REASON.REQUIRED,
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });
});

describe("PR-API-02 회원가입 입력 검증 - 형식 / 길이 / 경계값 / 정규화", () => {
  const mockGenerateLink = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
    } as never);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
  });

  // 정상 케이스가 필요한 형식/경계값 테스트에서 재사용하는 generateLink 성공 mock
  function mockGenerateLinkSuccess(email = "test@example.com") {
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
  }

  // TC-10: 형식 검증
  it("TC-10. trim 후 이메일 형식이 올바르지 않으면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "  invalid-email  ",
        password: "Password123!",
        nickname: "테스터",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "email",
          reason: VALIDATION_REASON.INVALID_FORMAT,
        }),
      ]),
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  // TC-11: 형식 검증 (성공)
  it("TC-11. 앞뒤 공백이 있는 정상 이메일은 trim 후 성공 처리된다", async () => {
    mockGenerateLinkSuccess();

    const response = await POST(
      makeRequest({
        email: "  test@example.com  ",
        password: "Password123!",
        nickname: "테스터",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );
    const body = await response.json();

    expect(response.status).not.toBe(400);
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
    if (body.data?.email !== undefined) {
      expect(body.data.email).toBe("test@example.com");
    }
  });

  // TC-12: 비밀번호 최소 길이 검증
  it(`TC-12. 비밀번호가 최소 길이(${PASSWORD_MIN_LENGTH}자) 미만이면 validation 실패를 반환한다`, async () => {
    const shortPassword = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: shortPassword,
        nickname: "테스터",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "password",
          reason: VALIDATION_REASON.TOO_SHORT,
        }),
      ]),
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  // TC-13: 길이 검증
  it("TC-13. trim 후 닉네임 최대 길이 초과이면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: " 가나다라마바사아자차카 ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "nickname",
          reason: VALIDATION_REASON.TOO_LONG,
        }),
      ]),
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  // TC-14: 경계값 검증 (min)
  it("TC-14. trim 후 닉네임 최소 길이 값은 성공 처리된다", async () => {
    mockGenerateLinkSuccess();

    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: " 가 ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(response.status).not.toBe(400);
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "가" }),
        }),
      }),
    );
  });

  // TC-15: 경계값 검증 (max)
  it("TC-15. trim 후 닉네임 최대 길이 값은 성공 처리된다", async () => {
    mockGenerateLinkSuccess();

    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: " 가나다라마바사아자차 ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(response.status).not.toBe(400);
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "가나다라마바사아자차" }),
        }),
      }),
    );
  });

  // TC-16 ~ TC-18: 정규화 검증
  it("TC-16. 앞뒤 공백이 있는 이메일은 trim된 값으로 처리된다", async () => {
    mockGenerateLinkSuccess();

    await POST(
      makeRequest({
        email: "  test@example.com  ",
        password: "Password123!",
        nickname: "테스터",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("TC-17. 앞뒤 공백이 있는 닉네임은 trim된 값으로 처리된다", async () => {
    mockGenerateLinkSuccess();

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: "  테스터  ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "테스터" }),
        }),
      }),
    );
  });

  it("TC-18. 비밀번호는 원본 값이 유지된다", async () => {
    mockGenerateLinkSuccess();

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "  Password123!  ",
        nickname: "테스터",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ password: "  Password123!  " }),
    );
  });
});

describe("PR-API-02 회원가입 입력 검증 - 실패 응답 계약 / 외부 호출 차단 / 다중 오류 수집", () => {
  const mockGenerateLink = vi.fn();
  const mockStorageUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
      storage: { from: vi.fn(() => ({ upload: mockStorageUpload })) },
    } as never);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
  });

  // TC-19 ~ TC-22: 실패 응답 계약 검증
  it("TC-19. validation 실패 시 정의된 실패 응답 구조를 반환한다", async () => {
    const response = await POST(
      makeRequest({ email: " ", password: "Password123!", nickname: "테스터" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(body.data).toBeDefined();
    expect(body.data.errors).toBeDefined();
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
  });

  it("TC-20. validation 실패 시 상태 코드가 계약과 일치한다", async () => {
    const response = await POST(
      makeRequest({
        email: "invalid-email",
        password: "Password123!",
        nickname: "테스터",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("TC-21. validation 실패 시 success, code, message가 계약과 일치한다", async () => {
    const response = await POST(
      makeRequest({
        email: "invalid-email",
        password: "Password123!",
        nickname: "테스터",
      }),
    );
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    if (body.message !== undefined) {
      expect(typeof body.message).toBe("string");
    }
  });

  it("TC-22. validation 실패 시 data.errors[].field, data.errors[].reason 구조가 계약과 일치한다", async () => {
    const response = await POST(
      makeRequest({
        email: "invalid-email",
        password: "Password123!",
        nickname: "테스터",
      }),
    );
    const body = await response.json();

    expect(Array.isArray(body.data.errors)).toBe(true);
    expect(body.data.errors.length).toBeGreaterThanOrEqual(1);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "email",
          reason: VALIDATION_REASON.INVALID_FORMAT,
        }),
      ]),
    );
    body.data.errors.forEach((item: unknown) => {
      expect(item).toMatchObject({
        field: expect.any(String),
        reason: expect.any(String),
      });
    });
  });

  // TC-23 ~ TC-24: 외부 호출 차단
  it("TC-23. validation 실패 시 generateLink 호출이 0회여야 한다", async () => {
    await POST(
      makeRequest({ email: "", password: "Password123!", nickname: "테스터" }),
    );

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });

  it("TC-24. validation 실패 시 모든 외부 호출이 차단되어야 한다", async () => {
    await POST(
      makeRequest({
        email: "invalid-email",
        password: "Password123!",
        nickname: "테스터",
      }),
    );

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
    expect(mockStorageUpload).toHaveBeenCalledTimes(0);
  });

  // TC-25: 다중 오류 수집
  it("TC-25. 여러 필드가 동시에 잘못된 경우 data.errors에 복수 오류가 함께 반환된다", async () => {
    const response = await POST(
      makeRequest({ email: " ", password: "", nickname: " " }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(Array.isArray(body.data.errors)).toBe(true);
    expect(body.data.errors.length).toBeGreaterThanOrEqual(3);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "email",
          reason: VALIDATION_REASON.REQUIRED,
        }),
        expect.objectContaining({
          field: "password",
          reason: VALIDATION_REASON.REQUIRED,
        }),
        expect.objectContaining({
          field: "nickname",
          reason: VALIDATION_REASON.REQUIRED,
        }),
      ]),
    );
    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
  });
});
