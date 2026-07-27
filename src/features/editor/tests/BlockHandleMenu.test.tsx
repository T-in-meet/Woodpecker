import "./setup";

import { Editor as TipTapEditorInstance } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  type BlockAnchorPositionType,
  computeMenuPosition,
  createBlockSelection,
  getActiveBlockElement,
  getBlockHandleMarkerOffset,
} from "../components/BlockHandleMenu";
import { getTipTapExtensions } from "../utils/tiptapExtensions";

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

describe("computeMenuPosition", () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height,
    });
  }

  function makeAnchor(
    overrides: Partial<BlockAnchorPositionType> = {},
  ): BlockAnchorPositionType {
    return {
      blockBottom: 232,
      blockHasMeasurableRect: true,
      blockHeight: 32,
      blockLeft: 400,
      blockTop: 200,
      blockWidth: 400,
      handleLeft: 360,
      handleTop: 205,
      isCodeBlock: false,
      markerOffset: 0,
      ...overrides,
    };
  }

  it("anchors a list item's menu to the left of the marker so the bullet stays visible", () => {
    setViewport(1280, 800);

    const listItemAnchor = makeAnchor({ blockLeft: 400, markerOffset: 34 });
    const paragraphAnchor = makeAnchor({ blockLeft: 400, markerOffset: 0 });
    const measuredWidth = 240;
    const measuredHeight = 56;

    const listPosition = computeMenuPosition(
      listItemAnchor,
      measuredWidth,
      measuredHeight,
    );
    const paragraphPosition = computeMenuPosition(
      paragraphAnchor,
      measuredWidth,
      measuredHeight,
    );

    // 메뉴 우측 경계가 마커 좌측 가장자리(blockLeft - markerOffset)보다 왼쪽이어야 마커가 가려지지 않는다.
    expect(listPosition.left + measuredWidth).toBeLessThanOrEqual(
      listItemAnchor.blockLeft - listItemAnchor.markerOffset,
    );
    // markerOffset만큼 일반 블록보다 더 왼쪽에 배치되어야 한다.
    expect(paragraphPosition.left - listPosition.left).toBe(
      listItemAnchor.markerOffset,
    );
  });
});
