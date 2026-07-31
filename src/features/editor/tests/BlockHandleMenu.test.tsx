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
  getBlockHandleTop,
  getHoverBlockElement,
  isPointerNearEditor,
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

describe("isPointerNearEditor", () => {
  function createRectEditor(isDestroyed = false): Editor {
    const rootElement = document.createElement("div");

    rootElement.getBoundingClientRect = () =>
      ({ top: 100, bottom: 300, left: 200, right: 600 }) as DOMRect;

    return {
      isDestroyed,
      view: { dom: rootElement },
    } as unknown as Editor;
  }

  it("counts the left gutter where the handle floats as inside", () => {
    // HOVER_GUTTER(44px)만큼 왼쪽 바깥까지 인정한다.
    expect(isPointerNearEditor(createRectEditor(), 160, 200)).toBe(true);
    expect(isPointerNearEditor(createRectEditor(), 150, 200)).toBe(false);
  });

  it("returns false outside the editor bounds", () => {
    const editor = createRectEditor();

    expect(isPointerNearEditor(editor, 400, 90)).toBe(false);
    expect(isPointerNearEditor(editor, 400, 310)).toBe(false);
    expect(isPointerNearEditor(editor, 610, 200)).toBe(false);
  });

  it("returns false for a destroyed editor", () => {
    expect(isPointerNearEditor(createRectEditor(true), 400, 200)).toBe(false);
  });
});

