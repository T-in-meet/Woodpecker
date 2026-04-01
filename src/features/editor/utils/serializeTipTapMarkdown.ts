import type { Editor } from "@tiptap/core";

type MarkdownStorage = {
  markdown:
    | {
        getMarkdown: () => string;
      }
    | undefined;
};

const ESCAPED_CHECKBOX_MARKER_PATTERN =
  /^(\s*(?:[-+*]|\d+\.)\s+)\\\[( |x|X)\\\] (.*)$/;
const UNESCAPED_CHECKBOX_MARKER_PATTERN =
  /^(\s*(?:[-+*]|\d+\.)\s+)\[( |x|X)\] (.*)$/;

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

function normalizeEscapedCheckboxMarkers(
  markdown: string,
  previousMarkdown?: string,
): string {
  const previousLines = previousMarkdown?.split("\n") ?? [];

  return markdown
    .split("\n")
    .map((line, index) => {
      const match = line.match(ESCAPED_CHECKBOX_MARKER_PATTERN);

      if (!match) return line;

      const previousLine = previousLines[index];

      if (previousLine?.match(ESCAPED_CHECKBOX_MARKER_PATTERN)) {
        return line;
      }

      if (previousLine?.match(UNESCAPED_CHECKBOX_MARKER_PATTERN)) {
        return line.replace(ESCAPED_CHECKBOX_MARKER_PATTERN, "$1[$2] $3");
      }

      return line;
    })
    .join("\n");
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
  const storage = editor.storage as Partial<MarkdownStorage> | undefined;

  if (!storage?.markdown?.getMarkdown) {
    throw new Error(
      "TipTap Markdown extension is required to serialize editor content.",
    );
  }

  return storage.markdown.getMarkdown();
}

export function normalizeTipTapMarkdown(markdown: string): string {
  return normalizeTipTapMarkdownWithHistory(markdown);
}

export function normalizeTipTapMarkdownWithHistory(
  markdown: string,
  previousMarkdown?: string,
): string {
  return normalizeBlockquoteLineBreaks(
    normalizeTaskListSpacing(
      normalizeEscapedCheckboxMarkers(markdown, previousMarkdown),
    ),
  );
}

export function serializeTipTapMarkdown(
  editor: Editor,
  previousMarkdown?: string,
): string {
  return normalizeTipTapMarkdownWithHistory(
    getRawTipTapMarkdown(editor),
    previousMarkdown,
  );
}
