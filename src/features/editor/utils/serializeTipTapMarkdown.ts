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
      let nextNonEmptyIndex = index + 1;
      while (
        nextNonEmptyIndex < lines.length &&
        lines[nextNonEmptyIndex] === ""
      ) {
        nextNonEmptyIndex += 1;
      }

      const previousTaskIndent = getTaskItemIndent(
        normalizedLines[normalizedLines.length - 1],
      );
      const nextTaskIndent = getTaskItemIndent(lines[nextNonEmptyIndex]);

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

function detectCheckboxStyle(markdown: string): "escaped" | "unescaped" | null {
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (UNESCAPED_CHECKBOX_MARKER_PATTERN.test(line)) return "unescaped";
    if (ESCAPED_CHECKBOX_MARKER_PATTERN.test(line)) return "escaped";
  }

  return null;
}

function normalizeEscapedCheckboxMarkers(
  markdown: string,
  previousMarkdown?: string,
): string {
  const previousStyle = previousMarkdown
    ? detectCheckboxStyle(previousMarkdown)
    : null;

  if (previousStyle !== "unescaped") return markdown;

  return markdown
    .split("\n")
    .map((line) => {
      if (!ESCAPED_CHECKBOX_MARKER_PATTERN.test(line)) return line;

      return line.replace(ESCAPED_CHECKBOX_MARKER_PATTERN, "$1[$2] $3");
    })
    .join("\n");
}

// serialize 과정에서 TipTap이 삽입한 trailing backslash만 제거하는 것이 이상적이나,
// 현재는 사용자 입력과 구분할 수 없어 blockquote 끝 backslash를 일괄 제거한다.
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

      if (/^\s*```/.test(unquotedLine)) {
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
