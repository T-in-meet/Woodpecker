import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { withNoteBlockBackgroundMarkers } from "./noteBlockBackground";

type MarkdownStorage = {
  markdown:
    | {
        serializer: {
          serialize: (content: ProseMirrorNode) => string;
        };
      }
    | undefined;
};

const ESCAPED_CHECKBOX_MARKER_PATTERN =
  /^(\s*(?:[-+*]|\d+\.)\s+)\\\[( |x|X)\\\] (.*)$/;

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

function normalizeEscapedCheckboxMarkers(markdown: string): string {
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

      if (/^\s*```/.test(unquotedLine)) {
        isInsideQuotedFence = !isInsideQuotedFence;
      }

      const shouldStripEscape =
        !isInsideQuotedFence &&
        currentLine.startsWith(">") &&
        currentLine.endsWith("\\") &&
        nextLine?.startsWith(">");

      return shouldStripEscape ? currentLine.slice(0, -1) : currentLine;
    })
    .join("\n");
}

function getRawTipTapMarkdown(editor: Editor): string {
  const storage = editor.storage as Partial<MarkdownStorage> | undefined;

  if (!storage?.markdown?.serializer) {
    throw new Error(
      "TipTap Markdown extension is required to serialize editor content.",
    );
  }

  // 블록 배경 attribute는 마크다운에 직접 표현할 수 없어, 직렬화 직전에
  // 본문 앞 마커 텍스트로 바꿔 넣는다.
  return storage.markdown.serializer.serialize(
    withNoteBlockBackgroundMarkers(editor.state.doc),
  );
}

// TipTap 직렬화기가 자기 출력에 주입하는 공백/줄바꿈 아티팩트를 정리한다.
// 여기서는 사용자가 입력한 escape(예: literal `\[x\]`)를 건드리지 않는다.
export function normalizeTipTapSerializerOutput(markdown: string): string {
  return normalizeBlockquoteLineBreaks(normalizeTaskListSpacing(markdown));
}

// 과거 저장 사이클에서 task marker가 `\[x\]` 형태로 이스케이프되어 굳은 데이터를 복구한다.
// 사용자 리터럴 escape와 구분할 수 없으므로 일반 에디터/뷰어 입력 경계에서는 자동 적용하지 않는다.
export function recoverLegacyTaskMarkers(markdown: string): string {
  return normalizeEscapedCheckboxMarkers(markdown);
}

export function serializeTipTapMarkdown(editor: Editor): string {
  return normalizeTipTapSerializerOutput(getRawTipTapMarkdown(editor));
}
