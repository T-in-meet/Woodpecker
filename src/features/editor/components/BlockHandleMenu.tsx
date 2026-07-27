"use client";

import {
  NodeSelection,
  type Selection as ProseMirrorSelection,
  TextSelection,
} from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

import { BlockActionMenu } from "./BlockActionMenu";

const HANDLE_SIZE = 22;
const HANDLE_MARGIN = 10;
const LIST_MARKER_CLEARANCE = 6;
const MENU_PADDING = 8;

type BlockHandleMenuProps = {
  editor: Editor;
};

export type BlockAnchorPositionType = {
  blockBottom: number;
  blockHasMeasurableRect: boolean;
  blockHeight: number;
  blockLeft: number;
  blockTop: number;
  blockWidth: number;
  handleLeft: number;
  handleTop: number;
  isCodeBlock: boolean;
  markerOffset: number;
};

export function BlockHandleMenu({ editor }: BlockHandleMenuProps) {
  const [isEditorFocused, setIsEditorFocused] = useState(
    () => !editor.isDestroyed && editor.view.hasFocus(),
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] =
    useState<BlockAnchorPositionType | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const blurRafRef = useRef<number | null>(null);

  const syncAnchorPosition = useCallback(() => {
    if (editor.isDestroyed) {
      setAnchorPosition(null);
      return;
    }

    const blockElement = getActiveBlockElement(editor);

    if (!blockElement || !document.body.contains(blockElement)) {
      setAnchorPosition(null);
      return;
    }

    const rect = blockElement.getBoundingClientRect();
    const fallbackRect = editor.view.dom.getBoundingClientRect();
    const blockHasMeasurableRect = rect.height > 0 || rect.width > 0;
    const effectiveRect = blockHasMeasurableRect ? rect : fallbackRect;
    const handleOffset = getBlockHandleMarkerOffset(blockElement);
    const isCodeBlock =
      blockElement.tagName === "PRE" ||
      (!editor.isDestroyed && editor.isActive("codeBlock"));

    setAnchorPosition({
      blockBottom: effectiveRect.bottom,
      blockHasMeasurableRect,
      blockHeight: effectiveRect.height,
      blockLeft: effectiveRect.left,
      blockTop: effectiveRect.top,
      blockWidth: effectiveRect.width,
      handleLeft: Math.max(
        MENU_PADDING,
        effectiveRect.left - HANDLE_SIZE - HANDLE_MARGIN - handleOffset,
      ),
      handleTop: Math.max(
        MENU_PADDING,
        effectiveRect.top +
          Math.max(0, (effectiveRect.height - HANDLE_SIZE) / 2),
      ),
      isCodeBlock,
      markerOffset: handleOffset,
    });
  }, [editor]);

  const scheduleSyncAnchorPosition = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      syncAnchorPosition();
    });
  }, [syncAnchorPosition]);

  useEffect(() => {
    scheduleSyncAnchorPosition();

    const handleFocus = () => {
      setIsEditorFocused(true);
      scheduleSyncAnchorPosition();
    };

    const handleBlur = () => {
      if (blurRafRef.current !== null) {
        cancelAnimationFrame(blurRafRef.current);
      }

      blurRafRef.current = requestAnimationFrame(() => {
        blurRafRef.current = null;

        if (editor.isDestroyed) {
          return;
        }

        if (!editor.view.hasFocus()) {
          setIsEditorFocused(false);
        }
      });
    };

    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    editor.on("selectionUpdate", scheduleSyncAnchorPosition);
    editor.on("update", scheduleSyncAnchorPosition);

    window.addEventListener("resize", scheduleSyncAnchorPosition);
    window.addEventListener("scroll", scheduleSyncAnchorPosition, true);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      if (blurRafRef.current !== null) {
        cancelAnimationFrame(blurRafRef.current);
      }

      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      editor.off("selectionUpdate", scheduleSyncAnchorPosition);
      editor.off("update", scheduleSyncAnchorPosition);

      window.removeEventListener("resize", scheduleSyncAnchorPosition);
      window.removeEventListener("scroll", scheduleSyncAnchorPosition, true);
    };
  }, [editor, scheduleSyncAnchorPosition]);

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const shouldRenderHandle =
    anchorPosition !== null && (isEditorFocused || isMenuOpen);

  if (!shouldRenderHandle) {
    return null;
  }

  // 오버레이는 장식용 div라 실제 selection이 아니다. 핸들로 블록을 열 때 ProseMirror
  // selection까지 옮겨줘야 복사/잘라내기/붙여넣기가 해당 블록에 적용된다.
  const handleSelectBlock = () => {
    if (editor.isDestroyed) {
      return;
    }

    const blockElement = getActiveBlockElement(editor);

    if (!blockElement) {
      return;
    }

    const selection = createBlockSelection(editor, blockElement);

    if (!selection) {
      return;
    }

    const { view } = editor;

    // 여기서 view.focus()를 부르면 열리는 중인 메뉴가 포커스 이탈로 곧바로 닫힌다.
    // 에디터 포커스는 메뉴가 닫힐 때 BlockActionMenu가 되돌린다.
    view.dispatch(view.state.tr.setSelection(selection));
  };

  const handleMenuOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      handleSelectBlock();
    }

    setIsMenuOpen(nextOpen);
    scheduleSyncAnchorPosition();
  };

  const handleDeleteBlock = () => {
    const blockElement = getActiveBlockElement(editor);

    if (!blockElement) {
      return;
    }

    const blockRange = getBlockNodeRange(editor, blockElement);

    if (!blockRange) {
      return;
    }

    const didDelete = editor.chain().focus().deleteRange(blockRange).run();

    if (didDelete) {
      setIsMenuOpen(false);
    }
  };

  const shouldRenderOverlay =
    isMenuOpen && anchorPosition.blockHasMeasurableRect;
  const overlayLeft = anchorPosition.blockLeft - anchorPosition.markerOffset;
  const overlayWidth = anchorPosition.blockWidth + anchorPosition.markerOffset;

  return createPortal(
    <>
      {shouldRenderOverlay && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed z-30 rounded-md ring-1 ring-ring/20",
            !anchorPosition.isCodeBlock && "bg-muted/40",
          )}
          style={{
            left: overlayLeft,
            top: anchorPosition.blockTop,
            width: overlayWidth,
            height: anchorPosition.blockHeight,
          }}
          data-testid="block-handle-overlay"
        />
      )}

      <DropdownMenu open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
        <Tooltip
          open={isMenuOpen ? false : isTooltipOpen}
          onOpenChange={(nextOpen) => {
            if (!isMenuOpen) {
              setIsTooltipOpen(nextOpen);
            }
          }}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                ref={handleRef}
                type="button"
                className={cn(
                  "fixed z-40 inline-flex cursor-pointer items-center justify-center rounded-md border border-border/60",
                  "bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  isMenuOpen && "bg-muted text-foreground",
                )}
                style={{
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  left: anchorPosition.handleLeft,
                  top: anchorPosition.handleTop,
                }}
                aria-label="블록 도구 열기"
              >
                <GripVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">블록 도구</TooltipContent>
        </Tooltip>

        <BlockActionMenu
          editor={editor}
          onDeleteBlock={handleDeleteBlock}
          onCloseMenu={() => setIsMenuOpen(false)}
        />
      </DropdownMenu>
    </>,
    document.body,
  );
}

