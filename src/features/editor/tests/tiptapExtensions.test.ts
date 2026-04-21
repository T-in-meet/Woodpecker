import "@/tests/setup";

import { Editor, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { serializeTipTapMarkdown } from "../utils/serializeTipTapMarkdown";
import {
  getReadOnlyTipTapExtensions,
  getTipTapExtensions,
} from "../utils/tiptapExtensions";

function createEditor(
  content: string | JSONContent,
  extensions = getTipTapExtensions(),
) {
  return new Editor({ extensions, content, editable: false });
}

function roundTrip(markdown: string): string {
  const editor = createEditor(markdown);
  const result = serializeTipTapMarkdown(editor);
  editor.destroy();
  return result;
}

function findTextStartPosition(editor: Editor, text: string): number {
  let position: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(text)) {
      position = pos;
      return false;
    }

    return true;
  });

  if (position === null) {
    throw new Error(`text node not found: ${text}`);
  }

  return position;
}

describe("MarkdownTaskItem custom extension", () => {
  it("round-trips a pure task list", () => {
    const input = "- [ ] todo\n- [x] done";
    expect(roundTrip(input).trim()).toBe(input);
  });

  it("round-trips markdown images", () => {
    const input = "![Architecture diagram](https://example.com/diagram.png)";
    expect(roundTrip(input).trim()).toBe(input);
  });

  it("normalizes angle-bracket markdown image destinations during round-trip", () => {
    const input =
      "![Dog](<https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&s>)";
    expect(roundTrip(input).trim()).toBe(
      "![Dog](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&s)",
    );
  });

  it("normalizes bare markdown image hosts to https during round-trip", () => {
    const input = "![Architecture diagram](example.com/diagram.png)";
    expect(roundTrip(input).trim()).toBe(
      "![Architecture diagram](https://example.com/diagram.png)",
    );
  });

  it("round-trips nested task lists (blank line between different indents)", () => {
    const input = "- [ ] parent\n  - [x] child";
    const result = roundTrip(input).trim();
    // TipTap은 서로 다른 indent 수준 사이에 빈 줄을 삽입함
    expect(result).toContain("[ ] parent");
    expect(result).toContain("[x] child");
  });

  it("preserves a mixed list with regular items and task items", () => {
    const input = "- regular item\n- [ ] task item";
    expect(roundTrip(input).trim()).toBe(input);
  });

  it("preserves checked state", () => {
    const input = "- [x] checked\n- [ ] unchecked";
    const result = roundTrip(input).trim();
    expect(result).toContain("[x] checked");
    expect(result).toContain("[ ] unchecked");
  });

  it("handles empty task list gracefully", () => {
    const input = "";
    expect(roundTrip(input).trim()).toBe("");
  });

  it("normalizes programmatically inserted image URLs during serialization", () => {
    const editor = createEditor("");

    editor.commands.insertContent({
      type: "image",
      attrs: {
        src: "example.com/diagram.png",
        alt: "Architecture diagram",
        title: null,
      },
    });

    expect(serializeTipTapMarkdown(editor).trim()).toBe(
      "![Architecture diagram](https://example.com/diagram.png)",
    );

    editor.destroy();
  });

  it("serializes tables with multi-block cells without placeholder output", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "제목" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "첫 줄" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "둘째 줄" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(serializeTipTapMarkdown(editor).trim()).toBe(
      "| 제목 |\n| --- |\n| 첫 줄 둘째 줄 |",
    );

    editor.destroy();
  });

  it("preserves inline markdown inside table cells while flattening multi-block content", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "제목" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          marks: [{ type: "bold" }],
                          text: "첫 줄",
                        },
                      ],
                    },
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          marks: [
                            {
                              type: "link",
                              attrs: { href: "https://openai.com" },
                            },
                          ],
                          text: "둘째 줄",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(serializeTipTapMarkdown(editor).trim()).toBe(
      "| 제목 |\n| --- |\n| **첫 줄** [둘째 줄](https://openai.com) |",
    );

    editor.destroy();
  });
});

describe("ListItemBackspaceLift", () => {
  it("does not lift the list item from the start of a later paragraph", () => {
    const editor = new Editor({
      extensions: getTipTapExtensions(),
      editable: true,
      content: {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "첫 문단" }],
                  },
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "둘째 문단" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const secondParagraphStart = findTextStartPosition(editor, "둘째 문단");

    editor.commands.setTextSelection(secondParagraphStart);
    editor.commands.keyboardShortcut("Backspace");

    expect(editor.state.doc.firstChild?.type.name).toBe("bulletList");
    expect(editor.getText()).toContain("첫 문단");
    expect(editor.getText()).toContain("둘째 문단");

    editor.destroy();
  });
});

