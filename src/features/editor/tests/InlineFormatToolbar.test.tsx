import "./setup";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  InlineFormatToolbarContent,
  shouldShowInlineFormatToolbar,
} from "../components/InlineFormatToolbar";
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

function selectText(editor: TipTapEditorInstance, from: number, to: number) {
  const { view } = editor;

  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
  );
}

function shouldShow(
  editor: TipTapEditorInstance,
  overrides: Partial<{
    isBlockMenuOpen: boolean;
    hasEditorFocus: boolean;
  }> = {},
) {
  const { from, to } = editor.state.selection;

  return shouldShowInlineFormatToolbar({
    editor: editor as unknown as Editor,
    isBlockMenuOpen: overrides.isBlockMenuOpen ?? false,
    hasEditorFocus: overrides.hasEditorFocus ?? true,
    from,
    to,
  });
}

describe("shouldShowInlineFormatToolbar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the toolbar for a non-empty text selection", () => {
    const editor = createMountedEditor("hello world");
    selectText(editor, 1, 6);

    expect(shouldShow(editor)).toBe(true);

    editor.destroy();
  });

  it("hides the toolbar when the selection is collapsed", () => {
    const editor = createMountedEditor("hello world");
    selectText(editor, 3, 3);

    expect(shouldShow(editor)).toBe(false);

    editor.destroy();
  });

  // 블록 핸들 메뉴는 열릴 때 대상 블록에 NodeSelection을 건다.
  // 그 선택까지 인라인 툴바가 잡으면 두 메뉴가 겹쳐 뜬다.
  it("hides the toolbar for a block NodeSelection", () => {
    const editor = createMountedEditor("hello world");
    const { view } = editor;

    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)),
    );

    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    expect(shouldShow(editor)).toBe(false);

    editor.destroy();
  });

  it("hides the toolbar while the block handle menu is open", () => {
    const editor = createMountedEditor("hello world");
    selectText(editor, 1, 6);

    expect(shouldShow(editor, { isBlockMenuOpen: true })).toBe(false);

    editor.destroy();
  });

  it("hides the toolbar inside a code block", () => {
    const editor = createMountedEditor("```\nconst a = 1;\n```");
    selectText(editor, 1, 6);

    expect(editor.isActive("codeBlock")).toBe(true);
    expect(shouldShow(editor)).toBe(false);

    editor.destroy();
  });

  it("hides the toolbar when neither the editor nor the toolbar has focus", () => {
    const editor = createMountedEditor("hello world");
    selectText(editor, 1, 6);

    expect(shouldShow(editor, { hasEditorFocus: false })).toBe(false);

    editor.destroy();
  });

  it("hides the toolbar when the editor is not editable", () => {
    const editor = createMountedEditor("hello world");
    selectText(editor, 1, 6);
    editor.setEditable(false);

    expect(shouldShow(editor)).toBe(false);

    editor.destroy();
  });
});

describe("InlineFormatToolbarContent", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  function renderToolbar(content: string) {
    const editor = createMountedEditor(content);

    render(<InlineFormatToolbarContent editor={editor as unknown as Editor} />);

    return editor;
  }

  it("applies an inline mark to the selected text only", async () => {
    const user = userEvent.setup();
    const editor = renderToolbar("hello world");
    selectText(editor, 1, 6);

    await user.click(screen.getByLabelText("굵게"));

    expect(editor.state.doc.textContent).toBe("hello world");
    // 선택 범위(hello)에만 마크가 붙고 나머지는 그대로다.
    expect(editor.state.doc.rangeHasMark(1, 6, editor.schema.marks.bold!)).toBe(
      true,
    );
    expect(
      editor.state.doc.rangeHasMark(7, 12, editor.schema.marks.bold!),
    ).toBe(false);

    editor.destroy();
  });

  // BubbleMenuBar를 없애면서 사라졌던 "일부 텍스트에만 색 적용" 흐름을 되살린 것이라
  // 색 적용 경로를 회귀로 고정한다.
  it("applies a text color to the selected text only", async () => {
    const user = userEvent.setup();
    const editor = renderToolbar("hello world");
    selectText(editor, 1, 6);

    await user.click(screen.getByLabelText("글자 색"));
    await user.click(screen.getByLabelText("빨강"));

    const colorMark = editor.schema.marks.noteTextColor;

    expect(colorMark).toBeDefined();
    expect(editor.state.doc.rangeHasMark(1, 6, colorMark!)).toBe(true);
    expect(editor.state.doc.rangeHasMark(7, 12, colorMark!)).toBe(false);

    editor.destroy();
  });

  it("returns to the format view after applying a color", async () => {
    const user = userEvent.setup();
    const editor = renderToolbar("hello world");
    selectText(editor, 1, 6);

    await user.click(screen.getByLabelText("글자 색"));
    expect(screen.getByLabelText("빨강")).toBeInTheDocument();

    await user.click(screen.getByLabelText("빨강"));

    expect(screen.queryByLabelText("빨강")).not.toBeInTheDocument();
    expect(screen.getByLabelText("굵게")).toBeInTheDocument();

    editor.destroy();
  });
});
