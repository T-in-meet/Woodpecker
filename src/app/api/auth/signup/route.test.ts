import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitStores } from "@/lib/auth/checkSignupRateLimit";
import { getUserByEmail } from "@/lib/auth/getUserByEmail";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { VALIDATION_REASON } from "@/lib/constants/validation";
import { createClient } from "@/lib/supabase/server";
import { SIGNUP_PASSWORD_MIN } from "@/lib/validation/auth/signupSchema";

import { POST } from "./route";

vi.mock("@/lib/auth/getUserByEmail");
vi.mock("@/lib/supabase/server");

beforeEach(() => {
  resetRateLimitStores();
});

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("회원가입 API 기본 성공 흐름 검증", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
  });

  const requestBody = {
    email: "Test@Example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  const mockSignUpSuccess = () => {
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  };

  it("신규 이메일 요청 시 signUp이 1회 호출된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });

  it("이메일은 소문자로 정규화되어 signUp에 전달된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("signUp 호출 시 options.emailRedirectTo는 /login 경로를 포함한다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(ROUTES.LOGIN),
        }),
      }),
    );
  });

  it("API는 201 Created를 반환한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(201);
  });

  it("성공 응답 body는 success true, code SIGNUP_SUCCESS, data 객체를 포함한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).not.toBeNull();
    expect(typeof body.data).toBe("object");
  });

  it("성공 응답 data.email은 소문자로 정규화된 이메일이다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data.email).toBe("test@example.com");
  });
});

describe("PR-API-02 회원가입 입력 검증 - 필수값 검증", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
  });

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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });
});

describe("PR-API-02 회원가입 입력 검증 - 형식 / 길이 / 경계값 / 정규화", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
  });

  function mockSignUpSuccess(email = "test@example.com") {
    mockSignUp.mockResolvedValue({
      data: { user: { email } },
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-11: 형식 검증 (성공)
  it("TC-11. 앞뒤 공백이 있는 정상 이메일은 trim 후 성공 처리된다", async () => {
    mockSignUpSuccess();

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
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
    if (body.data?.email !== undefined) {
      expect(body.data.email).toBe("test@example.com");
    }
  });

  // TC-12: 비밀번호 최소 길이 검증
  it(`TC-12. 비밀번호가 최소 길이(${SIGNUP_PASSWORD_MIN}자) 미만이면 validation 실패를 반환한다`, async () => {
    const shortPassword = "a".repeat(SIGNUP_PASSWORD_MIN - 1);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  // TC-14: 경계값 검증 (min)
  it("TC-14. trim 후 닉네임 최소 길이 값은 성공 처리된다", async () => {
    mockSignUpSuccess();

    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: " 가 ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(response.status).not.toBe(400);
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "가" }),
        }),
      }),
    );
  });

  // TC-15: 경계값 검증 (max)
  it("TC-15. trim 후 닉네임 최대 길이 값은 성공 처리된다", async () => {
    mockSignUpSuccess();

    const response = await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: " 가나다라마바사아자차 ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(response.status).not.toBe(400);
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "가나다라마바사아자차" }),
        }),
      }),
    );
  });

  // TC-16 ~ TC-18: 정규화 검증
  it("TC-16. 앞뒤 공백이 있는 이메일은 trim된 값으로 처리된다", async () => {
    mockSignUpSuccess();

    await POST(
      makeRequest({
        email: "  test@example.com  ",
        password: "Password123!",
        nickname: "테스터",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("TC-17. 앞뒤 공백이 있는 닉네임은 trim된 값으로 처리된다", async () => {
    mockSignUpSuccess();

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "Password123!",
        nickname: "  테스터  ",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ nickname: "테스터" }),
        }),
      }),
    );
  });

  it("TC-18. 비밀번호는 원본 값이 유지된다", async () => {
    mockSignUpSuccess();

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "  Password123!  ",
        nickname: "테스터",
        agreements: { termsOfService: true, privacyPolicy: true },
      }),
    );

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ password: "  Password123!  " }),
    );
  });
});

describe("PR-API-02 회원가입 입력 검증 - 실패 응답 계약 / 외부 호출 차단 / 다중 오류 수집", () => {
  const mockSignUp = vi.fn();
  const mockStorageUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
      storage: { from: vi.fn(() => ({ upload: mockStorageUpload })) },
    } as never);
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
  it("TC-23. validation 실패 시 auth.signUp 호출이 0회여야 한다", async () => {
    await POST(
      makeRequest({ email: "", password: "Password123!", nickname: "테스터" }),
    );

    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  it("TC-24. validation 실패 시 모든 외부 호출이 차단되어야 한다", async () => {
    await POST(
      makeRequest({
        email: "invalid-email",
        password: "Password123!",
        nickname: "테스터",
      }),
    );

    expect(mockSignUp).toHaveBeenCalledTimes(0);
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
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });
});

