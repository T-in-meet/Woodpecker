import "./setup";

import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import { canMoveSelectedBlock, moveSelectedBlock } from "../utils/blockActions";
import { serializeTipTapMarkdown } from "../utils/serializeTipTapMarkdown";
import { getTipTapExtensions } from "../utils/tiptapExtensions";

function createMountedEditor(content: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);

  return new TipTapEditorInstance({
    element,
    extensions: getTipTapExtensions(),
    content,
  });
}

/** index번째 최상위 블록을 NodeSelection으로 선택한다. */
function selectTopLevelBlock(editor: TipTapEditorInstance, index: number) {
  const { doc } = editor.state;
  const position = doc.resolve(0).posAtIndex(index);

  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(doc, position)),
  );
}

describe("moveSelectedBlock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the selected block up and keeps it selected", () => {
    const editor = createMountedEditor("first\n\nsecond\n\nthird");

    selectTopLevelBlock(editor, 1);

    expect(moveSelectedBlock(editor as unknown as Editor, "up")).toBe(true);
    expect(serializeTipTapMarkdown(editor)).toBe("second\n\nfirst\n\nthird");
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(
      editor.state.selection.content().content.firstChild?.textContent,
    ).toBe("second");

    editor.destroy();
  });

  it("moves the selected block down", () => {
    const editor = createMountedEditor("first\n\nsecond\n\nthird");

    selectTopLevelBlock(editor, 1);

    expect(moveSelectedBlock(editor as unknown as Editor, "down")).toBe(true);
    expect(serializeTipTapMarkdown(editor)).toBe("first\n\nthird\n\nsecond");

    editor.destroy();
  });

  it("does nothing at the document edges", () => {
    const editor = createMountedEditor("first\n\nsecond");

    selectTopLevelBlock(editor, 0);

    expect(canMoveSelectedBlock(editor as unknown as Editor, "up")).toBe(false);
    expect(moveSelectedBlock(editor as unknown as Editor, "up")).toBe(false);
    expect(serializeTipTapMarkdown(editor)).toBe("first\n\nsecond");

    editor.destroy();
  });

  it("does nothing when the selection is not a block selection", () => {
    const editor = createMountedEditor("first\n\nsecond");

    editor.commands.setTextSelection(2);

    expect(canMoveSelectedBlock(editor as unknown as Editor, "down")).toBe(
      false,
    );
    expect(moveSelectedBlock(editor as unknown as Editor, "down")).toBe(false);

    editor.destroy();
  });
});