type BlockNodeRangeType = {
  from: number;
  to: number;
};

export function getBlockHandleMarkerOffset(blockElement: HTMLElement): number {
  if (blockElement.tagName !== "LI") {
    return 0;
  }

  const parentListElement = blockElement.parentElement;

  if (
    !(
      parentListElement instanceof HTMLUListElement ||
      parentListElement instanceof HTMLOListElement
    ) ||
    parentListElement.dataset.type === "taskList"
  ) {
    return 0;
  }

  const parentListStyles = window.getComputedStyle(parentListElement);
  const markerPadding = Number.parseFloat(
    parentListStyles.paddingInlineStart || parentListStyles.paddingLeft,
  );

  if (!Number.isFinite(markerPadding) || markerPadding <= 0) {
    return 0;
  }

  // Standard list markers sit inside the parent list padding, so the handle
  // needs that space added back to avoid covering the marker itself.
  return markerPadding + LIST_MARKER_CLEARANCE;
}

export function createBlockSelection(
  editor: Editor,
  blockElement: HTMLElement,
): ProseMirrorSelection | null {
  const blockRange = getBlockNodeRange(editor, blockElement);

  if (!blockRange) {
    return null;
  }

  const { doc } = editor.state;
  const blockNode = doc.nodeAt(blockRange.from);

  if (blockNode && NodeSelection.isSelectable(blockNode)) {
    return NodeSelection.create(doc, blockRange.from);
  }

  // 표 등 NodeSelection을 허용하지 않는 노드는 블록 전체 텍스트 범위로 대신 선택한다.
  return TextSelection.between(
    doc.resolve(blockRange.from),
    doc.resolve(blockRange.to),
  );
}

function getBlockNodeRange(
  editor: Editor,
  blockElement: HTMLElement,
): BlockNodeRangeType | null {
  let blockRange: BlockNodeRangeType | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (editor.view.nodeDOM(pos) !== blockElement) {
      return true;
    }

    blockRange = { from: pos, to: pos + node.nodeSize };

    return false;
  });

  return blockRange;
}

export function getActiveBlockElement(editor: Editor): HTMLElement | null {
  const rootElement = editor.view.dom;
  const { from } = editor.state.selection;
  const selectedNodeDom = editor.view.nodeDOM(from);
  const domAtPos = editor.view.domAtPos(from);

  if (
    selectedNodeDom instanceof HTMLImageElement &&
    rootElement.contains(selectedNodeDom)
  ) {
    return selectedNodeDom;
  }

  if (
    domAtPos.node instanceof HTMLImageElement &&
    rootElement.contains(domAtPos.node)
  ) {
    return domAtPos.node;
  }

  const selectedElement =
    selectedNodeDom instanceof HTMLElement
      ? selectedNodeDom
      : selectedNodeDom instanceof Text
        ? selectedNodeDom.parentElement
        : null;
  const currentElement =
    domAtPos.node instanceof HTMLElement
      ? domAtPos.node
      : domAtPos.node.parentElement;

  const activeElement =
    selectedElement instanceof HTMLElement ? selectedElement : currentElement;

  if (!(activeElement instanceof HTMLElement)) {
    return null;
  }

  const tableElement = activeElement.closest("table");

  if (
    tableElement instanceof HTMLElement &&
    rootElement.contains(tableElement)
  ) {
    return tableElement;
  }

  const listItemElement = activeElement.closest("li");

  if (
    listItemElement instanceof HTMLElement &&
    rootElement.contains(listItemElement)
  ) {
    return listItemElement;
  }

  const blockquoteElement = activeElement.closest("blockquote");

  if (
    blockquoteElement instanceof HTMLElement &&
    rootElement.contains(blockquoteElement)
  ) {
    return blockquoteElement;
  }

  const blockElement = activeElement.closest(
    "p, h1, h2, h3, pre, blockquote, hr, img",
  );

  if (
    blockElement instanceof HTMLElement &&
    rootElement.contains(blockElement)
  ) {
    return blockElement;
  }

  return rootElement.firstElementChild instanceof HTMLElement
    ? rootElement.firstElementChild
    : null;
}
