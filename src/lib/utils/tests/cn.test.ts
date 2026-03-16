import { describe, expect, it } from "vitest";

import { cn } from "../cn";

describe("cn", () => {
  it("단일 클래스를 반환한다", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("여러 클래스를 병합한다", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("falsy 값을 무시한다", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("Tailwind 충돌 클래스를 올바르게 병합한다", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
