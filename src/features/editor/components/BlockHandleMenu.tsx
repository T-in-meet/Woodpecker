"use client";

import type { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

import { BubbleMenuBar } from "./BubbleMenuBar";

const HANDLE_SIZE = 22;
const HANDLE_MARGIN = 10;
const MENU_GAP = 8;
const MENU_PADDING = 8;
const MENU_MAX_WIDTH = 704;
const MIN_LEFT_MENU_WIDTH = 220;

type BlockHandleMenuProps = {
  editor: Editor;
};

type BlockAnchorPositionType = {
  blockBottom: number;
  blockLeft: number;
  blockTop: number;
  handleLeft: number;
  handleTop: number;
};

export function BlockHandleMenu({ editor }: BlockHandleMenuProps) {
  const [isEditorFocused, setIsEditorFocused] = useState(
    () => !editor.isDestroyed && editor.view.hasFocus(),
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    const effectiveRect =
      rect.height > 0 || rect.width > 0 ? rect : fallbackRect;

    setAnchorPosition({
      blockBottom: effectiveRect.bottom,
      blockLeft: effectiveRect.left,
      blockTop: effectiveRect.top,
      handleLeft: Math.max(
        MENU_PADDING,
        effectiveRect.left - HANDLE_SIZE - HANDLE_MARGIN,
      ),
      handleTop: Math.max(
        MENU_PADDING,
        effectiveRect.top +
          Math.max(0, (effectiveRect.height - HANDLE_SIZE) / 2),
      ),
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

  const shouldRenderHandle =
    anchorPosition !== null && (isEditorFocused || isMenuOpen);

  if (
    !shouldRenderHandle ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const estimatedMenuWidth = Math.min(
    MENU_MAX_WIDTH,
    window.innerWidth - MENU_PADDING * 2,
  );
  const availableLeftWidth = Math.max(
    0,
    anchorPosition.blockLeft - MENU_GAP - MENU_PADDING,
  );
  const canPlaceLeft = availableLeftWidth >= MIN_LEFT_MENU_WIDTH;
  const menuMaxWidth = canPlaceLeft
    ? Math.min(MENU_MAX_WIDTH, availableLeftWidth)
    : estimatedMenuWidth;
  const measuredMenuWidth = menuRef.current?.offsetWidth ?? menuMaxWidth;
  const measuredMenuHeight = menuRef.current?.offsetHeight ?? 56;
  const menuLeft = canPlaceLeft
    ? Math.max(
        MENU_PADDING,
        anchorPosition.blockLeft - MENU_GAP - measuredMenuWidth,
      )
    : Math.min(
        Math.max(MENU_PADDING, anchorPosition.blockLeft),
        Math.max(
          MENU_PADDING,
          window.innerWidth - measuredMenuWidth - MENU_PADDING,
        ),
      );
  const preferredTop = canPlaceLeft
    ? anchorPosition.handleTop + HANDLE_SIZE / 2 - measuredMenuHeight / 2
    : anchorPosition.blockTop - measuredMenuHeight - MENU_GAP;
  const fallbackTop = anchorPosition.blockBottom + MENU_GAP;
  const rawMenuTop =
    !canPlaceLeft && preferredTop < MENU_PADDING ? fallbackTop : preferredTop;
  const menuTop = Math.min(
    Math.max(MENU_PADDING, rawMenuTop),
    Math.max(
      MENU_PADDING,
      window.innerHeight - measuredMenuHeight - MENU_PADDING,
    ),
  );

  return createPortal(
    <>
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
        aria-label="Open block toolbar"
        aria-expanded={isMenuOpen}
        aria-haspopup="dialog"
      >
        <GripVertical className="size-3.5" />
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50"
          style={{
            left: menuLeft,
            maxWidth: menuMaxWidth,
            top: menuTop,
          }}
        >
          <BubbleMenuBar editor={editor} />
        </div>
      )}
    </>,
    document.body,
  );
}

function getActiveBlockElement(editor: Editor): HTMLElement | null {
  const rootElement = editor.view.dom;
  const { from } = editor.state.selection;
  const domAtPos = editor.view.domAtPos(from);
  const currentElement =
    domAtPos.node instanceof HTMLElement
      ? domAtPos.node
      : domAtPos.node.parentElement;

  if (!(currentElement instanceof HTMLElement)) {
    return null;
  }

  const tableElement = currentElement.closest("table");

  if (
    tableElement instanceof HTMLElement &&
    rootElement.contains(tableElement)
  ) {
    return tableElement;
  }

  const listItemElement = currentElement.closest("li");

  if (
    listItemElement instanceof HTMLElement &&
    rootElement.contains(listItemElement)
  ) {
    return listItemElement;
  }

  const blockElement = currentElement.closest(
    "p, h1, h2, h3, pre, blockquote, hr",
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
