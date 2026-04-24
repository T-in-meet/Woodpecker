/**
 * loginMutation 단위 테스트
 *
 * 검증 범위:
 * - POST /api/auth/login으로 올바른 형식의 요청을 보내는지
 * - redirect query 파라미터 포함 여부
 * - 성공 응답(200) → loginSuccessResponseSchema 검증 후 반환
 * - 실패 응답(400/401/429/500) → 응답 body 그대로 throw (계약 필드 손실 없음)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginMutation } from "@/features/auth/login/mutations/loginMutation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const validPayload = {
  email: "user@example.com",
  password: "Password123!",
};

const loginSuccessBody = {
  success: true,
  code: "LOGIN_SUCCESS",
  data: { redirectTo: "/mypage" },
};

describe("loginMutation", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/auth/login으로 JSON 요청을 보낸다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => loginSuccessBody,
    });

    await loginMutation(validPayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validPayload.email,
        password: validPayload.password,
      }),
    });
  });

  it("redirect query가 있으면 URL query에 포함해서 요청한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...loginSuccessBody,
        data: { redirectTo: "/notes" },
      }),
    });

    await loginMutation(validPayload, "/notes");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/login?redirect=%2Fnotes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validPayload.email,
          password: validPayload.password,
        }),
      },
    );
  });

  it("redirectTo가 없으면 query 없이 요청한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => loginSuccessBody,
    });

    await loginMutation(validPayload);

    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("/api/auth/login");
  });

  it("성공 응답(ok: true)이면 파싱된 응답을 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => loginSuccessBody,
    });

    const result = await loginMutation(validPayload);

    expect(result).toEqual(loginSuccessBody);
  });

  it("실패 응답(ok: false)이면 응답 body 객체를 그대로 throw한다", async () => {
    const failureBody = {
      success: false,
      code: "LOGIN_INVALID_CREDENTIALS",
      data: null,
    };

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => failureBody,
    });

    await expect(loginMutation(validPayload)).rejects.toEqual(failureBody);
  });

  it("실패 응답의 code, data 등 서버 계약 필드가 손실되지 않는다", async () => {
    const failureBody = {
      success: false,
      code: "LOGIN_INVALID_INPUT",
      data: { errors: [{ field: "email", reason: "INVALID_FORMAT" }] },
    };

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => failureBody,
    });

    const rejected = await loginMutation(validPayload).catch((e: unknown) => e);

    expect(rejected).toEqual(failureBody);
    expect((rejected as typeof failureBody).code).toBe("LOGIN_INVALID_INPUT");
    expect((rejected as typeof failureBody).data.errors).toHaveLength(1);
  });
});
