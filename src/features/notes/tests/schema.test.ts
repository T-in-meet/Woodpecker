import { describe, expect, it } from "vitest";

import { recordSchema } from "../schema";

describe("recordSchema", () => {
  it("유효한 기록 데이터를 통과시킨다", () => {
    const result = recordSchema.safeParse({
      title: "테스트 제목",
      content: "테스트 내용",
    });
    expect(result.success).toBe(true);
  });

  it("빈 제목을 거부한다", () => {
    const result = recordSchema.safeParse({
      title: "",
      content: "내용",
    });
    expect(result.success).toBe(false);
  });

  it("빈 내용을 거부한다", () => {
    const result = recordSchema.safeParse({
      title: "제목",
      content: "",
    });
    expect(result.success).toBe(false);
  });
});
