import { describe, expect, it } from "vitest";

import { buildSignupRequestPayload } from "./buildSignupRequestPayload";

const validInput = {
  email: "test@example.com",
  password: "12345678",
  confirmPassword: "12345678",
  nickname: "tester",
  agreements: {
    termsOfService: true,
    privacyPolicy: true,
  },
};

describe("buildSignupRequestPayload", () => {
  it("TC-01: JSON payload를 생성한다", () => {
    const result = buildSignupRequestPayload({ ...validInput });

    expect(result).toEqual({
      email: validInput.email,
      password: validInput.password,
      nickname: validInput.nickname,
      agreements: validInput.agreements,
    });
  });

  it("TC-02: confirmPassword는 payload에 포함되지 않는다", () => {
    const result = buildSignupRequestPayload({ ...validInput });

    expect(result).not.toHaveProperty("confirmPassword");
  });

  it("TC-03: 정의되지 않은 임의 필드는 payload에 포함되지 않는다", () => {
    const inputWithExtra = { ...validInput, extra: "data" };
    const result = buildSignupRequestPayload(
      inputWithExtra as Parameters<typeof buildSignupRequestPayload>[0],
    );

    expect(result).not.toHaveProperty("extra");
  });
});
