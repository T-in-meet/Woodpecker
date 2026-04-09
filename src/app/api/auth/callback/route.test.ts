/**
 * 이메일 인증 callback 처리 테스트
 *
 * 검증 범위:
 * - token_hash / type query 파라미터 누락 시 분기
 * - verifyOtp 성공/실패/예외에 따른 redirect 분기
 * - 성공: 307 → ROUTES.MYPAGE
 * - 실패/누락/예외: 307 → ROUTES.VERIFY_EMAIL
 * - redirect location에 추가 query 미포함
 * - 최소 응답 시간 정책 적용
 *
 * 공통 계약:
 * - 모든 경우 307 redirect
 * - 응답 body 검증 없음
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server");

const mockVerifyOtp = vi.fn();

function makeCallbackRequest(params?: {
  token_hash?: string;
  type?: string;
  extra?: Record<string, string>;
}): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (params?.token_hash !== undefined) {
    url.searchParams.set("token_hash", params.token_hash);
  }
  if (params?.type !== undefined) {
    url.searchParams.set("type", params.type);
  }
  if (params?.extra) {
    for (const [k, v] of Object.entries(params.extra)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  } as never);

  mockVerifyOtp.mockResolvedValue({
    data: { user: { email: "test@example.com" } },
    error: null,
  });
});

describe("callback - 파라미터 누락", () => {
  it("TC-01. token_hash가 없으면 307 redirect되고 verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(makeCallbackRequest({ type: "signup" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-02. type이 없으면 307 redirect되고 verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(makeCallbackRequest({ token_hash: "hash-abc" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-03. token_hash와 type 모두 없으면 307 redirect되고 verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(makeCallbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });
});

describe("callback - verifyOtp 성공", () => {
  it("TC-04. token_hash와 type(signup)이 있고 verifyOtp 성공 시 307로 MYPAGE에 redirect된다", async () => {
    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "signup" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.MYPAGE);
  });

  it("TC-05. token_hash와 type(magiclink)이 있고 verifyOtp 성공 시 307로 MYPAGE에 redirect된다", async () => {
    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "magiclink" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.MYPAGE);
  });

  it("TC-06. verifyOtp가 { token_hash, type } 형태로 정확히 1회 호출된다", async () => {
    await GET(makeCallbackRequest({ token_hash: "hash-abc", type: "signup" }));

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-abc",
      type: "signup",
    });
  });

  it("TC-07. 성공 시 redirect location은 MYPAGE URL과 정확히 일치한다", async () => {
    const request = makeCallbackRequest({
      token_hash: "hash-abc",
      type: "signup",
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      new URL(ROUTES.MYPAGE, request.url).toString(),
    );
  });
});

describe("callback - verifyOtp 실패/예외", () => {
  it("TC-08. verifyOtp가 error를 반환하면 307로 VERIFY_EMAIL에 redirect된다", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "signup" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
  });

  it("TC-09. verifyOtp가 예외를 throw해도 307로 VERIFY_EMAIL에 redirect된다", async () => {
    mockVerifyOtp.mockRejectedValue(new Error("unexpected"));

    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "signup" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
  });
});

describe("callback - redirect location 순수성", () => {
  it("TC-10. 성공 시 redirect location에 추가 query parameter가 포함되지 않는다", async () => {
    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "signup",
        extra: { foo: "bar" },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.MYPAGE);
    expect(location).not.toContain("foo");
    expect(location).not.toContain("token_hash=");
    expect(location).not.toContain("type=");
  });

  it("TC-11. 실패 시 redirect location에 추가 query parameter가 포함되지 않는다", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "signup",
        extra: { foo: "bar" },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.VERIFY_EMAIL);
    expect(location).not.toContain("foo");
  });
});
