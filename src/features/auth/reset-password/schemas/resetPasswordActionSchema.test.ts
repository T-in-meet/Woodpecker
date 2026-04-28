import { describe, expect, it } from "vitest";

import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";

import { resetPasswordActionSchema } from "./resetPasswordActionSchema";

describe("resetPasswordActionSchema", () => {
  it("valid payload를 통과시킨다", () => {
    const result = resetPasswordActionSchema.safeParse({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
    expect(result.success).toBe(true);
  });

  it("비밀번호 길이가 짧으면 password error를 반환한다", () => {
    const result = resetPasswordActionSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toEqual([
        `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
      ]);
    }
  });

  it("confirmPassword 불일치면 confirmPassword error를 반환한다", () => {
    const result = resetPasswordActionSchema.safeParse({
      password: "valid-password",
      confirmPassword: "different-password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toEqual([
        "비밀번호가 일치하지 않습니다.",
      ]);
    }
  });

  it("extra field를 거부한다", () => {
    const result = resetPasswordActionSchema.safeParse({
      password: "valid-password",
      confirmPassword: "valid-password",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });
});
