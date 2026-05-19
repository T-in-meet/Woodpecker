import { describe, expect, it } from "vitest";

import { authEmailActionSchema } from "./authEmailActionSchema";

describe("authEmailActionSchema", () => {
  it("TC-01. 유효한 입력이면 통과한다", () => {
    const result = authEmailActionSchema.safeParse({
      email: "test@example.com",
      purpose: "signup",
      redirect: "/reset-password",
    });

    expect(result.success).toBe(true);
  });

  it("TC-02. redirect 없이도 통과한다", () => {
    const result = authEmailActionSchema.safeParse({
      email: "test@example.com",
      purpose: "reset-password",
    });

    expect(result.success).toBe(true);
  });

  it("TC-03. 유효하지 않은 purpose면 실패한다", () => {
    const result = authEmailActionSchema.safeParse({
      email: "test@example.com",
      purpose: "invalid-purpose",
    });

    expect(result.success).toBe(false);
  });

  it("TC-04. 유효하지 않은 이메일이면 실패한다", () => {
    const result = authEmailActionSchema.safeParse({
      email: "invalid-email",
      purpose: "signup",
    });

    expect(result.success).toBe(false);
  });
});
