"use client";

import type { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

import { BubbleMenuBar } from "./BubbleMenuBar";

const HANDLE_SIZE = 22;
const HANDLE_MARGIN = 10;
const LIST_MARKER_CLEARANCE = 6;
const MENU_GAP = 8;
const MENU_PADDING = 8;
const MENU_MAX_WIDTH = 704;
const MIN_LEFT_MENU_WIDTH = 220;

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
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        handleRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setIsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const shouldRenderHandle =
    anchorPosition !== null && (isEditorFocused || isMenuOpen);

  if (!shouldRenderHandle) {
    return null;
  }

  const menuPosition = computeMenuPosition(
    anchorPosition,
    menuRef.current?.offsetWidth ?? null,
    menuRef.current?.offsetHeight ?? null,
  );
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

      <Tooltip
        open={isMenuOpen ? false : isTooltipOpen}
        onOpenChange={(nextOpen) => {
          if (!isMenuOpen) {
            setIsTooltipOpen(nextOpen);
          }
        }}
      >
        <TooltipTrigger asChild>
          <button
            ref={handleRef}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              setIsMenuOpen((current) => !current);
              scheduleSyncAnchorPosition();
            }}
            className={cn(
              "fixed z-40 inline-flex items-center justify-center rounded-md border border-border/60",
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
            aria-expanded={isMenuOpen}
            aria-haspopup="dialog"
          >
            <GripVertical className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">블록 도구</TooltipContent>
      </Tooltip>

      {isMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50"
          style={{
            left: menuPosition.left,
            maxWidth: menuPosition.maxWidth,
            top: menuPosition.top,
          }}
        >
          <BubbleMenuBar editor={editor} onDeleteBlock={handleDeleteBlock} />
        </div>
      )}
    </>,
    document.body,
  );
}

type BlockNodeRangeType = {
  from: number;
  to: number;
};

type MenuPositionType = {
  left: number;
  maxWidth: number;
  top: number;
};

export function computeMenuPosition(
  anchor: BlockAnchorPositionType,
  measuredWidth: number | null,
  measuredHeight: number | null,
): MenuPositionType {
  // 리스트 아이템의 경우 blockLeft는 텍스트 시작점이고 마커(•, 1.)는 부모 UL/OL의
  // padding 영역(blockLeft 왼쪽)에 위치한다. 메뉴의 우측 경계를 텍스트 기준으로 잡으면
  // 마커를 덮으므로, 마커 좌측 가장자리(blockLeft - markerOffset)를 앵커로 사용한다.
  const anchorLeft = anchor.blockLeft - anchor.markerOffset;
  const estimatedMenuWidth = Math.min(
    MENU_MAX_WIDTH,
    window.innerWidth - MENU_PADDING * 2,
  );
  const availableLeftWidth = Math.max(0, anchorLeft - MENU_GAP - MENU_PADDING);
  const canPlaceLeft = availableLeftWidth >= MIN_LEFT_MENU_WIDTH;
  const maxWidth = canPlaceLeft
    ? Math.min(MENU_MAX_WIDTH, availableLeftWidth)
    : estimatedMenuWidth;
  const width = measuredWidth ?? maxWidth;
  const height = measuredHeight ?? 56;

  const left = canPlaceLeft
    ? Math.max(MENU_PADDING, anchorLeft - MENU_GAP - width)
    : Math.min(
        Math.max(MENU_PADDING, anchorLeft),
        Math.max(MENU_PADDING, window.innerWidth - width - MENU_PADDING),
      );

  const preferredTop = canPlaceLeft
    ? anchor.handleTop + HANDLE_SIZE / 2 - height / 2
    : anchor.blockTop - height - MENU_GAP;
  const fallbackTop = anchor.blockBottom + MENU_GAP;
  const rawTop =
    !canPlaceLeft && preferredTop < MENU_PADDING ? fallbackTop : preferredTop;
  const top = Math.min(
    Math.max(MENU_PADDING, rawTop),
    Math.max(MENU_PADDING, window.innerHeight - height - MENU_PADDING),
  );

  return { left, maxWidth, top };
}

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

function getActiveBlockElement(editor: Editor): HTMLElement | null {
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
