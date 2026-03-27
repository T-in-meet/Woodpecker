import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { getMarkdownTabIndentResult } from "../utils/editorExtensions";

function applyMarkdownTabIndent(doc: string, anchor: number, head = anchor) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  const result = getMarkdownTabIndentResult(state, state.selection.main);
  const nextState = state.update({
    changes: result.changes,
    selection: result.range,
  }).state;

  return {
    doc: nextState.doc.toString(),
    selection: nextState.selection.main,
  };
}

describe("getMarkdownTabIndentResult", () => {
  it("inserts two spaces at the cursor when the selection is empty", () => {
    expect(applyMarkdownTabIndent("hello", 0)).toMatchObject({
      doc: "  hello",
      selection: { anchor: 2, head: 2 },
    });
  });

  it("preserves the selected text while indenting each selected line", () => {
    expect(applyMarkdownTabIndent("alpha\nbeta", 1, 8)).toMatchObject({
      doc: "  alpha\n  beta",
      selection: { anchor: 3, head: 12 },
    });
  });

  it("does not indent the next line when the selection ends at its start", () => {
    expect(applyMarkdownTabIndent("alpha\nbeta", 0, 6)).toMatchObject({
      doc: "  alpha\nbeta",
      selection: { anchor: 2, head: 8 },
    });
  });

  it("correctly shifts anchor/head when anchor is at a line boundary", () => {
    // anchor at end of line 1 (pos 5 = newline boundary), head in line 3
    // "alpha\nbeta\ngamma" → positions: alpha=0-4, \n=5, beta=6-9, \n=10, gamma=11-15
    expect(applyMarkdownTabIndent("alpha\nbeta\ngamma", 5, 14)).toMatchObject({
      doc: "  alpha\n  beta\n  gamma",
      selection: { anchor: 7, head: 20 },
    });
  });
});
