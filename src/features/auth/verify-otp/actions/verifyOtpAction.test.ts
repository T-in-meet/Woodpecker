import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { verifyOtpAction } from "./verifyOtpAction";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("../../lib/authLogger", () => ({
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  normalizeUnknownError: vi.fn(() => ({
    message: "normalized error",
  })),
}));

vi.mock("@/lib/utils/getServerActionClientIp", () => ({
  getServerActionClientIp: vi.fn(),
}));

vi.mock("../../lib/checkRequestEligibility", () => ({
  checkRequestEligibility: vi.fn(),
  mapBlockedByToReason: vi.fn(),
}));

vi.mock("../lib/verifyOtp", () => ({
  verifyOtp: vi.fn(),
}));

vi.mock("../../lib/getUserByEmail", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("../../lib/resetPasswordIntent", () => ({
  setResetPasswordIntentCookie: vi.fn(),
}));

vi.mock("../../lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

import { redirect } from "next/navigation";

import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";

import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthError } from "../../lib/authLogger";
import {
  checkRequestEligibility,
  mapBlockedByToReason,
} from "../../lib/checkRequestEligibility";
import { getUserByEmail } from "../../lib/getUserByEmail";
import { setResetPasswordIntentCookie } from "../../lib/resetPasswordIntent";
import { verifyOtp } from "../lib/verifyOtp";

const prevState = {
  status: "idle",
  fieldErrors: null,
} as const;

function createFormData(input: {
  email?: string;
  purpose?: string;
  otp?: string;
}) {
  const formData = new FormData();

  if (input.email !== undefined) formData.set("email", input.email);
  if (input.purpose !== undefined) formData.set("purpose", input.purpose);
  if (input.otp !== undefined) formData.set("otp", input.otp);

  return formData;
}

describe("verifyOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerActionClientIp).mockResolvedValue("127.0.0.1");

    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: true,
    } as ReturnType<typeof checkRequestEligibility>);

    vi.mocked(verifyOtp).mockResolvedValue({
      error: null,
    } as Awaited<ReturnType<typeof verifyOtp>>);

    vi.mocked(getUserByEmail).mockResolvedValue(null);

    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
  });

  it("OTP 인증에 성공하면 redirectPath로 redirect한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    await expect(
      verifyOtpAction("/after-login", prevState, formData),
    ).rejects.toThrow("NEXT_REDIRECT:/after-login");

    expect(redirect).toHaveBeenCalledWith("/after-login");

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("redirectPath가 없으면 기본 경로로 redirect한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.MYPAGE}`,
    );

    expect(redirect).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("signup OTP 인증 전 기존 OAuth-only 사용자로 확인되면 비밀번호 설정 페이지로 redirect한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "oauth-user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-03-29T00:00:00.000Z",
      auth_providers: ["google"],
      has_password_login: false,
    });

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.SET_PASSWORD}`,
    );

    expect(redirect).toHaveBeenCalledWith(ROUTES.SET_PASSWORD);
  });

  it("signup OTP 인증 전 기존 OAuth-only 사용자로 확인되고 redirectPath가 있으면 비밀번호 설정 완료 후 이동 경로를 전달한다", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "oauth-user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-03-29T00:00:00.000Z",
      auth_providers: ["google"],
      has_password_login: false,
    });

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });
    const expectedPath = `${ROUTES.SET_PASSWORD}?redirect=${encodeURIComponent(
      "/target",
    )}`;

    await expect(
      verifyOtpAction("/target", prevState, formData),
    ).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);

    expect(redirect).toHaveBeenCalledWith(expectedPath);
  });

  it("context 검증에 실패하면 invalid_request를 반환하고 이후 검증은 실행하지 않는다", async () => {
    const formData = createFormData({
      otp: "123456",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result).toEqual({
      status: "invalid_request",
      reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      fieldErrors: null,
    });

    expect(checkRequestEligibility).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("OTP 입력 검증에 실패하면 invalid_input을 반환하고 verifyOtp를 호출하지 않는다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "invalid-otp",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result.status).toBe("invalid_input");

    if (result.status !== "invalid_input") {
      throw new Error("Expected invalid_input state");
    }

    expect(result.fieldErrors?.otp).toBeDefined();

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("OTP 입력 검증 실패 메시지가 없으면 기본 OTP 오류 메시지를 반환한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result.status).toBe("invalid_input");

    if (result.status !== "invalid_input") {
      throw new Error("Expected invalid_input state");
    }

    expect(result.fieldErrors?.otp).toBeDefined();

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rate limit에 걸리면 blocked를 반환하고 verifyOtp를 호출하지 않는다", async () => {
    vi.mocked(checkRequestEligibility).mockReturnValue({
      allowed: false,
      blockedBy: "emailShort",
    } as unknown as ReturnType<typeof checkRequestEligibility>);

    vi.mocked(mapBlockedByToReason).mockReturnValue(
      AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT,
    );

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result).toEqual({
      status: "blocked",
      reasonCode: AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT,
      fieldErrors: null,
    });

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("verifyOtp가 error를 반환하면 invalid_otp로 처리한다", async () => {
    vi.mocked(verifyOtp).mockResolvedValue({
      error: new Error("invalid otp"),
    } as Awaited<ReturnType<typeof verifyOtp>>);

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result).toEqual({
      status: "invalid_otp",
      formError: INVALID_OTP_ERROR_MESSAGE,
    });

    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("verifyOtp가 throw하면 internal_error를 반환한다", async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error("unexpected error"));

    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result).toEqual({
      status: "internal_error",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      fieldErrors: null,
    });

    expect(logAuthError).toHaveBeenCalled();
    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("rate limit에는 정규화된 이메일을 사용하고 verifyOtp에는 context email을 그대로 전달한다", async () => {
    const formData = createFormData({
      email: "USER@Example.COM",
      purpose: "signup",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.MYPAGE}`,
    );

    expect(checkRequestEligibility).toHaveBeenCalledWith(
      "verify-otp",
      "127.0.0.1",
      "user@example.com",
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "USER@Example.COM",
      purpose: "signup",
      otp: "123456",
    });
  });

  it("reset-password OTP 인증에 성공하면 reset-password 경로로 redirect한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "reset-password",
      otp: "123456",
    });

    await expect(verifyOtpAction(null, prevState, formData)).rejects.toThrow(
      `NEXT_REDIRECT:${ROUTES.RESET_PASSWORD}`,
    );

    expect(redirect).toHaveBeenCalledWith(ROUTES.RESET_PASSWORD);
    expect(setResetPasswordIntentCookie).toHaveBeenCalledTimes(1);
  });

  it("reset-password OTP 인증에 성공하고 redirectPath가 있으면 reset-password 경로에 redirect query를 포함한다", async () => {
    const redirectPath = "/target";

    const formData = createFormData({
      email: "user@example.com",
      purpose: "reset-password",
      otp: "123456",
    });

    const expectedPath = `${ROUTES.RESET_PASSWORD}?redirect=${encodeURIComponent(
      redirectPath,
    )}`;

    await expect(
      verifyOtpAction(redirectPath, prevState, formData),
    ).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);

    expect(redirect).toHaveBeenCalledWith(expectedPath);
    expect(setResetPasswordIntentCookie).toHaveBeenCalledTimes(1);
  });
});
