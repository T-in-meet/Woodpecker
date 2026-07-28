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
import {
  endBlockDrag,
  startBlockDrag,
} from "@/features/editor/utils/blockDrag";
import { cn } from "@/lib/utils/cn";

import { BlockActionMenu } from "./BlockActionMenu";

const HANDLE_SIZE = 22;
const HANDLE_MARGIN = 10;
const LIST_MARKER_CLEARANCE = 6;
const MENU_PADDING = 8;
// 핸들은 에디터 왼쪽 바깥에 뜨므로, 그 여백 위에 커서가 있어도 같은 줄의 블록을 가리킨다.
const HOVER_GUTTER = HANDLE_SIZE + HANDLE_MARGIN + 12;
// 이보다 오래 누르거나 많이 움직이면 드래그 의도로 보고 메뉴를 열지 않는다.
const CLICK_MAX_DURATION_MS = 300;
const CLICK_MAX_DISTANCE_PX = 4;
// 브라우저에 따라 dragend가 drop보다 먼저 오는 경우가 있어 ProseMirror와 같은 지연을 둔다.
const DRAG_END_CLEANUP_DELAY_MS = 50;

type BlockHandleMenuProps = {
  editor: Editor;
};

type HandlePointerDownType = {
  time: number;
  x: number;
  y: number;
  wasMenuOpen: boolean;
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
  const [isDragging, setIsDragging] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] =
    useState<BlockAnchorPositionType | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const blurRafRef = useRef<number | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const dragEndTimeoutRef = useRef<number | null>(null);

  const isEditorFocusedRef = useRef(isEditorFocused);
  const isMenuOpenRef = useRef(isMenuOpen);
  const isDraggingRef = useRef(isDragging);
  const hoveredBlockRef = useRef<HTMLElement | null>(null);
  // 메뉴가 열려 있거나 드래그하는 동안에는 대상 블록이 hover/커서를 따라 바뀌면 안 된다.
  const pinnedBlockRef = useRef<HTMLElement | null>(null);
  const targetBlockRef = useRef<HTMLElement | null>(null);
  const pointerDownRef = useRef<HandlePointerDownType | null>(null);

  const resolveTargetBlockElement = useCallback((): HTMLElement | null => {
    if (editor.isDestroyed) {
      return null;
    }

    const rootElement = editor.view.dom;
    const pinnedBlockElement = pinnedBlockRef.current;

    if (pinnedBlockElement && rootElement.contains(pinnedBlockElement)) {
      return pinnedBlockElement;
    }

    const hoveredBlockElement = hoveredBlockRef.current;

    if (hoveredBlockElement && rootElement.contains(hoveredBlockElement)) {
      return hoveredBlockElement;
    }

    return isEditorFocusedRef.current ? getActiveBlockElement(editor) : null;
  }, [editor]);

  const syncAnchorPosition = useCallback(() => {
    const blockElement = resolveTargetBlockElement();
    targetBlockRef.current = blockElement;

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
      blockElement.tagName === "PRE" || blockElement.closest("pre") !== null;

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
  }, [editor, resolveTargetBlockElement]);

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
      isEditorFocusedRef.current = true;
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
          isEditorFocusedRef.current = false;
          setIsEditorFocused(false);
          scheduleSyncAnchorPosition();
        }
      });
    };

    // 노션처럼 마우스를 올린 블록으로 핸들이 따라다니게 한다.
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      if (pinnedBlockRef.current) {
        return;
      }

      const { clientX, clientY } = event;

      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }

      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;

        const nextHoveredBlockElement = getHoverBlockElement(
          editor,
          clientX,
          clientY,
        );

        if (nextHoveredBlockElement === hoveredBlockRef.current) {
          return;
        }

        hoveredBlockRef.current = nextHoveredBlockElement;
        syncAnchorPosition();
      });
    };

    // 핸들을 누르면 에디터가 blur되므로 대상 블록을 고정해 두는데, 드래그 없이 손을 떼면
    // 다시 hover를 따라가도록 풀어준다. 드래그가 시작된 경우 pointerup 대신 dragend가 온다.
    const handleWindowPointerUp = () => {
      if (isDraggingRef.current || isMenuOpenRef.current) {
        return;
      }

      pinnedBlockRef.current = null;
    };

    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    editor.on("selectionUpdate", scheduleSyncAnchorPosition);
    editor.on("update", scheduleSyncAnchorPosition);

    document.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("resize", scheduleSyncAnchorPosition);
    window.addEventListener("scroll", scheduleSyncAnchorPosition, true);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      if (blurRafRef.current !== null) {
        cancelAnimationFrame(blurRafRef.current);
      }

      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }

      if (dragEndTimeoutRef.current !== null) {
        window.clearTimeout(dragEndTimeoutRef.current);
      }

      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      editor.off("selectionUpdate", scheduleSyncAnchorPosition);
      editor.off("update", scheduleSyncAnchorPosition);

      document.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("resize", scheduleSyncAnchorPosition);
      window.removeEventListener("scroll", scheduleSyncAnchorPosition, true);
    };
  }, [editor, scheduleSyncAnchorPosition, syncAnchorPosition]);

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  if (!anchorPosition) {
    return null;
  }

  // 오버레이는 장식용 div라 실제 selection이 아니다. 핸들로 블록을 열 때 ProseMirror
  // selection까지 옮겨줘야 복사/잘라내기/붙여넣기가 해당 블록에 적용된다.
  const handleSelectBlock = () => {
    if (editor.isDestroyed) {
      return;
    }

    const blockElement = targetBlockRef.current;

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
      pinnedBlockRef.current = targetBlockRef.current;
      handleSelectBlock();
    } else {
      pinnedBlockRef.current = null;
    }

    isMenuOpenRef.current = nextOpen;
    setIsMenuOpen(nextOpen);
    scheduleSyncAnchorPosition();
  };

  const handleDeleteBlock = () => {
    const blockElement = targetBlockRef.current;

    if (!blockElement) {
      return;
    }

    const blockRange = getBlockNodeRange(editor, blockElement);

    if (!blockRange) {
      return;
    }

    const didDelete = editor.chain().focus().deleteRange(blockRange).run();

    if (didDelete) {
      handleMenuOpenChange(false);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = {
      time: Date.now(),
      x: event.clientX,
      y: event.clientY,
      wasMenuOpen: isMenuOpen,
    };

    // 버튼을 누르면 에디터가 blur되므로, 대상 블록을 고정해 핸들이 사라지지 않게 한다.
    pinnedBlockRef.current = targetBlockRef.current;
    setIsTooltipOpen(false);
  };

  // 짧게 클릭했을 때만 메뉴를 연다. 길게 누르거나 끌었으면 드래그 의도로 본다.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const pointerDown = pointerDownRef.current;
    pointerDownRef.current = null;

    // 메뉴가 열려 있는 상태로 핸들을 누르면 Radix가 바깥 클릭으로 이미 닫았다.
    if (pointerDown?.wasMenuOpen) {
      return;
    }

    if (pointerDown) {
      const heldDuration = Date.now() - pointerDown.time;
      const movedDistance = Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y,
      );

      if (
        heldDuration > CLICK_MAX_DURATION_MS ||
        movedDistance > CLICK_MAX_DISTANCE_PX
      ) {
        pinnedBlockRef.current = null;
        scheduleSyncAnchorPosition();
        return;
      }
    }

    handleMenuOpenChange(true);
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    const blockElement = targetBlockRef.current;
    const selection =
      blockElement && !editor.isDestroyed
        ? createBlockSelection(editor, blockElement)
        : null;

    if (!blockElement || !selection) {
      event.preventDefault();
      return;
    }

    pinnedBlockRef.current = blockElement;
    pointerDownRef.current = null;
    isDraggingRef.current = true;
    setIsDragging(true);
    setIsTooltipOpen(false);

    startBlockDrag(editor, blockElement, selection, event.dataTransfer);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    pinnedBlockRef.current = null;

    if (dragEndTimeoutRef.current !== null) {
      window.clearTimeout(dragEndTimeoutRef.current);
    }

    dragEndTimeoutRef.current = window.setTimeout(() => {
      dragEndTimeoutRef.current = null;
      endBlockDrag(editor);
    }, DRAG_END_CLEANUP_DELAY_MS);

    if (!editor.isDestroyed) {
      editor.view.focus();
    }

    scheduleSyncAnchorPosition();
  };

  const shouldRenderOverlay =
    (isMenuOpen || isDragging) && anchorPosition.blockHasMeasurableRect;
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
        {/* 핸들 버튼을 트리거로 쓰면 Radix가 pointerdown에서 메뉴를 열고 기본 동작을
            막아버려 드래그를 시작할 수 없다. 위치 기준용 앵커만 트리거로 둔다. */}
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed z-30 block"
            style={{
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              left: anchorPosition.handleLeft,
              top: anchorPosition.handleTop,
            }}
            data-testid="block-handle-anchor"
          />
        </DropdownMenuTrigger>

        <Tooltip
          open={isMenuOpen || isDragging ? false : isTooltipOpen}
          onOpenChange={(nextOpen) => {
            if (!isMenuOpen && !isDragging) {
              setIsTooltipOpen(nextOpen);
            }
          }}
        >
          <TooltipTrigger asChild>
            <button
              ref={handleRef}
              type="button"
              draggable
              onPointerDown={handlePointerDown}
              onClick={handleClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className={cn(
                "fixed z-40 inline-flex cursor-grab items-center justify-center rounded-md border border-border/60",
                "bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors",
                "hover:bg-muted hover:text-foreground active:cursor-grabbing",
                (isMenuOpen || isDragging) && "bg-muted text-foreground",
                isDragging && "opacity-60",
              )}
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                left: anchorPosition.handleLeft,
                top: anchorPosition.handleTop,
              }}
              aria-label="블록 도구 열기"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <GripVertical className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            클릭해서 메뉴 열기, 드래그해서 이동
          </TooltipContent>
        </Tooltip>

        <BlockActionMenu
          editor={editor}
          onDeleteBlock={handleDeleteBlock}
          onCloseMenu={() => handleMenuOpenChange(false)}
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

