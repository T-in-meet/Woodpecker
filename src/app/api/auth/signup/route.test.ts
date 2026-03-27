import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_CODES } from "@/lib/constants/apiCodes";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { VALIDATION_REASON } from "@/lib/constants/validation";
import { createClient } from "@/lib/supabase/server";

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
    expect(body.code).toBe(API_CODES.SIGNUP_SUCCESS);
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
