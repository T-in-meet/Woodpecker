import { describe, expect, it } from "vitest";

import { createAiSha256Hash } from "../hash";

describe("createAiSha256Hash", () => {
  it("동일한 입력은 항상 동일한 해시를 생성한다", () => {
    expect(createAiSha256Hash("hello")).toBe(createAiSha256Hash("hello"));
  });

  it("다른 입력은 다른 해시를 생성한다", () => {
    expect(createAiSha256Hash("hello")).not.toBe(createAiSha256Hash("world"));
  });

  it("SHA-256 hex 문자열을 반환한다", () => {
    expect(createAiSha256Hash("hello")).toMatch(/^[a-f0-9]{64}$/);
  });
});
