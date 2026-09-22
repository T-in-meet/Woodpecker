import { beforeEach, describe, expect, it, vi } from "vitest";

import type { createClient } from "@/lib/supabase/server";

import { verifyOtp } from "./verifyOtp";

const mockVerifyOtp = vi.fn();

const supabase = {
  auth: {
    verifyOtp: mockVerifyOtp,
  },
} as unknown as Awaited<ReturnType<typeof createClient>>;

describe("verifyOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signup purpose를 email type으로 변환한다", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: null,
    });

    await verifyOtp({
      supabase,
      email: "user@example.com",
      otp: "123456",
      purpose: "signup",
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("reset-password purpose를 recovery로 변환한다", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: null,
    });

    await verifyOtp({
      supabase,
      email: "user@example.com",
      otp: "123456",
      purpose: "reset-password",
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "recovery",
    });
  });

  it("verifyOtp 결과를 그대로 반환한다", async () => {
    const response = {
      data: {
        session: null,
      },
      error: null,
    };

    mockVerifyOtp.mockResolvedValue(response);

    const result = await verifyOtp({
      supabase,
      email: "user@example.com",
      otp: "123456",
      purpose: "signup",
    });

    expect(result).toEqual(response);
  });

  it("Supabase error를 그대로 반환한다", async () => {
    const response = {
      data: {
        session: null,
      },
      error: {
        message: "Invalid OTP",
      },
    };

    mockVerifyOtp.mockResolvedValue(response);

    const result = await verifyOtp({
      supabase,
      email: "user@example.com",
      otp: "123456",
      purpose: "signup",
    });

    expect(result).toEqual(response);
  });
});
