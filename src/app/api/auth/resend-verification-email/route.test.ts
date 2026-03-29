import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("@/lib/supabase/server");

describe("PR-API-09 이메일 인증 재전송 API 성공 흐름", () => {
  const mockResend = vi.fn();

  function makeRequest(body: object): NextRequest {
    return new NextRequest(
      "http://localhost/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { resend: mockResend },
    } as never);
    mockResend.mockResolvedValue({ data: {}, error: null });
  });

  // TC-01: 유효 요청 시 resend 호출 및 성공 응답 반환
  it("TC-01. 유효한 요청 시 resend를 1회 호출하고 성공 응답을 반환한다", async () => {
    const response = await POST(makeRequest({ email: " Test@Example.COM " }));
    const body = await response.json();

    // Response assertions
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.resent).toBe(true);

    // External call assertions
    expect(mockResend).toHaveBeenCalledTimes(1);
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );

    // Security assertions
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("errors");
  });
});
