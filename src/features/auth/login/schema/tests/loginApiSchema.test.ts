import { describe, expect, it } from "vitest";

import { loginApiSchema } from "@/features/auth/login/schema/loginApiSchema";

describe("loginApiSchema — 로그인 API 입력 검증", () => {
  describe("유효한 입력", () => {
    it("올바른 이메일과 비밀번호가 있으면 파싱에 성공한다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
    });

    it("이메일 앞뒤 공백은 trim된 뒤 검증에 성공한다", () => {
      const result = loginApiSchema.safeParse({
        email: "  user@example.com  ",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // normalizedEmailSchema의 preprocess가 trim을 수행하므로 공백이 제거된 값을 반환해야 한다
        expect(result.data.email).toBe("user@example.com");
      }
    });
  });

  describe("이메일 필드 유효성 실패", () => {
    it("이메일 형식이 아니면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });

      expect(result.success).toBe(false);
    });

    it("이메일이 빈 문자열이면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "",
        password: "password123",
      });

      expect(result.success).toBe(false);
    });

    it("이메일이 누락되면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        password: "password123",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("비밀번호 필드 유효성 실패", () => {
    it("비밀번호가 누락되면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
      });

      expect(result.success).toBe(false);
    });

    it("비밀번호가 빈 문자열이면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
        password: "",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("비밀번호 정규화 — password는 trim하지 않는다", () => {
    it("비밀번호 앞뒤 공백은 그대로 유지된다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
        password: "  pass1234  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // 비밀번호는 사용자 의도 그대로 보존해야 하므로 trim 금지
        expect(result.data.password).toBe("  pass1234  ");
      }
    });
  });

  describe("strict mode — 허용되지 않은 필드는 거부된다", () => {
    it("extra field가 포함되면 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        extraField: "should-be-rejected",
      });

      expect(result.success).toBe(false);
    });

    it("nickname 필드가 포함되어도 파싱에 실패한다", () => {
      const result = loginApiSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        nickname: "user",
      });

      expect(result.success).toBe(false);
    });
  });
});