// 마우스 위치에서 블록을 찾는다. 좌측 여백(핸들 자리)에 있어도 같은 줄의 블록을 잡도록
// x 좌표를 콘텐츠 영역 안으로 당긴 뒤 ProseMirror에게 위치를 물어본다.
export function getHoverBlockElement(
  editor: Editor,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  if (editor.isDestroyed) {
    return null;
  }

  const rootElement = editor.view.dom;
  const rootRect = rootElement.getBoundingClientRect();

  if (clientY < rootRect.top || clientY > rootRect.bottom) {
    return null;
  }

  if (clientX < rootRect.left - HOVER_GUTTER || clientX > rootRect.right) {
    return null;
  }

  const probeX = Math.min(
    Math.max(clientX, rootRect.left + 1),
    Math.max(rootRect.right - 1, rootRect.left + 1),
  );
  const coords = editor.view.posAtCoords({ left: probeX, top: clientY });

  if (!coords) {
    return null;
  }

  const domNode =
    coords.inside >= 0
      ? editor.view.nodeDOM(coords.inside)
      : editor.view.domAtPos(coords.pos).node;

  return resolveBlockElement(rootElement, toHTMLElement(domNode));
}

export function resolveBlockElement(
  rootElement: HTMLElement,
  element: HTMLElement | null,
): HTMLElement | null {
  if (!element || !rootElement.contains(element)) {
    return null;
  }

  if (element instanceof HTMLImageElement) {
    return element;
  }

  const tableElement = element.closest("table");

  if (
    tableElement instanceof HTMLElement &&
    rootElement.contains(tableElement)
  ) {
    return tableElement;
  }

  const listItemElement = element.closest("li");

  if (
    listItemElement instanceof HTMLElement &&
    rootElement.contains(listItemElement)
  ) {
    return listItemElement;
  }

  const blockquoteElement = element.closest("blockquote");

  if (
    blockquoteElement instanceof HTMLElement &&
    rootElement.contains(blockquoteElement)
  ) {
    return blockquoteElement;
  }

  const blockElement = element.closest(
    "p, h1, h2, h3, pre, blockquote, hr, img",
  );

  if (
    blockElement instanceof HTMLElement &&
    rootElement.contains(blockElement)
  ) {
    return blockElement;
  }

  return null;
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

  const selectedElement = toHTMLElement(selectedNodeDom);
  const currentElement = toHTMLElement(domAtPos.node);
  const activeElement = selectedElement ?? currentElement;

  if (!activeElement) {
    return null;
  }

  const blockElement = resolveBlockElement(rootElement, activeElement);

  if (blockElement) {
    return blockElement;
  }

  return rootElement.firstElementChild instanceof HTMLElement
    ? rootElement.firstElementChild
    : null;
}

function toHTMLElement(node: Node | null | undefined): HTMLElement | null {
  if (node instanceof HTMLElement) {
    return node;
  }

  if (node instanceof Text) {
    return node.parentElement;
  }

  return null;
}
