import { describe, expect, it } from "vitest";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/languages";

import { noteSchema } from "../schema";

describe("noteSchema", () => {
  it("accepts valid note data", () => {
    const result = noteSchema.safeParse({
      title: "Test title",
      content: "Test content",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = noteSchema.safeParse({
      title: "",
      content: "Content",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = noteSchema.safeParse({
      title: "Title",
      content: "",
    });

    expect(result.success).toBe(false);
  });

  describe("language field", () => {
    it("passes without a language", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
      });

      expect(result.success).toBe(true);
    });

    it("accepts a null language", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language: null,
      });

      expect(result.success).toBe(true);
    });

    it.each(NOTE_LANGUAGE_VALUES)("accepts allowed language %s", (language) => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language,
      });

      expect(result.success).toBe(true);
    });

    it("rejects a disallowed language", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language: "ruby",
      });

      expect(result.success).toBe(false);
    });

    it("rejects an empty string language", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language: "",
      });

      expect(result.success).toBe(false);
    });
  });
});
