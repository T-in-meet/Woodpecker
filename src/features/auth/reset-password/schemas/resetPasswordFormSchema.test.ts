import { describe, expect, it } from "vitest";

import { resetPasswordFormSchema } from "./resetPasswordFormSchema";

describe("resetPasswordFormSchema", () => {
  it("유효한 password와 confirmPassword이면 성공한다", () => {
    const result = resetPasswordFormSchema.safeParse({
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("password와 confirmPassword가 다르면 confirmPassword 에러를 반환한다", () => {
    const result = resetPasswordFormSchema.safeParse({
      password: "password123",
      confirmPassword: "password456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["confirmPassword"],
          }),
        ]),
      );
    }
  });

  it("정의되지 않은 extra field가 있으면 실패한다", () => {
    const result = resetPasswordFormSchema.safeParse({
      password: "password123",
      confirmPassword: "password123",
      redirectTo: "/mypage",
    });

    expect(result.success).toBe(false);
  });
});
