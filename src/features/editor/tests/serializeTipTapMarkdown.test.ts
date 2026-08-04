import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
  normalizeTipTapSerializerOutput,
  recoverLegacyTaskMarkers,
  serializeTipTapMarkdown,
} from "../utils/serializeTipTapMarkdown";

describe("recoverLegacyTaskMarkers", () => {
  it("restores escaped checkbox markers", () => {
    const input = "- \\[ \\] todo updated\n- \\[x\\] done updated";

    expect(recoverLegacyTaskMarkers(input)).toBe(
      "- [ ] todo updated\n- [x] done updated",
    );
  });

  it("restores uppercase checked checkbox markers", () => {
    expect(recoverLegacyTaskMarkers("- \\[X\\] done")).toBe("- [X] done");
  });

  it("restores escaped ordered checkbox markers", () => {
    const input = "1. \\[ \\] first\n2. \\[x\\] second";
    expect(recoverLegacyTaskMarkers(input)).toBe("1. [ ] first\n2. [x] second");
  });

  it("does not alter already-unescaped checkboxes", () => {
    const input = "- [ ] already fine\n- [x] also fine";
    expect(recoverLegacyTaskMarkers(input)).toBe(input);
  });

  it("does not alter non-list escaped brackets", () => {
    const input = "Some text with \\[brackets\\] inline";
    expect(recoverLegacyTaskMarkers(input)).toBe(input);
  });

  // scope isolation: blockquote / spacing 아티팩트는 건드리지 않는다
  it("does not touch blockquote trailing backslashes", () => {
    const input = "> line one\\\n> line two";
    expect(recoverLegacyTaskMarkers(input)).toBe(input);
  });

  it("does not touch blank lines between same-indent task items", () => {
    const input = "- [ ] a\n\n- [ ] b";
    expect(recoverLegacyTaskMarkers(input)).toBe(input);
  });
});

describe("normalizeTipTapSerializerOutput", () => {
  describe("line endings", () => {
    it("converts CRLF to LF", () => {
      const input = "1. 과일\r\n   1. 사과\r\n\r\n- 동물\r\n  - 소";
      expect(normalizeTipTapSerializerOutput(input)).toBe(
        "1. 과일\n   1. 사과\n\n- 동물\n  - 소",
      );
    });

    it("converts a lone CR to LF", () => {
      expect(normalizeTipTapSerializerOutput("- a\r- b")).toBe("- a\n- b");
    });

    it("removes blank CRLF lines between same-indent task items", () => {
      const input = "- [ ] a\r\n\r\n- [ ] b";
      expect(normalizeTipTapSerializerOutput(input)).toBe("- [ ] a\n- [ ] b");
    });
  });

  describe("task list spacing", () => {
    it("removes blank lines between same-indent task items", () => {
      const input = "- [ ] a\n\n- [ ] b";
      expect(normalizeTipTapSerializerOutput(input)).toBe("- [ ] a\n- [ ] b");
    });

    it("preserves blank lines between different-indent task items", () => {
      const input = "- [ ] a\n\n  - [ ] nested";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("preserves blank lines between task item and non-task content", () => {
      const input = "- [ ] a\n\nsome paragraph";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("preserves blank lines between non-task content", () => {
      const input = "paragraph one\n\nparagraph two";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("handles empty document", () => {
      expect(normalizeTipTapSerializerOutput("")).toBe("");
    });

    it("collapses double blank lines between same-indent tasks", () => {
      const input = "- [x] done\n\n\n- [ ] todo";
      expect(normalizeTipTapSerializerOutput(input)).toBe(
        "- [x] done\n- [ ] todo",
      );
    });
  });

  describe("blockquote line breaks", () => {
    it("strips trailing backslash between blockquote lines", () => {
      const input = "> line one\\\n> line two";
      expect(normalizeTipTapSerializerOutput(input)).toBe(
        "> line one\n> line two",
      );
    });

    it("does not strip backslash when next line is not a blockquote", () => {
      const input = "> line one\\\nnormal line";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("does not strip backslash inside a fenced code block within blockquote", () => {
      const input = "> ```\n> code\\\n> more code\n> ```";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("does not strip backslash inside an indented fenced code block within blockquote", () => {
      const input = "> ```\n>   code\\\n>   more code\n> ```";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("does not strip backslash from non-blockquote lines", () => {
      const input = "normal line\\";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("handles empty string", () => {
      expect(normalizeTipTapSerializerOutput("")).toBe("");
    });
  });

  // scope isolation: 사용자가 입력한 literal escape는 보존한다
  describe("preserves user-input literal escapes", () => {
    it("leaves list-prefix escaped task markers intact (no legacy recovery in serialize path)", () => {
      const input = "- \\[ \\] literal\n- \\[x\\] literal";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("leaves ordered-list escaped task markers intact", () => {
      const input = "1. \\[ \\] first\n2. \\[x\\] second";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });

    it("leaves inline escaped brackets intact", () => {
      const input = "Some text with \\[brackets\\] inline";
      expect(normalizeTipTapSerializerOutput(input)).toBe(input);
    });
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
