/**
 * 회원가입 API의 기본 성공 흐름 전용 테스트
 *
 * 이 파일은 "신규 사용자가 정상 payload로 가입할 때"의 기본 계약만 검증한다.
 * - auth.signUp 호출 여부
 * - 이메일 소문자 정규화
 * - emailRedirectTo에 /auth/callback 포함 여부
 * - 200 OK 반환
 * - 성공 응답 계약(success/code/data) 유지
 *
 * 제외:
 * - 입력 validation 실패
 * - 약관 동의 실패
 * - 기존 계정 인증/미인증 분기
 * - rate limit
 * - avatar 업로드
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

describe("회원가입 API 기본 성공 흐름 검증", () => {
  const mockSignUp = vi.fn();

  // Supabase auth.signUp만 사용하는 최소 mock client 구성
  beforeEach(() => {
    resetRateLimitStores(); // 테스트 간 rate limit 상태 초기화
    vi.clearAllMocks(); // 테스트 간 mock 호출 이력 초기화
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never); // Supabase auth.signUp 경로 고정
    vi.mocked(getUserByEmail).mockResolvedValue(null); // 신규 사용자 흐름 고정
  });

  const requestBody = {
    email: "Test@Example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  // signUp 성공 응답을 공통으로 재사용하기 위한 helper
  const mockSignUpSuccess = () => {
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  };

  it("TC-01: 신규 이메일 요청 시 signUp이 1회 호출된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });

  it("TC-02: 이메일은 소문자로 정규화되어 signUp에 전달된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("TC-03: signUp 호출 시 options.emailRedirectTo는 /auth/callback 경로를 포함한다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(ROUTES.CALLBACK),
        }),
      }),
    );
  });

  it("TC-04: API는 200 OK를 반환한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(200);
  });

  it("TC-05: 성공 응답 body는 success true, code SIGNUP_SUCCESS, data 객체를 포함한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).not.toBeNull();
    expect(typeof body.data).toBe("object");
  });

  it("TC-06: 성공 응답 data.email은 소문자로 정규화된 이메일이다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data.email).toBe("test@example.com");
  });

  it("TC-07: 성공 응답 data는 email과 redirectTo만 포함한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });
});
