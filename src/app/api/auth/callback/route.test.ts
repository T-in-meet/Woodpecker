/**
 * 이메일 인증 callback 처리 테스트
 *
 * 검증 범위:
 * - ticket query 유무/유효성에 따른 분기
 * - decryptTicket → verifyOtp 호출 순서 및 인자
 * - 성공/실패/예외 모두 307 redirect로 동일하게 처리
 * - redirect location에 추가 query 미포함
 *
 * 공통 계약:
 * - 모든 경우 307 redirect
 * - location 헤더는 ROUTES.LOGIN 포함
 * - 응답 body 검증 없음
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decryptTicket } from "@/features/auth/email/ticket";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server");
vi.mock("@/features/auth/email/ticket");

const mockVerifyOtp = vi.fn();

function makeCallbackRequest(ticket?: string): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (ticket !== undefined) {
    url.searchParams.set("ticket", ticket);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(createClient).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  } as never);

  vi.mocked(decryptTicket).mockReturnValue("token-hash-xyz");

  mockVerifyOtp.mockResolvedValue({
    data: { user: { email: "test@example.com" } },
    error: null,
  });
});

describe("callback - ticket query 누락/빈값", () => {
  it("TC-01. ticket query가 없으면 307 redirect되고 createClient, decryptTicket, verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(makeCallbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(decryptTicket)).toHaveBeenCalledTimes(0);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-02. ticket query가 빈 문자열이면 307 redirect되고 createClient, verifyOtp를 호출하지 않는다", async () => {
    const response = await GET(makeCallbackRequest(""));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(0);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });
});

describe("callback - decryptTicket 실패", () => {
  it("TC-03. decryptTicket이 throw하면 307 redirect되고 createClient, verifyOtp를 호출하지 않는다", async () => {
    vi.mocked(decryptTicket).mockImplementation(() => {
      throw new Error("invalid ticket");
    });

    const response = await GET(makeCallbackRequest("bad-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(0);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });
});

describe("callback - verifyOtp 정상 흐름", () => {
  it("TC-04. decryptTicket 성공, verifyOtp 성공 시 307 redirect되고 createClient 1회, verifyOtp 1회 호출된다", async () => {
    const response = await GET(makeCallbackRequest("valid-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
  });

  it("TC-05. valid ticket이면 decryptTicket이 원본 ticket 값으로 정확히 1회 호출된다", async () => {
    await GET(makeCallbackRequest("valid-ticket"));

    expect(vi.mocked(decryptTicket)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(decryptTicket)).toHaveBeenCalledWith("valid-ticket");
  });

  it("TC-06. valid ticket이면 verifyOtp가 { type: 'signup', token_hash } 형태로 정확히 1회 호출된다", async () => {
    await GET(makeCallbackRequest("valid-ticket"));

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "token-hash-xyz",
    });
  });

  it("TC-07. 성공 시 redirect location은 로그인 URL과 정확히 일치한다", async () => {
    const request = makeCallbackRequest("valid-ticket");

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      new URL(ROUTES.LOGIN, request.url).toString(),
    );
  });

  it("TC-07A. magiclink prefix ticket이면 verifyOtp가 magiclink 타입으로 호출된다", async () => {
    vi.mocked(decryptTicket).mockReturnValue("magiclink:token-hash-xyz");

    await GET(makeCallbackRequest("valid-ticket"));

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "magiclink",
      token_hash: "token-hash-xyz",
    });
  });
});

describe("callback - verifyOtp 실패/예외", () => {
  it("TC-08. verifyOtp가 error를 반환해도 307 redirect되고 createClient 1회, verifyOtp 1회 호출된다", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await GET(makeCallbackRequest("valid-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(decryptTicket)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
  });

  it("TC-09. verifyOtp가 예상치 못한 에러를 throw해도 307 redirect되고 createClient 1회 호출된다", async () => {
    mockVerifyOtp.mockRejectedValue(new Error("unexpected"));

    const response = await GET(makeCallbackRequest("valid-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(1);
  });
});

describe("callback - redirect location 순수성", () => {
  it("TC-10. 추가 query parameter가 있어도 redirect location에 포함되지 않는다", async () => {
    const url = new URL("http://localhost/api/auth/callback");
    url.searchParams.set("ticket", "valid-ticket");
    url.searchParams.set("foo", "bar");
    const request = new NextRequest(url.toString(), { method: "GET" });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain(ROUTES.LOGIN);
    expect(location).not.toContain("foo");
    expect(location).not.toContain("ticket=");
  });
});

describe("callback - notify ticket 정책", () => {
  it("TC-11. notify ticket이면 verifyOtp를 호출하지 않고 로그인으로 redirect한다", async () => {
    vi.mocked(decryptTicket).mockReturnValue("notify-ticket-without-auth");

    const response = await GET(makeCallbackRequest("notify-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
    expect(mockVerifyOtp).toHaveBeenCalledTimes(0);
  });

  it("TC-12. notify ticket에서도 외부 응답 계약은 동일하게 유지된다", async () => {
    vi.mocked(decryptTicket).mockReturnValue("notify-ticket-without-auth");

    const response = await GET(makeCallbackRequest("notify-ticket"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.LOGIN);
  });
});
