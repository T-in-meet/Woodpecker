/**
 * Supabase Send Email Hook 핸들러 테스트
 *
 * 검증 범위:
 * - 유효한 Hook payload → encryptTicket → sendAuthEmail 호출 흐름
 * - 필수 필드 누락 시 입력 검증 실패
 * - 내부 처리 실패(encryptTicket, sendAuthEmail) 시 에러 응답
 *
 * Supabase Hook payload 형식:
 * {
 *   user: { email: string },
 *   email_data: { token_hash: string, token: string, ... }
 * }
 *
 * mock 대상:
 * - @/features/auth/email/sendAuthEmail: 이메일 발송 호출 추적
 * - @/features/auth/email/ticket: encryptTicket 동작 제어
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { encryptTicket } from "@/features/auth/email/ticket";

import { POST } from "../route";

vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/features/auth/email/ticket");

const TEST_EMAIL = "user@example.com";
const TEST_TOKEN_HASH = "raw-token-hash-abc123";
const TEST_TICKET = "encrypted-ticket-xyz";

function makeHookRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/hooks/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hook-secret": "test-hook-secret",
    },
    body: JSON.stringify(body),
  });
}

function makeMalformedHookRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/hooks/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hook-secret": "test-hook-secret",
    },
    body: "{ invalid json }",
  });
}

const validPayload = {
  user: { email: TEST_EMAIL },
  email_data: { token_hash: TEST_TOKEN_HASH, token: "otp-token" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env["SUPABASE_HOOK_SECRET"] = "test-hook-secret";
  vi.mocked(encryptTicket).mockReturnValue(TEST_TICKET);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
});

describe("Send Email Hook - 정상 흐름", () => {
  it("TC-01. 유효한 payload를 받으면 sendAuthEmail이 정확히 1회 호출된다", async () => {
    await POST(makeHookRequest(validPayload));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
  });

  it("TC-02. encryptTicket(token_hash) 결과가 sendAuthEmail의 2번째 인자로 전달된다", async () => {
    await POST(makeHookRequest(validPayload));

    expect(vi.mocked(encryptTicket)).toHaveBeenCalledWith(TEST_TOKEN_HASH);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      expect.anything(),
      TEST_TICKET,
      "verify-email",
    );
  });

  it("TC-03. user.email이 sendAuthEmail의 1번째 인자로 전달된다", async () => {
    await POST(makeHookRequest(validPayload));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      TEST_EMAIL,
      expect.anything(),
      "verify-email",
    );
  });

  it("TC-04. 정상 처리 후 200 응답을 반환한다", async () => {
    const response = await POST(makeHookRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_SUCCESS);
  });
});

describe("Send Email Hook - 입력 검증", () => {
  it("TC-05. user.email이 없는 payload는 400을 반환하고 sendAuthEmail을 호출하지 않는다", async () => {
    const payload = {
      user: {},
      email_data: { token_hash: TEST_TOKEN_HASH },
    };

    const response = await POST(makeHookRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_INVALID_INPUT);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });

  it("TC-06. email_data.token_hash가 없는 payload는 400을 반환하고 sendAuthEmail을 호출하지 않는다", async () => {
    const payload = {
      user: { email: TEST_EMAIL },
      email_data: { token: "otp-token" },
    };

    const response = await POST(makeHookRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_INVALID_INPUT);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });

  it("TC-07. malformed JSON은 400을 반환하고 sendAuthEmail을 호출하지 않는다", async () => {
    const response = await POST(makeMalformedHookRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_INVALID_INPUT);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });
});

describe("Send Email Hook - 에러 처리", () => {
  it("TC-08. sendAuthEmail이 throw해도 500 응답을 반환한다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("Resend API error"));

    const response = await POST(makeHookRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_INTERNAL_ERROR);
  });

  it("TC-09. encryptTicket이 throw하면 500을 반환하고 sendAuthEmail을 호출하지 않는다", async () => {
    vi.mocked(encryptTicket).mockImplementation(() => {
      throw new Error("Encryption failed");
    });

    const response = await POST(makeHookRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_INTERNAL_ERROR);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
  });

  it("TC-10. hook secret이 틀리면 401을 반환하고 sendAuthEmail을 호출하지 않는다", async () => {
    process.env["SUPABASE_HOOK_SECRET"] = "expected-secret";

    const request = new NextRequest(
      "http://localhost/api/auth/hooks/send-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hook-secret": "wrong-secret",
        },
        body: JSON.stringify(validPayload),
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SEND_EMAIL_HOOK_UNAUTHORIZED);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(0);
    expect(vi.mocked(encryptTicket)).toHaveBeenCalledTimes(0);
  });

  it("TC-11. user.email은 trim + lowercase 후 sendAuthEmail에 전달된다", async () => {
    const payload = {
      user: { email: "  User@Example.COM  " },
      email_data: { token_hash: TEST_TOKEN_HASH, token: "otp-token" },
    };

    await POST(makeHookRequest(payload));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "user@example.com",
      expect.anything(),
      "verify-email",
    );
  });
});
