import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { VALIDATION_REASON } from "@/lib/constants/validation";
import { createClient } from "@/lib/supabase/server";
import { SIGNUP_PASSWORD_MIN } from "@/lib/validation/auth/signupSchema";

import { POST } from "./route";

vi.mock("@/lib/supabase/server");

describe("회원가입 API 기본 성공 흐름 검증", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
  });

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

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

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

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

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

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

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

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

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

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

  // TC-07: both true
  it("TC-07. agreements가 모두 true이면 회원가입이 성공한다", async () => {
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