describe("MarkdownTaskItem — isPureTaskListElement edge cases", () => {
  it("converts ordered task list items to plain text markers", () => {
    const input = "1. [ ] ordered task\n2. [x] ordered done";
    const result = roundTrip(input).trim();
    expect(result).toContain("[ ] ordered task");
    expect(result).toContain("[x] ordered done");
  });

  it("does not create checkboxes for a list with no task items", () => {
    const input = "- plain a\n- plain b";
    const result = roundTrip(input).trim();
    expect(result).not.toContain("[");
    expect(result).toContain("plain a");
    expect(result).toContain("plain b");
  });
});

describe("Read-only editor", () => {
  it("marks the editor as non-editable", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "- [ ] task",
      editable: false,
    });

    expect(editor.isEditable).toBe(false);
    editor.destroy();
  });
});

describe("getTipTapExtensions", () => {
  it("includes SlashCommand in editable mode", () => {
    const extensions = getTipTapExtensions();
    const extensionNames = extensions.map((ext) =>
      typeof ext === "object" && "name" in ext ? ext.name : "",
    );

    expect(extensionNames).toContain("slashCommand");
  });
});

describe("getReadOnlyTipTapExtensions", () => {
  it("creates a working editor without SlashCommand and Placeholder", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "# Hello\n\n- [ ] task",
      editable: false,
    });

    const result = serializeTipTapMarkdown(editor);
    expect(result).toContain("# Hello");
    expect(result).toContain("[ ] task");

    editor.destroy();
  });

  it("does not include SlashCommand extension", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const extensionNames = extensions.map((ext) =>
      typeof ext === "object" && "name" in ext ? ext.name : "",
    );
    expect(extensionNames).not.toContain("slashCommand");
  });

  it("does not include Placeholder extension", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const extensionNames = extensions.map((ext) =>
      typeof ext === "object" && "name" in ext ? ext.name : "",
    );
    expect(extensionNames).not.toContain("placeholder");
  });

  it("keeps links clickable in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const linkExtension = extensions.find(
      (ext) => typeof ext === "object" && "name" in ext && ext.name === "link",
    );

    expect(
      (linkExtension?.options as Record<string, unknown>).openOnClick,
    ).toBe(true);
  });

  it("uses the shared link validator for safe relative links", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const linkExtension = extensions.find(
      (ext) => typeof ext === "object" && "name" in ext && ext.name === "link",
    );
    const isAllowedUri = (
      linkExtension?.options as {
        isAllowedUri?: (url: string) => boolean;
      }
    ).isAllowedUri;

    expect(isAllowedUri?.("/docs")).toBe(true);
    expect(isAllowedUri?.("javascript:alert(1)")).toBe(false);
  });

  it("preserves scheme-less links from existing markdown content", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "[Example](example.com)",
      editable: false,
    });

    expect(editor.getHTML()).toContain('href="example.com"');

    editor.destroy();
  });

  it("preserves code block language metadata for the CSS label", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "```typescript\nconst answer = 42;\n```",
      editable: false,
    });

    expect(editor.getHTML()).toContain('data-language="typescript"');
    editor.destroy();
  });

  it("renders safe markdown images in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "![Architecture diagram](https://example.com/diagram.png)",
      editable: false,
    });

    expect(editor.getHTML()).toContain("<img");
    expect(editor.getHTML()).toContain('src="https://example.com/diagram.png"');

    editor.destroy();
  });

  it("normalizes scheme-less markdown images in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "![Architecture diagram](example.com/diagram.png)",
      editable: false,
    });

    expect(editor.getHTML()).toContain('src="https://example.com/diagram.png"');

    editor.destroy();
  });

  it("renders angle-bracket markdown images in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content:
        "![Dog](<https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&s>)",
      editable: false,
    });

    expect(editor.getHTML()).toContain("<img");
    expect(editor.getHTML()).toContain(
      'src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&amp;s"',
    );

    editor.destroy();
  });

  it("filters localhost markdown images in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "![Local image](http://localhost:3000/diagram.png)",
      editable: false,
    });

    expect(editor.getHTML()).not.toContain("<img");

    editor.destroy();
  });

  it("filters unsafe markdown images in readonly mode", () => {
    const extensions = getReadOnlyTipTapExtensions();
    const editor = new Editor({
      extensions,
      content: "![Unsafe image](javascript:alert(1))",
      editable: false,
    });

    expect(editor.getHTML()).not.toContain("<img");

    editor.destroy();
  });
});
