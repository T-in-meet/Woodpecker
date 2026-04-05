import { describe, expect, it } from "vitest";

import { signupInputSchema } from "./schema";

describe("signupSchema", () => {
  it("비밀번호가 일치하지 않으면 거부한다", () => {
    const result = signupInputSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
  });
});
