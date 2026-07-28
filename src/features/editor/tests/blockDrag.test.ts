import "./setup";

import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBlockSelection } from "../components/BlockHandleMenu";
import { endBlockDrag, startBlockDrag } from "../utils/blockDrag";
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

function createDataTransferMock() {
  const values = new Map<string, string>();

  const dataTransfer = {
    effectAllowed: "none",
    clearData: vi.fn(),
    setData: vi.fn((format: string, value: string) => {
      values.set(format, value);
    }),
    setDragImage: vi.fn(),
  };

  return { dataTransfer, values };
}

function getSecondParagraph(editor: TipTapEditorInstance): HTMLElement {
  const paragraphElement = editor.view.dom.querySelectorAll("p")[1];

  if (!(paragraphElement instanceof HTMLElement)) {
    throw new Error("second paragraph not found");
  }

  return paragraphElement;
}

describe("startBlockDrag", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("hands the dragged block to ProseMirror so the drop moves it", () => {
    const editor = createMountedEditor("first\n\nsecond");
    const blockElement = getSecondParagraph(editor);
    const selection = createBlockSelection(
      editor as unknown as Editor,
      blockElement,
    );

    if (!selection) {
      throw new Error("block selection not created");
    }

    const { dataTransfer, values } = createDataTransferMock();

    const didStart = startBlockDrag(
      editor as unknown as Editor,
      blockElement,
      selection,
      dataTransfer as unknown as DataTransfer,
    );

    expect(didStart).toBe(true);
    // 드롭 시 원본을 지우려면 드래그 대상이 selection으로 잡혀 있어야 한다.
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor.view.dragging?.move).toBe(true);
    expect(editor.view.dragging?.slice.content.firstChild?.textContent).toBe(
      "second",
    );
    expect(values.get("text/plain")).toBe("second");
    expect(values.get("text/html")).toContain("second");
    expect(dataTransfer.effectAllowed).toBe("copyMove");
    expect(dataTransfer.setDragImage).toHaveBeenCalledWith(blockElement, 0, 0);

    editor.destroy();
  });

  it("does nothing when the editor is already destroyed", () => {
    const editor = createMountedEditor("first");
    const blockElement = editor.view.dom.querySelector("p");

    if (!(blockElement instanceof HTMLElement)) {
      throw new Error("paragraph not found");
    }

    const selection = createBlockSelection(
      editor as unknown as Editor,
      blockElement,
    );

    if (!selection) {
      throw new Error("block selection not created");
    }

    editor.destroy();

    const { dataTransfer } = createDataTransferMock();

    expect(
      startBlockDrag(
        editor as unknown as Editor,
        blockElement,
        selection,
        dataTransfer as unknown as DataTransfer,
      ),
    ).toBe(false);
    expect(dataTransfer.setData).not.toHaveBeenCalled();
  });
});

describe("endBlockDrag", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("clears the dragging state so a cancelled drag leaves nothing behind", () => {
    const editor = createMountedEditor("first\n\nsecond");
    const blockElement = getSecondParagraph(editor);
    const selection = createBlockSelection(
      editor as unknown as Editor,
      blockElement,
    );

    if (!selection) {
      throw new Error("block selection not created");
    }

    const { dataTransfer } = createDataTransferMock();

    startBlockDrag(
      editor as unknown as Editor,
      blockElement,
      selection,
      dataTransfer as unknown as DataTransfer,
    );
    endBlockDrag(editor as unknown as Editor);

    expect(editor.view.dragging).toBeNull();

    editor.destroy();
  });
});