describe("PR-API-03 회원가입 약관 동의 검증", () => {
  const mockSignUp = vi.fn();

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

describe("PR-API-04 회원가입 - pending 계정 재요청 분기", () => {
  const mockSignUp = vi.fn();

  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  const pendingUser = {
    email: "test@example.com",
    email_confirmed_at: null,
  };

  function makeRequest(): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
  });

  it("TC-01. pending 계정이면 200 성공 응답으로 PENDING 상태를 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(pendingUser as never);

    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(json.data).toEqual({ email: "test@example.com", status: "PENDING" });
  });

  it("TC-02. pending 분기에서는 getUserByEmail이 정확히 1회 호출된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(pendingUser as never);

    await POST(makeRequest());

    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
  });

  it("TC-03. pending 분기에서는 signup이 호출되지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(pendingUser as never);

    await POST(makeRequest());

    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });
});

describe("PR-API-05 회원가입 - active 계정 재요청 분기", () => {
  const mockSignUp = vi.fn();

  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  const activeUser = {
    id: "user-123",
    email: "test@example.com",
    email_confirmed_at: "2026-03-29T00:00:00.000Z",
  };

  function makeRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
  });

  it("TC-01. active 계정이면 200 응답과 /login redirect를 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(activeUser as never);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: "/login",
    });
  });

  it("TC-02. active 분기에서는 signup이 호출되지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(activeUser as never);

    await POST(makeRequest());

    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("TC-03. active 분기 응답은 API 계약 구조를 유지한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(activeUser as never);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: AUTH_API_CODES.SIGNUP_SUCCESS,
      data: {
        email: "test@example.com",
        redirectTo: "/login",
      },
    });
    expect(body).not.toHaveProperty("errors");
    expect(body).not.toHaveProperty("error");
  });

  it("TC-04. active 분기 응답은 /verify-email redirect를 포함하지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(activeUser as never);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data.redirectTo).toBe("/login");
    expect(body.data.redirectTo).not.toBe("/verify-email");
  });
});

describe("PR-API-06 회원가입 - IP/이메일 기반 rate limit", () => {
  const mockSignUp = vi.fn();

  const BASE_BODY = {
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  function makeRequest(ip: string, email = "test@example.com"): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ ...BASE_BODY, email }),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TC-01. 동일 IP로 10번까지 요청이 허용된다", async () => {
    const ip = "10.1.0.1";
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest(ip, `tc01user${i}@example.com`));
      expect(response.status).not.toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-02. 동일 IP로 11번째 요청은 429를 반환한다", async () => {
    const ip = "10.2.0.1";
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(ip, `tc02user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "tc02overflow@example.com"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-03. 동일 이메일로 5번까지 요청이 허용된다", async () => {
    const email = "tc03@example.com";
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest(`10.3.${i}.1`, email));
      expect(response.status).not.toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-04. 동일 이메일로 6번째 요청은 429를 반환한다", async () => {
    const email = "tc04@example.com";
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(`10.4.${i}.1`, email));
    }
    const response = await POST(makeRequest("10.4.5.1", email));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
    expect(body.data).toBeNull();
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-05. 동일 IP로 10번째 요청이 경계값으로 허용된다", async () => {
    const ip = "10.5.0.1";
    for (let i = 0; i < 9; i++) {
      await POST(makeRequest(ip, `tc05user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "tc05user9@example.com"));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalledTimes(10);
  });

  it("TC-06. 동일 이메일로 5번째 요청이 경계값으로 허용된다", async () => {
    const email = "tc06@example.com";
    for (let i = 0; i < 4; i++) {
      await POST(makeRequest(`10.6.${i}.1`, email));
    }
    const response = await POST(makeRequest("10.6.4.1", email));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalledTimes(5);
  });

  it("TC-07. IP 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const ip = "10.7.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip, `tc07user${i}@example.com`));
    }
    mockSignUp.mockClear();

    for (let i = 0; i < 3; i++) {
      const response = await POST(makeRequest(ip, `tc07extra${i}@example.com`));
      expect(response.status).toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  it("TC-08. 이메일 한도 초과 후 같은 윈도우에서 계속 차단된다", async () => {
    const email = "tc08@example.com";
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest(`10.8.${i}.1`, email));
    }
    mockSignUp.mockClear();

    for (let i = 0; i < 3; i++) {
      const response = await POST(makeRequest(`10.8.${i + 10}.1`, email));
      expect(response.status).toBe(429);
    }
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });

  it("TC-09. 윈도우 만료 후 IP limit이 리셋된다", async () => {
    const ip = "10.9.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip, `tc09user${i}@example.com`));
    }
    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest(ip, "tc09reset@example.com"));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalled();
  });

  it("TC-10. 윈도우 만료 후 이메일 limit이 리셋된다", async () => {
    const email = "tc10@example.com";
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest(`10.10.${i}.1`, email));
    }
    vi.advanceTimersByTime(61 * 1000);

    const response = await POST(makeRequest("10.10.10.1", email));
    expect(response.status).not.toBe(429);
    expect(mockSignUp).toHaveBeenCalled();
  });

  it("TC-11A. 이메일이 달라도 IP limit은 동작한다", async () => {
    const ip = "10.11.0.1";
    for (let i = 0; i < 10; i++) {
      await POST(makeRequest(ip, `user${i}@example.com`));
    }
    const response = await POST(makeRequest(ip, "overflow@example.com"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-11B. IP가 달라도 이메일 limit은 동작한다", async () => {
    const email = "tc11b@example.com";
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest(`10.11.${i}.2`, email));
    }
    const response = await POST(makeRequest("10.11.10.2", email));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  });

  it("TC-12. rate limit 실패 응답이 API 계약 구조를 유지한다", async () => {
    const ip = "10.12.0.1";
    for (let i = 0; i < 11; i++) {
      await POST(makeRequest(ip));
    }
    const response = await POST(makeRequest(ip));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("data");
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
    expect(body.data).toBeNull();
  });
});

