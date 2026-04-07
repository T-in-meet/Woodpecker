/**
 * 기존 계정 재요청 분기 전용 테스트
 *
 * 이 파일은 signup API가 "이미 존재하는 계정"을 만났을 때의 분기 정책만 검증한다.
 * - 기존 미인증/인증 계정이면 200
 * - 두 경우 모두 getUserByEmail 호출 확인
 * - 두 경우 모두 auth.signUp 재호출 금지
 * - 응답 계약(success/code/data) 유지
 *
 * 핵심 목적:
 * "신규 가입"과 "기존 계정 분기"를 테스트 책임상 분리한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

// 기존 인증/미인증 계정 분기 판단에 사용하는 기존 유저 조회 mock
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetRateLimitStores();
});

describe("회원가입 - 기존 미인증 사용자 재요청 분기", () => {
  const mockSignUp = vi.fn();

  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  // 기존 미인증 계정: 이메일은 존재하지만 아직 인증되지 않은 상태
  const unverifiedUser = {
    email: "test@example.com",
    email_confirmed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
  });

  it("TC-01. 기존 미인증 사용자도 동일한 성공 응답을 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(json.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });

  it("TC-02. 기존 미인증 사용자 분기에서는 getUserByEmail이 정확히 1회 호출된다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
  });

  it("TC-03. 기존 미인증 사용자 분기에서는 signup이 호출되지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

    await POST(makeRequest(requestBody));

    // 기존 계정 분기 테스트에서는 signUp이 실제로 호출되면 안 되므로 호출 수 검증이 중요하다
    expect(mockSignUp).toHaveBeenCalledTimes(0);
  });
});

describe("회원가입 - 기존 인증 사용자 재요청 분기", () => {
  const mockSignUp = vi.fn();

  const requestBody = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  // 기존 인증 계정: 이메일 인증이 완료된 기존 가입 상태
  const verifiedUser = {
    id: "user-123",
    email: "test@example.com",
    email_confirmed_at: "2026-03-29T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
    vi.mocked(getUserByEmail).mockResolvedValue(null);
  });

  it("TC-01. 기존 인증 사용자도 동일한 성공 응답을 반환한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });

  it("TC-02. 기존 인증 사용자 분기에서는 signup이 호출되지 않는다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    await POST(makeRequest(requestBody));

    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("test@example.com");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("TC-03. 기존 인증 사용자 분기 응답은 API 계약 구조를 유지한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: AUTH_API_CODES.SIGNUP_SUCCESS,
      data: {
        email: "test@example.com",
        redirectTo: ROUTES.LOGIN,
      },
    });
    expect(body).not.toHaveProperty("errors");
    expect(body).not.toHaveProperty("error");
  });
});
