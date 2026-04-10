import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSignupRequestPayload } from "@/features/auth/signup/lib/buildSignupRequestPayload";
import { signupMutation } from "@/features/auth/signup/mutations/signupMutation";

// 네트워크 요청을 실제로 보내지 않기 위해 fetch를 mock 처리
const mockFetch = vi.fn();

// 전역 fetch를 mock으로 대체
vi.stubGlobal("fetch", mockFetch);

// payload 생성 로직은 이 테스트의 관심사가 아니므로 mock 처리
// (signupMutation의 요청 생성/전송 로직만 검증하기 위함)
vi.mock("@/features/auth/signup/lib/buildSignupRequestPayload");

// 공통으로 사용하는 유효한 회원가입 payload
const validSignupPayload = {
  email: "test@example.com",
  password: "Password123!",
  nickname: "tester",
  agreements: {
    termsOfService: true as const,
    privacyPolicy: true as const,
  },
};

// 성공 응답 mock 데이터
const signupSuccessResponse = {
  data: {
    email: "test@example.com",
    redirectTo: "/login",
  },
};

// JSON 요청 형태 mock (buildSignupRequestPayload가 반환하는 값)
const jsonRequestMock = {
  requestType: "json" as const,
  body: {
    email: "test@example.com",
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true, privacyPolicy: true },
  },
};

describe("signupMutation", () => {
  beforeEach(() => {
    // 각 테스트 실행 전에 mock 상태 초기화 (호출 횟수, 구현 등)
    mockFetch.mockReset();
    vi.mocked(buildSignupRequestPayload).mockReset();
  });

  afterEach(() => {
    // 모든 mock 정리 (다른 테스트에 영향 방지)
    vi.clearAllMocks();
  });

  it("json 요청이면 Content-Type application/json과 직렬화된 body로 fetch를 호출한다", async () => {
    // payload builder가 JSON 형태 요청을 반환하도록 설정
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);

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
      body: JSON.stringify(jsonRequestMock.body),
    });
  });

  it("multipart 요청이면 Content-Type 없이 FormData body로 fetch를 호출한다", async () => {
    const formData = new FormData();

    // multipart 요청 형태로 반환하도록 설정
    vi.mocked(buildSignupRequestPayload).mockReturnValue({
      requestType: "multipart",
      body: formData,
    });

    // fetch 성공 응답 설정
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    // mutation 실행
    await signupMutation(validSignupPayload);

    // multipart는 Content-Type을 직접 설정하면 안됨 (boundary 문제)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      body: formData,
    });
  });

  it("fetch가 ok: true면 응답 객체를 그대로 반환한다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
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

    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
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

    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
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

  it("buildSignupRequestPayload를 payload와 함께 정확히 1회 호출한다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    await signupMutation(validSignupPayload);

    // payload 생성 함수가 정확히 1번, 올바른 인자로 호출되었는지 검증
    expect(vi.mocked(buildSignupRequestPayload)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(buildSignupRequestPayload)).toHaveBeenCalledWith(
      validSignupPayload,
    );
  });
});
