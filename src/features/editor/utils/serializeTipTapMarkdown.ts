import type { Editor } from "@tiptap/core";

type MarkdownStorage = {
  markdown: {
    getMarkdown: () => string;
  };
};

function getTaskItemIndent(line: string | undefined): string | null {
  if (!line) return null;

  const match = line.match(/^(\s*)- \[[ xX]\] /);

  return match?.[1] ?? null;
}

function normalizeTaskListSpacing(markdown: string): string {
  const lines = markdown.split("\n");
  const normalizedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (line === "") {
      const previousTaskIndent = getTaskItemIndent(
        normalizedLines[normalizedLines.length - 1],
      );
      const nextTaskIndent = getTaskItemIndent(lines[index + 1]);

      if (
        previousTaskIndent !== null &&
        nextTaskIndent !== null &&
        previousTaskIndent === nextTaskIndent
      ) {
        continue;
      }
    }

    normalizedLines.push(line);
  }

  return normalizedLines.join("\n");
}

function normalizeEscapedCheckboxMarkers(markdown: string): string {
  return markdown.replace(
    /^(\s*(?:[-+*]|\d+\.)\s+)\\\[( |x|X)\\\] /gm,
    "$1[$2] ",
  );
}

function normalizeBlockquoteLineBreaks(markdown: string): string {
  const lines = markdown.split("\n");
  let isInsideQuotedFence = false;

  return lines
    .map((line, index) => {
      const currentLine = line ?? "";
      const unquotedLine = currentLine.replace(/^(>\s?)+/, "");
      const nextLine = lines[index + 1];
      const shouldStripEscape =
        !isInsideQuotedFence &&
        currentLine.startsWith(">") &&
        currentLine.endsWith("\\") &&
        nextLine?.startsWith(">");

      if (/^```/.test(unquotedLine)) {
        isInsideQuotedFence = !isInsideQuotedFence;
      }

      return shouldStripEscape ? currentLine.slice(0, -1) : currentLine;
    })
    .join("\n");
}

function getRawTipTapMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

export function normalizeTipTapMarkdown(markdown: string): string {
  return normalizeBlockquoteLineBreaks(
    normalizeTaskListSpacing(normalizeEscapedCheckboxMarkers(markdown)),
  );
}

export function serializeTipTapMarkdown(editor: Editor): string {
  return normalizeTipTapMarkdown(getRawTipTapMarkdown(editor));
}
