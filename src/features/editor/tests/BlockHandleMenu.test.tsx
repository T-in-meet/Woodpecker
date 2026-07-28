import "./setup";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import {
  BlockHandleMenu,
  createBlockSelection,
  getActiveBlockElement,
  getBlockHandleMarkerOffset,
  resolveBlockElement,
} from "../components/BlockHandleMenu";
import { getTipTapExtensions } from "../utils/tiptapExtensions";

function renderWithTooltipProvider(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

function createActiveElementEditor(
  rootElement: HTMLElement,
  activeNode: Node,
): Editor {
  return {
    isDestroyed: false,
    isActive: () => false,
    state: {
      selection: {
        from: 1,
      },
    },
    view: {
      dom: rootElement,
      domAtPos: () => ({ node: activeNode, offset: 0 }),
      nodeDOM: () => activeNode,
    },
  } as unknown as Editor;
}

describe("getBlockHandleMarkerOffset", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds the parent list padding for standard unordered lists", () => {
    const listElement = document.createElement("ul");
    listElement.style.paddingLeft = "28px";

    const itemElement = document.createElement("li");
    listElement.appendChild(itemElement);
    document.body.appendChild(listElement);

    expect(getBlockHandleMarkerOffset(itemElement)).toBe(34);
  });

  it("ignores task list items", () => {
    const listElement = document.createElement("ul");
    listElement.dataset.type = "taskList";
    listElement.style.paddingLeft = "28px";

    const itemElement = document.createElement("li");
    listElement.appendChild(itemElement);
    document.body.appendChild(listElement);

    expect(getBlockHandleMarkerOffset(itemElement)).toBe(0);
  });

  it("ignores non-list blocks", () => {
    const paragraphElement = document.createElement("p");
    document.body.appendChild(paragraphElement);

    expect(getBlockHandleMarkerOffset(paragraphElement)).toBe(0);
  });
});

describe("getActiveBlockElement", () => {
  it("uses the blockquote container instead of the indented paragraph", () => {
    const rootElement = document.createElement("div");
    const blockquoteElement = document.createElement("blockquote");
    const paragraphElement = document.createElement("p");
    const textNode = document.createTextNode("quoted text");

    paragraphElement.appendChild(textNode);
    blockquoteElement.appendChild(paragraphElement);
    rootElement.appendChild(blockquoteElement);

    const editor = createActiveElementEditor(rootElement, textNode);

    expect(getActiveBlockElement(editor)).toBe(blockquoteElement);
  });
});

describe("resolveBlockElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the list item instead of the paragraph inside it", () => {
    const rootElement = document.createElement("div");
    rootElement.innerHTML = "<ul><li><p>item</p></li></ul>";
    document.body.appendChild(rootElement);

    const paragraphElement = rootElement.querySelector("p");
    const listItemElement = rootElement.querySelector("li");

    expect(resolveBlockElement(rootElement, paragraphElement)).toBe(
      listItemElement,
    );
  });

  it("returns null for the editor root so the handle hides outside blocks", () => {
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);

    expect(resolveBlockElement(rootElement, rootElement)).toBeNull();
  });

  it("returns null for elements outside the editor", () => {
    const rootElement = document.createElement("div");
    const outsideElement = document.createElement("p");
    document.body.append(rootElement, outsideElement);

    expect(resolveBlockElement(rootElement, outsideElement)).toBeNull();
  });
});

describe("createBlockSelection", () => {
  function createMountedEditor(content: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);

    return new TipTapEditorInstance({
      element,
      extensions: getTipTapExtensions(),
      content,
    });
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("selects the whole block node so clipboard actions apply to it", () => {
    const editor = createMountedEditor("first\n\nsecond");
    const paragraphElements = editor.view.dom.querySelectorAll("p");
    const secondParagraph = paragraphElements[1];

    if (!(secondParagraph instanceof HTMLElement)) {
      throw new Error("second paragraph not found");
    }

    const selection = createBlockSelection(
      editor as unknown as Editor,
      secondParagraph,
    );

    expect(selection).toBeInstanceOf(NodeSelection);
    expect(selection?.content().content.firstChild?.textContent).toBe("second");

    editor.destroy();
  });

  it("returns null when the element does not belong to the document", () => {
    const editor = createMountedEditor("first");
    const detachedElement = document.createElement("p");

    expect(
      createBlockSelection(editor as unknown as Editor, detachedElement),
    ).toBeNull();

    editor.destroy();
  });
});

describe("BlockHandleMenu", () => {
  function createMountedEditor(content: string) {
    const element = document.createElement("div");
    document.body.appendChild(element);

    return new TipTapEditorInstance({
      element,
      extensions: getTipTapExtensions(),
      content,
    });
  }

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("moves the editor selection to the active block when the handle opens", async () => {
    const user = userEvent.setup();
    const editor = createMountedEditor("first\n\nsecond");

    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    editor.commands.setTextSelection(8);

    renderWithTooltipProvider(
      <BlockHandleMenu editor={editor as unknown as Editor} />,
    );

    const handleButton = await screen.findByRole("button", {
      name: "블록 도구 열기",
    });

    await user.click(handleButton);

    await waitFor(() => {
      expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    });

    expect(
      editor.state.selection.content().content.firstChild?.textContent,
    ).toBe("second");

    editor.destroy();
  });

  it("keeps the menu closed when the handle is held down like a drag", async () => {
    const editor = createMountedEditor("first\n\nsecond");

    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    editor.commands.setTextSelection(8);

    renderWithTooltipProvider(
      <BlockHandleMenu editor={editor as unknown as Editor} />,
    );

    const handleButton = await screen.findByRole("button", {
      name: "블록 도구 열기",
    });

    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    fireEvent.pointerDown(handleButton, { clientX: 40, clientY: 40 });
    now += 500;
    fireEvent.click(handleButton, { clientX: 40, clientY: 40 });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    editor.destroy();
  });

  it("opens the menu on a quick click", async () => {
    const editor = createMountedEditor("first\n\nsecond");

    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    editor.commands.setTextSelection(8);

    renderWithTooltipProvider(
      <BlockHandleMenu editor={editor as unknown as Editor} />,
    );

    const handleButton = await screen.findByRole("button", {
      name: "블록 도구 열기",
    });

    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    fireEvent.pointerDown(handleButton, { clientX: 40, clientY: 40 });
    now += 80;
    fireEvent.click(handleButton, { clientX: 40, clientY: 40 });

    expect(await screen.findByRole("menu")).toBeInTheDocument();

    editor.destroy();
  });

  it("starts a ProseMirror drag for the handled block", async () => {
    const editor = createMountedEditor("first\n\nsecond");

    vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
    editor.commands.setTextSelection(8);

    renderWithTooltipProvider(
      <BlockHandleMenu editor={editor as unknown as Editor} />,
    );

    const handleButton = await screen.findByRole("button", {
      name: "블록 도구 열기",
    });

    const dataTransfer = {
      effectAllowed: "none",
      clearData: vi.fn(),
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    fireEvent.dragStart(handleButton, { dataTransfer });

    expect(editor.view.dragging?.move).toBe(true);
    expect(editor.view.dragging?.slice.content.firstChild?.textContent).toBe(
      "second",
    );

    editor.destroy();
  });
});
