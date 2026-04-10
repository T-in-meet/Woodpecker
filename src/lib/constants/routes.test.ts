import { describe, expect, it } from "vitest";

import { getNoteDetailRoute, getNoteReviewRoute } from "./routes";

describe("routes", () => {
  it("builds note detail and review routes", () => {
    expect(getNoteDetailRoute("note-123")).toBe("/notes/note-123");
    expect(getNoteReviewRoute("note-123")).toBe("/notes/note-123/review");
  });
});
