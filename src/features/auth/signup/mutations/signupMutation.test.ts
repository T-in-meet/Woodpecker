import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signupMutation } from "@/features/auth/signup/mutations/signupMutation";

// 네트워크 요청을 실제로 보내지 않기 위해 fetch를 mock 처리
const mockFetch = vi.fn();

// 전역 fetch를 mock으로 대체
vi.stubGlobal("fetch", mockFetch);

// 공통으로 사용하는 유효한 회원가입 payload
const validSignupPayload = {
  email: "test@example.com",
  password: "Password123!",
  nickname: "tester",
  agreements: {
    termsOfService: true as const,
    privacyPolicyAcknowledged: true as const,
    age14OrOlder: true as const,
  },
};

// 성공 응답 mock 데이터
const signupSuccessResponse = {
  success: true,
  code: "SIGNUP_SUCCESS",
  data: {
    email: "test@example.com",
    redirectTo: "/login",
  },
};

describe("signupMutation", () => {
  beforeEach(() => {
    // 각 테스트 실행 전에 mock 상태 초기화 (호출 횟수, 구현 등)
    mockFetch.mockReset();
  });

  afterEach(() => {
    // 모든 mock 정리 (다른 테스트에 영향 방지)
    vi.clearAllMocks();
  });

  it("JSON 요청으로 fetch를 호출한다", async () => {
    // fetch가 성공 응답을 반환하도록 설정
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    // mutation 실행
    await signupMutation(validSignupPayload);

    // JSON 요청일 경우 header와 body가 올바르게 설정되었는지 검증
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validSignupPayload.email,
        password: validSignupPayload.password,
        nickname: validSignupPayload.nickname,
        agreements: validSignupPayload.agreements,
      }),
      // 응답이 없을 때 무한 대기를 막는 timeout용 signal
      signal: expect.any(AbortSignal),
    });
  });

  it("fetch가 throw하면 network GlobalError로 좁혀서 throw한다", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(signupMutation(validSignupPayload)).rejects.toEqual({
      type: "network",
    });
  });

  it("fetch가 ok: true면 응답 객체를 그대로 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    // mutation 결과 반환값 검증
    const response = await signupMutation(validSignupPayload);

    expect(response).toEqual(signupSuccessResponse);
  });

  // TC-04: 실패 응답을 Error로 감싸지 않고 응답 객체 그대로 reject 해야 한다
  it("TC-04: fetch가 ok: false면 실패 응답 객체를 그대로 reject 한다", async () => {
    const failureBody = { code: "SIGNUP_FAILED" };

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => failureBody,
    });

    // Error 인스턴스가 아닌 서버 응답 body 자체가 reject 값이어야 함
    await expect(signupMutation(validSignupPayload)).rejects.toEqual(
      failureBody,
    );
  });

  // TC-05: 서버 실패 응답의 계약 필드(code, data.errors 등)가 손실되지 않아야 한다
  it("TC-05: 실패 응답의 code, data.errors 등 서버 계약 필드가 손실되지 않는다", async () => {
    const failureBody = {
      success: false,
      code: "SIGNUP_INVALID_INPUT",
      data: {
        errors: [{ field: "email", reason: "INVALID_EMAIL" }],
      },
    };

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => failureBody,
    });

    // reject된 값이 서버 응답 body와 동일해야 하며, 계약 필드가 보존되어야 함
    const rejected = await signupMutation(validSignupPayload).catch(
      (e: unknown) => e,
    );

    expect(rejected).toEqual(failureBody);
    expect((rejected as typeof failureBody).code).toBe("SIGNUP_INVALID_INPUT");
    expect((rejected as typeof failureBody).data.errors).toHaveLength(1);
  });
});