describe("PR-API-07 프로필 이미지 업로드 성공 시 avatar_url 반영", () => {
  const mockSignUp = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();
  const mockProfileEq = vi.fn();

  const MOCK_UPLOAD_PATH = "avatars/mock-image.png";
  const MOCK_PUBLIC_URL = "https://example.com/storage/avatars/mock-image.png";

  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=boundary",
      },
      body: "dummy",
    });

    const mockFile = new File(["image-content"], "profile.jpg", {
      type: "image/jpeg",
    });
    const fields: Record<string, string | File> = {
      email: "test@example.com",
      password: "Password123!",
      nickname: "테스터",
      agreements: JSON.stringify({ termsOfService: true, privacyPolicy: true }),
      avatarFile: mockFile,
    };

    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => fields[key] ?? null,
    } as unknown as FormData);

    return request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    mockProfileUpdate.mockReturnValue({ eq: mockProfileEq });
    mockProfileEq.mockResolvedValue({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
      storage: {
        from: vi.fn(() => ({
          upload: mockStorageUpload,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
      from: vi.fn(() => ({
        update: mockProfileUpdate,
      })),
    } as never);
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-id", email: "test@example.com" } },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({
      data: { path: MOCK_UPLOAD_PATH },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: MOCK_PUBLIC_URL },
    });
  });

  // TC-01: 프로필 이미지 포함 회원가입 성공 응답 반환
  it("TC-01. 프로필 이미지 포함 회원가입 성공 시 성공 응답을 반환한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.avatar_url).toBe(MOCK_PUBLIC_URL);
  });

  // TC-02: avatarFile 제공 시 storage.upload 호출
  it("TC-02. avatarFile가 포함된 요청 시 storage.upload가 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
  });

  // TC-03: upload 경로로 getPublicUrl 호출
  it("TC-03. upload 경로로 getPublicUrl이 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledWith(MOCK_UPLOAD_PATH);
  });

  // TC-04: 생성된 public URL로 avatar_url 업데이트
  it("TC-04. 생성된 public URL로 profiles 테이블의 avatar_url이 업데이트된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockProfileUpdate).toHaveBeenCalledTimes(1);
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: MOCK_PUBLIC_URL }),
    );
  });
});

describe("PR-API-08 프로필 이미지 업로드 실패 시 회원가입 성공 유지", () => {
  const mockSignUp = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();

  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=boundary",
      },
      body: "dummy",
    });

    const mockFile = new File(["image-content"], "profile.jpg", {
      type: "image/jpeg",
    });
    const fields: Record<string, string | File> = {
      email: "test@example.com",
      password: "Password123!",
      nickname: "Tester",
      agreements: JSON.stringify({ termsOfService: true, privacyPolicy: true }),
      avatarFile: mockFile,
    };

    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => fields[key] ?? null,
    } as unknown as FormData);

    return request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
      storage: {
        from: vi.fn(() => ({
          upload: mockStorageUpload,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
      from: vi.fn(() => ({
        update: mockProfileUpdate,
      })),
    } as never);
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-id", email: "test@example.com" } },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: { message: "upload failed" },
    });
  });

  // TC-01: 업로드 실패해도 signup은 201로 성공한다
  it("TC-01. 업로드 실패 시에도 회원가입은 201 성공 응답을 반환한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.redirectTo).toBe(ROUTES.VERIFY_EMAIL);
  });

  // TC-02: 업로드 실패 시 getPublicUrl 미호출
  it("TC-02. 업로드 실패 시 getPublicUrl은 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(0);
  });

  // TC-03: 업로드 실패 시 profile update 미호출
  it("TC-03. 업로드 실패 시 profiles 테이블 업데이트는 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());

    expect(mockProfileUpdate).toHaveBeenCalledTimes(0);
  });

  // TC-04: 응답 data에 avatar_url 미포함
  it("TC-04. 업로드 실패 시 응답 data에 avatar_url이 포함되지 않는다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(body.data).not.toHaveProperty("avatar_url");
  });
});
