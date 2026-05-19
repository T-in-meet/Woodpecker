import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { verifyOtpAction } from "./verifyOtpAction";

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

vi.mock("../../lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: vi.fn(),
}));

import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";

import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import { logAuthError } from "../../lib/authLogger";
import {
  checkRequestEligibility,
  mapBlockedByToReason,
} from "../../lib/checkRequestEligibility";
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

    vi.mocked(applyMinimumActionDelay).mockResolvedValue(undefined);
  });

  it("OTP 인증에 성공하면 completed 상태와 redirectTo를 반환한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    const result = await verifyOtpAction("/after-login", prevState, formData);

    expect(result).toEqual({
      status: "completed",
      redirectTo: "/after-login",
      fieldErrors: null,
    });

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    expect(applyMinimumActionDelay).toHaveBeenCalledTimes(1);
  });

  it("redirectPath가 없으면 기본 경로로 completed 상태를 반환한다", async () => {
    const formData = createFormData({
      email: "user@example.com",
      purpose: "signup",
      otp: "123456",
    });

    const result = await verifyOtpAction(null, prevState, formData);

    expect(result).toEqual({
      status: "completed",
      redirectTo: ROUTES.MYPAGE,
      fieldErrors: null,
    });
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

  it("verifyOtp가 error를 반환하면 invalid_input으로 처리한다", async () => {
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
      status: "invalid_input",
      fieldErrors: {
        otp: INVALID_OTP_ERROR_MESSAGE,
      },
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

    await verifyOtpAction(null, prevState, formData);

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
});
