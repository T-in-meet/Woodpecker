import { describe, expect, it } from "vitest";

import { redirectPathSchema } from "./redirectPathSchema";

describe("redirectPathSchema", () => {
  it("루트 경로를 허용한다", () => {
    const result = redirectPathSchema.safeParse("/");

    expect(result.success).toBe(true);
  });

  it("일반 내부 경로를 허용한다", () => {
    const result = redirectPathSchema.safeParse("/reset-password");

    expect(result.success).toBe(true);
  });

  it("중첩 내부 경로를 허용한다", () => {
    const result = redirectPathSchema.safeParse("/auth/reset-password");

    expect(result.success).toBe(true);
  });

  it("외부 URL이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("https://evil.com");

    expect(result.success).toBe(false);
  });

  it("http URL이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("http://evil.com");

    expect(result.success).toBe(false);
  });

  it("javascript scheme이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("javascript:alert(1)");

    expect(result.success).toBe(false);
  });

  it("protocol-relative URL이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("//evil.com");

    expect(result.success).toBe(false);
  });

  it("빈 문자열이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("");

    expect(result.success).toBe(false);
  });

  it("상대 경로이면 실패한다", () => {
    const result = redirectPathSchema.safeParse("reset-password");

    expect(result.success).toBe(false);
  });
});
