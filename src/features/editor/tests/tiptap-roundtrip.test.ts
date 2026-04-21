import "@/tests/setup";

import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { serializeTipTapMarkdown } from "../utils/serializeTipTapMarkdown";
import { getTipTapExtensions } from "../utils/tiptapExtensions";

/**
 * Phase 0: TipTap round-trip 검증 스파이크
 *
 * markdown → TipTap → markdown 변환 결과가 허용 가능한 수준인지 확인한다.
 */

const fixtures: { name: string; input: string }[] = [
  {
    name: "headings",
    input: "# H1\n\n## H2\n\n### H3",
  },
  {
    name: "unordered list",
    input: "- item 1\n- item 2\n- item 3",
  },
  {
    name: "ordered list",
    input: "1. first\n2. second\n3. third",
  },
  {
    name: "task list",
    input: "- [ ] todo\n- [x] done",
  },
  {
    name: "inline formatting",
    input: "This has **bold**, *italic*, ~~strikethrough~~, and `inline code`.",
  },
  {
    name: "fenced code block",
    input: "```javascript\nconst x = 1;\nconsole.log(x);\n```",
  },
  {
    name: "blockquote",
    input: "> This is a quote\n> with two lines",
  },
  {
    name: "horizontal rule",
    input: "before\n\n---\n\nafter",
  },
  {
    name: "empty content",
    input: "",
  },
  {
    name: "paragraphs separated by blank lines",
    input: "paragraph one\n\nparagraph two",
  },
  {
    name: "nested list",
    input: "- parent\n  - child\n  - child 2\n- parent 2",
  },
  {
    name: "table",
    input: "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |",
  },
  {
    name: "mixed content",
    input:
      "# Title\n\nSome text with **bold** and *italic*.\n\n- list item\n- [ ] task\n\n```python\nprint('hello')\n```\n\n> quote\n\n---\n\nEnd.",
  },
];

function createHeadlessEditor(content: string): Editor {
  return new Editor({
    extensions: getTipTapExtensions(),
    content,
    editable: false,
  });
}

function roundTrip(markdown: string): string {
  const editor = createHeadlessEditor(markdown);
  const result = serializeTipTapMarkdown(editor);
  editor.destroy();
  return result;
}

describe("TipTap markdown round-trip", () => {
  for (const fixture of fixtures) {
    it(`round-trips: ${fixture.name}`, () => {
      const result = roundTrip(fixture.input);

      expect(result.trim()).toBe(fixture.input.trim());
    });
  }
});
