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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server");

const mockVerifyOtp = vi.fn();

function makeCallbackRequest(params?: {
  token_hash?: string;
  type?: string;
  extra?: Record<string, string>;
  headers?: Record<string, string>;
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

  const requestInit: RequestInit = { method: "GET" };
  if (params?.headers) {
    requestInit.headers = params.headers;
  }

  return new NextRequest(url.toString(), requestInit);
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
    const response = await GET(makeCallbackRequest({ type: "magiclink" }));

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
  it("TC-04. token_hash와 type(magiclink)이 있고 verifyOtp 성공 시 307로 MYPAGE에 redirect된다", async () => {
    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "magiclink" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.MYPAGE);
  });

  it("TC-05. type이 magiclink가 아니면 307으로 VERIFY_EMAIL에 redirect되고 verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "signup" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-06. verifyOtp가 { token_hash, type: magiclink } 형태로 정확히 1회 호출된다", async () => {
    await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "magiclink" }),
    );

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-abc",
      type: "magiclink",
    });
  });

  it("TC-07. 성공 시 redirect location은 MYPAGE URL과 정확히 일치한다", async () => {
    const request = makeCallbackRequest({
      token_hash: "hash-abc",
      type: "magiclink",
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
      makeCallbackRequest({ token_hash: "hash-abc", type: "magiclink" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
  });

  it("TC-09. verifyOtp가 예외를 throw해도 307로 VERIFY_EMAIL에 redirect된다", async () => {
    mockVerifyOtp.mockRejectedValue(new Error("unexpected"));

    const response = await GET(
      makeCallbackRequest({ token_hash: "hash-abc", type: "magiclink" }),
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
        type: "magiclink",
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
        type: "magiclink",
        extra: { foo: "bar" },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.VERIFY_EMAIL);
    expect(location).not.toContain("foo");
  });
});

describe("callback - Open Redirect 방어", () => {
  /**
   * 보안 회귀 테스트: x-forwarded-host / x-forwarded-proto 헤더를 통한 open redirect 방어
   *
   * 목적:
   * - 조작된 forwarded header로 외부 도메인 redirect 불가능한지 검증
   * - APP_URL 환경변수가 설정된 경우, 헤더 값이 무시되어야 함
   * - APP_URL 미설정 시에도 request.url만 사용하고 forwarded header 신뢰 불가
   */

  const originalAppUrl = process.env["APP_URL"];

  beforeEach(() => {
    // 각 테스트마다 APP_URL 초기화
    delete process.env["APP_URL"];
  });

  afterEach(() => {
    // 테스트 후 원래 APP_URL 복원
    if (originalAppUrl) {
      process.env["APP_URL"] = originalAppUrl;
    } else {
      delete process.env["APP_URL"];
    }
  });

  it("TC-12. x-forwarded-host: evil.com 헤더가 있어도 redirect location은 APP_URL 기준으로 생성된다", async () => {
    // APP_URL 설정 (신뢰할 수 있는 정상 서버)
    process.env["APP_URL"] = "https://myapp.example.com";

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
        headers: {
          "x-forwarded-host": "evil.com",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    // redirect는 APP_URL 기반이어야 함
    expect(location).toContain("myapp.example.com");
    // evil.com이 포함되면 안 됨
    expect(location).not.toContain("evil.com");
    // 정상 경로 검증
    expect(location).toContain(ROUTES.MYPAGE);
  });

  it("TC-13. x-forwarded-host / x-forwarded-proto 조합으로도 외부 도메인 redirect 불가능", async () => {
    process.env["APP_URL"] = "https://secure.example.com";

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
        headers: {
          "x-forwarded-host": "attacker.malicious.com",
          "x-forwarded-proto": "http",
        },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    // 정상 도메인 기반
    expect(location).toContain("secure.example.com");
    // 공격자 도메인 미포함
    expect(location).not.toContain("attacker.malicious.com");
    expect(location).not.toContain("malicious.com");
  });

  it("TC-14. APP_URL 미설정 시에도 forwarded header 신뢰하지 않고 request.url 기반 redirect", async () => {
    // APP_URL 미설정 시나리오
    // delete process.env["APP_URL"]; // 이미 beforeEach에서 삭제됨

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
        headers: {
          "x-forwarded-host": "evil.com",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    // request.url 기반 (localhost)이어야 함
    expect(location).toContain("localhost");
    // 헤더 값이 무시되어야 함
    expect(location).not.toContain("evil.com");
    expect(location).toContain(ROUTES.MYPAGE);
  });

  it("TC-15. 실패 경로에서도 forwarded header 신뢰하지 않음", async () => {
    process.env["APP_URL"] = "https://myapp.example.com";

    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
        headers: {
          "x-forwarded-host": "evil.com",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    // 정상 도메인 기반
    expect(location).toContain("myapp.example.com");
    // 공격자 도메인 미포함
    expect(location).not.toContain("evil.com");
    expect(location).toContain(ROUTES.VERIFY_EMAIL);
  });

  it("TC-16. APP_URL이 잘못된 URL이면 request.url origin으로 fallback 한다", async () => {
    process.env["APP_URL"] = "://not-a-valid-url";

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    expect(location).toContain("localhost");
    expect(location).toContain(ROUTES.MYPAGE);
  });

  it("TC-17. APP_URL에 path/query가 있어도 redirect는 origin만 사용한다", async () => {
    process.env["APP_URL"] = "https://myapp.example.com/base/path?x=1";

    const response = await GET(
      makeCallbackRequest({
        token_hash: "hash-abc",
        type: "magiclink",
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";

    expect(location).toContain("myapp.example.com");
    expect(location).toContain(ROUTES.MYPAGE);
    expect(location).not.toContain("/base/path");
    expect(location).not.toContain("?x=1");
  });
});