describe("getHoverBlockElement", () => {
  function stubRect(element: Element, top: number, bottom: number): void {
    element.getBoundingClientRect = () =>
      ({
        top,
        bottom,
        left: 0,
        right: 500,
        width: 500,
        height: bottom - top,
      }) as DOMRect;
  }

  // 바깥 항목(0~90) 안에 자기 문단(0~30)과 중첩 목록(30~90)이 들어 있는 구조.
  function createNestedListEditor(): {
    editor: Editor;
    outerItem: HTMLElement;
    innerItems: HTMLElement[];
    tailParagraph: HTMLElement;
  } {
    const rootElement = document.createElement("div");
    rootElement.innerHTML = [
      "<ol>",
      "<li><p>부모</p>",
      "<ol><li><p>자식1</p></li><li><p>자식2</p></li></ol>",
      "</li>",
      "</ol>",
      "<p>다음 문단</p>",
    ].join("");
    document.body.appendChild(rootElement);

    const outerList = rootElement.querySelector("ol");
    const outerItem = rootElement.querySelector("li");
    const outerParagraph = rootElement.querySelector("li > p");
    const innerList = rootElement.querySelector("li > ol");
    const innerItems = Array.from(rootElement.querySelectorAll("li li"));
    const tailParagraph = rootElement.querySelector(":scope > p");

    if (
      !(outerList instanceof HTMLElement) ||
      !(outerItem instanceof HTMLElement) ||
      !(outerParagraph instanceof HTMLElement) ||
      !(innerList instanceof HTMLElement) ||
      !(tailParagraph instanceof HTMLElement) ||
      innerItems.length !== 2
    ) {
      throw new Error("nested list fixture is broken");
    }

    stubRect(rootElement, 0, 200);
    stubRect(outerList, 0, 90);
    stubRect(outerItem, 0, 90);
    stubRect(outerParagraph, 0, 30);
    stubRect(innerList, 30, 90);
    stubRect(tailParagraph, 100, 130);

    innerItems.forEach((item, index) => {
      const top = 30 + index * 30;
      stubRect(item, top, top + 30);

      const paragraph = item.querySelector("p");

      if (paragraph) {
        stubRect(paragraph, top, top + 30);
      }
    });

    const editor = {
      isDestroyed: false,
      view: { dom: rootElement },
    } as unknown as Editor;

    return {
      editor,
      outerItem,
      innerItems: innerItems.filter(
        (item): item is HTMLElement => item instanceof HTMLElement,
      ),
      tailParagraph,
    };
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("picks the same block anywhere on the row, including blank space", () => {
    const { editor, innerItems } = createNestedListEditor();
    const [firstInnerItem] = innerItems;

    // 글자 위, 왼쪽 들여쓰기 빈 공간, 오른쪽 여백 모두 같은 줄이면 같은 블록이어야 한다.
    expect(getHoverBlockElement(editor, 200, 45)).toBe(firstInnerItem);
    expect(getHoverBlockElement(editor, 10, 45)).toBe(firstInnerItem);
    expect(getHoverBlockElement(editor, 480, 45)).toBe(firstInnerItem);
  });

  it("uses the outer item for its own line and the inner item for nested lines", () => {
    const { editor, outerItem, innerItems } = createNestedListEditor();

    expect(getHoverBlockElement(editor, 10, 15)).toBe(outerItem);
    expect(getHoverBlockElement(editor, 10, 45)).toBe(innerItems[0]);
    expect(getHoverBlockElement(editor, 10, 75)).toBe(innerItems[1]);
  });

  it("returns null between blocks so the caller can keep the previous one", () => {
    const { editor } = createNestedListEditor();

    expect(getHoverBlockElement(editor, 10, 95)).toBeNull();
  });

  it("finds a plain top level paragraph", () => {
    const { editor, tailParagraph } = createNestedListEditor();

    expect(getHoverBlockElement(editor, 10, 115)).toBe(tailParagraph);
  });

  it("returns null outside the editor", () => {
    const { editor } = createNestedListEditor();

    expect(getHoverBlockElement(editor, 10, 400)).toBeNull();
  });

  // 구분선은 높이가 1px이라 실제 사각형만 보면 사실상 hover가 불가능하다.
  it("still finds a divider that is only one pixel tall", () => {
    const rootElement = document.createElement("div");
    rootElement.innerHTML = "<p>위</p><hr><p>아래</p>";
    document.body.appendChild(rootElement);

    const paragraphs = rootElement.querySelectorAll("p");
    const divider = rootElement.querySelector("hr");
    const [firstParagraph, lastParagraph] = Array.from(paragraphs);

    if (
      !(divider instanceof HTMLElement) ||
      !(firstParagraph instanceof HTMLElement) ||
      !(lastParagraph instanceof HTMLElement)
    ) {
      throw new Error("divider fixture is broken");
    }

    stubRect(rootElement, 0, 200);
    stubRect(firstParagraph, 0, 30);
    stubRect(divider, 54, 55);
    stubRect(lastParagraph, 79, 109);

    const editor = {
      isDestroyed: false,
      view: { dom: rootElement },
    } as unknown as Editor;

    expect(getHoverBlockElement(editor, 10, 54)).toBe(divider);
    // 선 위아래 여백에서도 잡혀야 한다.
    expect(getHoverBlockElement(editor, 10, 47)).toBe(divider);
    expect(getHoverBlockElement(editor, 10, 62)).toBe(divider);
    // 이웃 블록까지 침범하지는 않는다.
    expect(getHoverBlockElement(editor, 10, 20)).toBe(firstParagraph);
    expect(getHoverBlockElement(editor, 10, 90)).toBe(lastParagraph);
  });
});

describe("getBlockHandleTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("aligns with the first line instead of the middle of a tall block", () => {
    const listItemElement = document.createElement("li");
    listItemElement.style.lineHeight = "24px";
    document.body.appendChild(listItemElement);

    // 중첩 목록이 달려 세 줄 높이인 항목: 첫 줄(24px) 기준으로 맞춰야 한다.
    expect(getBlockHandleTop(listItemElement, { top: 100, height: 72 })).toBe(
      101,
    );
  });

  it("keeps centering a single line block", () => {
    const paragraphElement = document.createElement("p");
    paragraphElement.style.lineHeight = "24px";
    document.body.appendChild(paragraphElement);

    expect(getBlockHandleTop(paragraphElement, { top: 100, height: 24 })).toBe(
      101,
    );
  });

  it("adds the block padding so padded blocks align with their first line", () => {
    const codeBlockElement = document.createElement("pre");
    codeBlockElement.style.lineHeight = "24px";
    codeBlockElement.style.paddingTop = "16px";
    document.body.appendChild(codeBlockElement);

    expect(getBlockHandleTop(codeBlockElement, { top: 100, height: 200 })).toBe(
      117,
    );
  });

  it("centers the handle on a block thinner than the handle", () => {
    const dividerElement = document.createElement("hr");
    dividerElement.style.lineHeight = "24px";
    document.body.appendChild(dividerElement);

    // 1px짜리 구분선: 핸들(22px)이 선 중앙에 오도록 위로 올라가야 한다.
    expect(getBlockHandleTop(dividerElement, { top: 100, height: 1 })).toBe(
      89.5,
    );
  });

  it("falls back to the block height when line-height is not a number", () => {
    const paragraphElement = document.createElement("p");
    document.body.appendChild(paragraphElement);

    expect(getBlockHandleTop(paragraphElement, { top: 100, height: 62 })).toBe(
      120,
    );
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

  it("uses the block itself for a later block inside a list item", () => {
    const rootElement = document.createElement("div");
    rootElement.innerHTML = "<ol><li><p>item</p><h1>heading</h1></li></ol>";
    document.body.appendChild(rootElement);

    const headingElement = rootElement.querySelector("h1");

    expect(resolveBlockElement(rootElement, headingElement)).toBe(
      headingElement,
    );
  });

  it("keeps using the innermost list item for nested lists", () => {
    const rootElement = document.createElement("div");
    rootElement.innerHTML =
      "<ol><li><p>parent</p><ol><li><p>child</p></li></ol></li></ol>";
    document.body.appendChild(rootElement);

    const childParagraphElement =
      rootElement.querySelector<HTMLElement>("ol ol p");
    const childListItemElement = rootElement.querySelector("ol ol li");

    expect(resolveBlockElement(rootElement, childParagraphElement)).toBe(
      childListItemElement,
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

  async function openHandleMenu(editor: TipTapEditorInstance) {
    renderWithTooltipProvider(
      <BlockHandleMenu editor={editor as unknown as Editor} />,
    );

    const handleButton = await screen.findByRole("button", {
      name: "블록 도구 열기",
    });

    fireEvent.pointerDown(handleButton, { clientX: 40, clientY: 40 });
    fireEvent.click(handleButton, { clientX: 40, clientY: 40 });

    return screen.findByRole("menu");
  }

  it.each(["Delete", "Backspace"])(
    "deletes the block when %s is pressed while the menu is open",
    async (key) => {
      const editor = createMountedEditor("first\n\nsecond");

      vi.spyOn(editor.view, "hasFocus").mockReturnValue(true);
      editor.commands.setTextSelection(8);

      const menu = await openHandleMenu(editor);

      fireEvent.keyDown(menu, { key });

      await waitFor(() => {
        expect(editor.getText()).not.toContain("second");
      });

      expect(editor.getText()).toContain("first");

      editor.destroy();
    },
  );

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
