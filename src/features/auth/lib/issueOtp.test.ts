import { beforeEach, describe, expect, it, vi } from "vitest";

import { issueOtp } from "./issueOtp";

const mockGenerateLink = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

describe("issueOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signup purpose를 magiclink type으로 변환한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "123456",
        },
      },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
    });

    expect(mockGenerateLink).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "magiclink",
    });
  });

  it("reset-password purpose를 recovery type으로 변환한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "123456",
        },
      },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "reset-password",
    });

    expect(mockGenerateLink).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "recovery",
    });
  });

  it("generateLink 결과 properties를 otp로 반환한다", async () => {
    const properties = {
      email_otp: "123456",
      hashed_token: "hashed-token",
      action_link: "https://example.com",
    };

    mockGenerateLink.mockResolvedValue({
      data: {
        properties,
      },
      error: null,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
    });

    expect(result).toEqual({
      otp: properties,
      error: null,
    });
  });

  it("error를 그대로 반환한다", async () => {
    const error = {
      message: "failed",
    };

    mockGenerateLink.mockResolvedValue({
      data: {
        properties: null,
      },
      error,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
    });

    expect(result.error).toBe(error);
  });

  it("properties가 없으면 otp를 null로 반환한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: undefined,
      },
      error: null,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
    });

    expect(result).toEqual({
      otp: null,
      error: null,
    });
  });
});
