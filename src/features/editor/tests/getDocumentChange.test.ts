import { describe, expect, it } from "vitest";

import { getDocumentChange } from "../utils/getDocumentChange";

describe("getDocumentChange", () => {
  it("returns null when the document is unchanged", () => {
    expect(getDocumentChange("same", "same")).toBeNull();
  });

  it("returns an append change when text is added at the end", () => {
    expect(getDocumentChange("abc", "abcdef")).toEqual({
      from: 3,
      to: 3,
      insert: "def",
    });
  });

  it("returns a prepend change when text is added at the start", () => {
    expect(getDocumentChange("world", "hello world")).toEqual({
      from: 0,
      to: 0,
      insert: "hello ",
    });
  });

  it("returns a replacement change for middle edits", () => {
    expect(getDocumentChange("const alpha = 1;", "const beta = 1;")).toEqual({
      from: 6,
      to: 10,
      insert: "bet",
    });
  });

  it("returns a delete change when text is removed", () => {
    expect(getDocumentChange("hello brave world", "hello world")).toEqual({
      from: 6,
      to: 12,
      insert: "",
    });
  });
});
