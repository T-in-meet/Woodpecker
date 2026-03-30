import { describe, expect, it } from "vitest";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";

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

  it("rejects a whitespace-only title", () => {
    const result = noteSchema.safeParse({
      title: "   ",
      content: "Content",
    });

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    const result = noteSchema.safeParse({
      title: "Title",
      content: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects content exceeding 50000 characters", () => {
    const result = noteSchema.safeParse({
      title: "Title",
      content: "a".repeat(50001),
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

    it.each(NOTE_LANGUAGE_VALUES)(
      "accepts allowed language %s",
      (...[language]) => {
        const result = noteSchema.safeParse({
          title: "Title",
          content: "Content",
          language,
        });

        expect(result.success).toBe(true);
      },
    );

    it("rejects a disallowed language", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language: "ruby",
      });

      expect(result.success).toBe(false);
    });

    it("coerces an empty string language to null", () => {
      const result = noteSchema.safeParse({
        title: "Title",
        content: "Content",
        language: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBeNull();
      }
    });
  });

  it("trims surrounding whitespace from the title", () => {
    const result = noteSchema.safeParse({
      title: "  Title  ",
      content: "Content",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Title");
    }
  });
});
