import { describe, expect, it } from "vitest";

import { profileSchema } from "../schema";

describe("profileSchema", () => {
  it("유효한 프로필 데이터를 통과시킨다", () => {
    const result = profileSchema.safeParse({
      username: "홍길동",
      bio: "안녕하세요",
    });
    expect(result.success).toBe(true);
  });

  it("2자 미만 사용자명을 거부한다", () => {
    const result = profileSchema.safeParse({ username: "a" });
    expect(result.success).toBe(false);
  });

  it("200자 초과 소개를 거부한다", () => {
    const result = profileSchema.safeParse({
      username: "홍길동",
      bio: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});
