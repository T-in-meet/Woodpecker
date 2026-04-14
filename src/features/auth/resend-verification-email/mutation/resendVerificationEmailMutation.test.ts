import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

import { resendVerificationEmailMutation } from "./resendVerificationEmailMutation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const payload = { email: "test@example.com" };

describe("resendVerificationEmailMutation", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01. JSON payload로 resend API를 호출한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
        data: { email: payload.email, resent: true },
      }),
    });

    await resendVerificationEmailMutation(payload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  });

  it("TC-02. 성공 응답이면 schema parse 결과를 반환한다", async () => {
    const successBody = {
      success: true,
      code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
      data: { email: payload.email, resent: true },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => successBody,
    });

    const result = await resendVerificationEmailMutation(payload);

    expect(result).toEqual(successBody);
  });

  it("TC-03. HTTP 실패(ok=false)면 body를 그대로 throw한다", async () => {
    const failureBody = {
      success: false,
      code: AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED,
      data: null,
    };
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => failureBody,
    });

    await expect(resendVerificationEmailMutation(payload)).rejects.toEqual(
      failureBody,
    );
  });

  it("TC-04. 성공 status라도 계약 위반 body면 ZodError를 throw한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
        data: { email: payload.email },
      }),
    });

    await expect(
      resendVerificationEmailMutation(payload),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
