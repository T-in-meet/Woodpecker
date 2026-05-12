import { describe, expect, it } from "vitest";

import { loginFormSchema } from "../loginFormSchema";

describe("loginFormSchema", () => {
  describe("유효한 입력", () => {
    it("정상적인 email과 password를 통과시킨다", () => {
      const result = loginFormSchema.safeParse({
        email: "test@example.com",
        password: "12345678",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("이메일 검증", () => {
    it("이메일이 없으면 실패한다", () => {
      const result = loginFormSchema.safeParse({
        email: "",
        password: "12345678",
      });

      expect(result.success).toBe(false);
    });

    it("이메일 형식이 아니면 실패한다", () => {
      const result = loginFormSchema.safeParse({
        email: "invalid-email",
        password: "12345678",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("비밀번호 검증", () => {
    it("비밀번호가 없으면 실패한다", () => {
      const result = loginFormSchema.safeParse({
        email: "test@example.com",
        password: "",
      });

      expect(result.success).toBe(false);
    });

    it("비밀번호가 최소 길이보다 짧으면 실패한다", () => {
      const result = loginFormSchema.safeParse({
        email: "test@example.com",
        password: "123",
      });

      expect(result.success).toBe(false);
    });
  });
});
