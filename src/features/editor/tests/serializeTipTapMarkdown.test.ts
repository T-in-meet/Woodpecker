import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
  normalizeTipTapMarkdown,
  normalizeTipTapMarkdownWithHistory,
  serializeTipTapMarkdown,
} from "../utils/serializeTipTapMarkdown";

describe("escaped checkbox markers", () => {
  it("preserves escaped checkbox markers when the previous markdown was escaped", () => {
    const previousMarkdown = "- \\[ \\] todo\n- \\[x\\] done";
    const input = "- \\[ \\] todo updated\n- \\[x\\] done updated";

    expect(normalizeTipTapMarkdownWithHistory(input, previousMarkdown)).toBe(
      input,
    );
  });

  it("restores checkbox markers when the previous markdown used task syntax", () => {
    const previousMarkdown = "- [ ] todo\n- [x] done";
    const input = "- \\[ \\] todo updated\n- \\[x\\] done updated";

    expect(normalizeTipTapMarkdownWithHistory(input, previousMarkdown)).toBe(
      "- [ ] todo updated\n- [x] done updated",
    );
  });

  it("keeps escaped checkbox markers by default when there is no history", () => {
    const input = "1. \\[ \\] first\n2. \\[x\\] second";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("does not alter already-unescaped checkboxes", () => {
    const input = "- [ ] already fine\n- [x] also fine";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("does not alter non-list escaped brackets", () => {
    const input = "Some text with \\[brackets\\] inline";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });
});

describe("normalizeTaskListSpacing", () => {
  it("removes blank lines between same-indent task items", () => {
    const input = "- [ ] a\n\n- [ ] b";
    expect(normalizeTipTapMarkdown(input)).toBe("- [ ] a\n- [ ] b");
  });

  it("preserves blank lines between different-indent task items", () => {
    const input = "- [ ] a\n\n  - [ ] nested";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("preserves blank lines between task item and non-task content", () => {
    const input = "- [ ] a\n\nsome paragraph";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("preserves blank lines between non-task content", () => {
    const input = "paragraph one\n\nparagraph two";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("handles empty document", () => {
    expect(normalizeTipTapMarkdown("")).toBe("");
  });

  it("keeps double blank lines between same-indent tasks (single-pass limitation)", () => {
    const input = "- [x] done\n\n\n- [ ] todo";
    // 단일 패스이므로 첫 번째 빈 줄의 next가 빈 줄이라 task가 아님 → 유지됨
    expect(normalizeTipTapMarkdown(input)).toBe("- [x] done\n\n\n- [ ] todo");
  });
});

describe("normalizeBlockquoteLineBreaks", () => {
  it("strips trailing backslash between blockquote lines", () => {
    const input = "> line one\\\n> line two";
    expect(normalizeTipTapMarkdown(input)).toBe("> line one\n> line two");
  });

  it("does not strip backslash when next line is not a blockquote", () => {
    const input = "> line one\\\nnormal line";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("does not strip backslash inside a fenced code block within blockquote", () => {
    const input = "> ```\n> code\\\n> more code\n> ```";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("does not strip backslash from non-blockquote lines", () => {
    const input = "normal line\\";
    expect(normalizeTipTapMarkdown(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(normalizeTipTapMarkdown("")).toBe("");
  });
});

describe("normalizeTipTapMarkdown composition", () => {
  it("applies all normalizations together", () => {
    const input = "- [ ] task a\n\n- [x] task b\n\n> quote line\\\n> continued";
    const expected = "- [ ] task a\n- [x] task b\n\n> quote line\n> continued";
    expect(normalizeTipTapMarkdown(input)).toBe(expected);
  });
});

describe("serializeTipTapMarkdown", () => {
  it("throws when the Markdown extension storage is missing", () => {
    const editor = { storage: {} } as Editor;

    expect(() => serializeTipTapMarkdown(editor)).toThrow(
      "TipTap Markdown extension is required to serialize editor content.",
    );
  });
});
