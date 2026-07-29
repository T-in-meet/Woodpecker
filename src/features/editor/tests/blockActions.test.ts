import "./setup";

import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  canMoveSelectedBlock,
  insertHorizontalRule,
  moveSelectedBlock,
} from "../utils/blockActions";
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

describe("insertHorizontalRule", () => {
  /** 텍스트가 일치하는 노드를 NodeSelection으로 선택한다. */
  function selectNodeByText(
    editor: TipTapEditorInstance,
    typeName: string,
    text: string,
  ) {
    let position = -1;

    editor.state.doc.descendants((node, nodePosition) => {
      if (node.type.name === typeName && node.textContent.includes(text)) {
        position = nodePosition;
      }

      return true;
    });

    if (position < 0) {
      throw new Error(`${typeName} not found: ${text}`);
    }

    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, position),
      ),
    );
  }

  function setCursorInParagraph(editor: TipTapEditorInstance, text: string) {
    let position = -1;

    editor.state.doc.descendants((node, nodePosition) => {
      if (node.type.name === "paragraph" && node.textContent === text) {
        position = nodePosition + 1;
      }

      return true;
    });

    if (position < 0) {
      throw new Error(`paragraph not found: ${text}`);
    }

    editor.commands.setTextSelection(position);
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // li 스키마가 구분선을 허용하지 않아 setHorizontalRule이 조용히 실패하던 케이스.
  it("splits the list when the selected block is an ordered list item", () => {
    const editor = createMountedEditor("1. 첫\n2. 둘\n3. 셋");

    selectNodeByText(editor, "listItem", "둘");

    expect(insertHorizontalRule(editor as unknown as Editor)).toBe(true);
    expect(editor.getHTML()).toContain("</ol><hr><ol");
    expect(serializeTipTapMarkdown(editor)).toContain("---");

    editor.destroy();
  });

  it("splits a task list the same way", () => {
    const editor = createMountedEditor("- [ ] 첫\n- [ ] 둘");

    selectNodeByText(editor, "taskItem", "첫");

    expect(insertHorizontalRule(editor as unknown as Editor)).toBe(true);
    expect(editor.getHTML()).toContain("<hr>");
    expect(editor.getHTML()).not.toContain("<hr></li>");

    editor.destroy();
  });

  it("does not nest the divider inside the list item when only the cursor is there", () => {
    const editor = createMountedEditor("1. 첫\n2. 둘");

    setCursorInParagraph(editor, "둘");

    expect(insertHorizontalRule(editor as unknown as Editor)).toBe(true);
    expect(editor.getHTML()).not.toContain("<hr><p></p></li>");
    expect(editor.getHTML()).toContain("</ol><hr>");

    editor.destroy();
  });

  it("keeps the default behaviour for a plain paragraph", () => {
    const editor = createMountedEditor("문단");

    selectNodeByText(editor, "paragraph", "문단");

    expect(insertHorizontalRule(editor as unknown as Editor)).toBe(true);
    expect(editor.getHTML()).toContain("<p>문단</p><hr>");

    editor.destroy();
  });
});

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
