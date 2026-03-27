import {
  type ChangeSpec,
  EditorSelection,
  EditorState,
  type Extension,
  type SelectionRange,
} from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";

const MARKDOWN_TAB_INDENT = "  ";

export function getReadOnlyExtension(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

export function getPlaceholderExtension(placeholderText?: string): Extension {
  return placeholderText ? placeholder(placeholderText) : [];
}

export function getAriaLabelExtension(ariaLabel?: string): Extension {
  return ariaLabel
    ? EditorView.contentAttributes.of({ "aria-label": ariaLabel })
    : [];
}

export function getMarkdownTabIndentResult(
  state: EditorState,
  range: SelectionRange,
): {
  changes: ChangeSpec | ChangeSpec[];
  range: SelectionRange;
} {
  if (range.empty) {
    return {
      changes: { from: range.from, insert: MARKDOWN_TAB_INDENT },
      range: EditorSelection.cursor(range.from + MARKDOWN_TAB_INDENT.length),
    };
  }

  const startLine = state.doc.lineAt(range.from);
  const rawEndLine = state.doc.lineAt(range.to);
  const endLine =
    range.to > range.from && range.to === rawEndLine.from
      ? state.doc.line(rawEndLine.number - 1)
      : rawEndLine;
  const changes: ChangeSpec[] = [];
  let anchor = range.anchor;
  let head = range.head;

  for (
    let lineNumber = startLine.number;
    lineNumber <= endLine.number;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);
    changes.push({ from: line.from, insert: MARKDOWN_TAB_INDENT });

    if (line.from <= anchor) {
      anchor += MARKDOWN_TAB_INDENT.length;
    }

    if (line.from <= head) {
      head += MARKDOWN_TAB_INDENT.length;
    }
  }

  return {
    changes,
    range: EditorSelection.range(anchor, head),
  };
}
