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
// hover 대상 블록을 다시 계산하는 최소 간격. 짧으면 지나치는 줄마다 핸들이 튄다.
const HOVER_UPDATE_INTERVAL_MS = 80;
// 구분선처럼 높이가 거의 없는 블록도 hover로 잡히도록 보장하는 최소 판정 높이.
const HOVER_MIN_BLOCK_HEIGHT = 20;
// 같은 이유로, 블록 하이라이트도 이보다 얇게 그리지 않는다.
const OVERLAY_MIN_HEIGHT = 20;
const BLOCK_ELEMENT_SELECTOR = "p, h1, h2, h3, pre, blockquote, hr, img";
// 리스트 항목과 표는 그 자체가 한 블록이라 hover 후보에 포함한다.
const HOVER_BLOCK_ELEMENT_SELECTOR = `${BLOCK_ELEMENT_SELECTOR}, li, table`;
// 이보다 오래 누르거나 많이 움직이면 드래그 의도로 보고 메뉴를 열지 않는다.
const CLICK_MAX_DURATION_MS = 300;
const CLICK_MAX_DISTANCE_PX = 4;
// 브라우저에 따라 dragend가 drop보다 먼저 오는 경우가 있어 ProseMirror와 같은 지연을 둔다.
const DRAG_END_CLEANUP_DELAY_MS = 50;

type BlockHandleMenuProps = {
  editor: Editor;
  // 블록 메뉴가 열려 있는 동안에는 선택 영역 기반 인라인 툴바를 감춰야 한다.
  onMenuOpenChange?: (isOpen: boolean) => void;
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

export function BlockHandleMenu({
  editor,
  onMenuOpenChange,
}: BlockHandleMenuProps) {
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
  const hoverTimeoutRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
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
        getBlockHandleTop(blockElement, effectiveRect),
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

    const applyHoveredBlockElement = () => {
      const pointer = lastPointerRef.current;

      if (!pointer) {
        return;
      }

      const nextHoveredBlockElement = getHoverBlockElement(
        editor,
        pointer.x,
        pointer.y,
      );

      // 블록 사이 여백에서는 ProseMirror가 문서 최상위를 가리켜 블록을 못 찾는다.
      // 이때 핸들을 숨기면 줄을 옮길 때마다 깜빡이므로 직전 블록을 유지한다.
      if (
        !nextHoveredBlockElement &&
        isPointerNearEditor(editor, pointer.x, pointer.y)
      ) {
        return;
      }

      if (nextHoveredBlockElement === hoveredBlockRef.current) {
        return;
      }

      hoveredBlockRef.current = nextHoveredBlockElement;
      syncAnchorPosition();
    };

    // 노션처럼 마우스를 올린 블록으로 핸들이 따라다니게 한다. 매 프레임 갱신하면
    // 지나치는 줄마다 핸들이 튀므로, 커서가 머무는 줄에 정착하도록 간격을 둔다.
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      if (pinnedBlockRef.current) {
        return;
      }

      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      if (hoverTimeoutRef.current !== null) {
        return;
      }

      hoverTimeoutRef.current = window.setTimeout(() => {
        hoverTimeoutRef.current = null;
        applyHoveredBlockElement();
      }, HOVER_UPDATE_INTERVAL_MS);
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

      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current);
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
    onMenuOpenChange?.(nextOpen);
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
  // 구분선은 높이가 1px이라 그대로 그리면 하이라이트가 보이지 않는다.
  const overlayHeight = Math.max(
    anchorPosition.blockHeight,
    OVERLAY_MIN_HEIGHT,
  );
  const overlayTop =
    anchorPosition.blockTop - (overlayHeight - anchorPosition.blockHeight) / 2;

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
            top: overlayTop,
            width: overlayWidth,
            height: overlayHeight,
          }}
          data-testid="block-handle-overlay"
        />
      )}

      {/* modal이면 메뉴가 열릴 때 body 스크롤이 잠겨 스크롤바가 사라진다. scrollbar-gutter
          보정과 겹쳐 화면이 흔들리므로, 가볍게 뜨는 블록 메뉴에는 잠금을 쓰지 않는다. */}
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={handleMenuOpenChange}
        modal={false}
      >
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

// 블록 전체 높이의 중앙에 맞추면, 중첩 목록이 달린 항목이나 여러 줄로 줄바꿈된 문단에서
// 커서가 있는 첫 줄이 아니라 중간 줄 옆에 핸들이 뜬다. 첫 줄 높이에 맞춘다.
export function getBlockHandleTop(
  blockElement: HTMLElement,
  blockRect: { top: number; height: number },
): number {
  const blockStyles = window.getComputedStyle(blockElement);
  const lineHeight = Number.parseFloat(blockStyles.lineHeight);
  const paddingTop = Number.parseFloat(blockStyles.paddingTop);
  // line-height가 "normal"이면 숫자를 얻을 수 없으므로 기존처럼 블록 높이를 쓴다.
  const firstLineHeight =
    Number.isFinite(lineHeight) && lineHeight > 0
      ? Math.min(lineHeight, blockRect.height)
      : blockRect.height;
  const offsetTop = Number.isFinite(paddingTop) ? paddingTop : 0;

  // 구분선처럼 핸들보다 얇은 블록에서는 값이 음수가 되어 핸들이 블록 중앙에 걸린다.
  return blockRect.top + offsetTop + (firstLineHeight - HANDLE_SIZE) / 2;
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

// 핸들이 에디터 왼쪽 바깥에 뜨므로 그 여백까지는 에디터 위에 있는 것으로 본다.
export function isPointerNearEditor(
  editor: Editor,
  clientX: number,
  clientY: number,
): boolean {
  if (editor.isDestroyed) {
    return false;
  }

  const rootRect = editor.view.dom.getBoundingClientRect();

  return (
    clientY >= rootRect.top &&
    clientY <= rootRect.bottom &&
    clientX >= rootRect.left - HOVER_GUTTER &&
    clientX <= rootRect.right
  );
}

// 마우스가 올라간 블록을 세로 위치(줄)로 찾는다. ProseMirror의 posAtCoords는 브라우저
// 캐럿 API를 쓰기 때문에 글자가 없는 빈 공간(들여쓰기, 마커 자리, 문단 오른쪽 여백)에서
// 엉뚱한 노드를 돌려준다. 같은 줄이면 x가 어디든 같은 블록이 잡히도록 직접 찾는다.
export function getHoverBlockElement(
  editor: Editor,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  if (!isPointerNearEditor(editor, clientX, clientY)) {
    return null;
  }

  const rootElement = editor.view.dom;
  const containerElement = findChildElementAtY(rootElement, clientY);

  if (!containerElement) {
    return null;
  }

  // 중첩 목록처럼 블록 안에 블록이 있으면 가장 안쪽(= 그 줄에 해당하는) 것을 쓴다.
  const innermostElement =
    findInnermostBlockElementAtY(containerElement, clientY) ?? containerElement;

  return resolveBlockElement(rootElement, innermostElement);
}

// 구분선(hr)은 높이가 1px이라 그 위에 커서를 정확히 올려야만 잡힌다. 얇은 블록은
// 위아래로 넓혀서 판정한다. 넓히는 폭이 블록 사이 여백보다 작아 이웃을 침범하지 않는다.
export function containsY(element: HTMLElement, clientY: number): boolean {
  const rect = element.getBoundingClientRect();

  if (rect.height <= 0 && rect.width <= 0) {
    return false;
  }

  const hoverPadding = Math.max(0, (HOVER_MIN_BLOCK_HEIGHT - rect.height) / 2);

  return (
    clientY >= rect.top - hoverPadding && clientY <= rect.bottom + hoverPadding
  );
}

function findChildElementAtY(
  parentElement: HTMLElement,
  clientY: number,
): HTMLElement | null {
  for (const child of parentElement.children) {
    if (child instanceof HTMLElement && containsY(child, clientY)) {
      return child;
    }
  }

  return null;
}

function findInnermostBlockElementAtY(
  containerElement: HTMLElement,
  clientY: number,
): HTMLElement | null {
  let innermostElement: HTMLElement | null = null;
  let innermostDepth = -1;

  for (const candidate of containerElement.querySelectorAll(
    HOVER_BLOCK_ELEMENT_SELECTOR,
  )) {
    if (!(candidate instanceof HTMLElement) || !containsY(candidate, clientY)) {
      continue;
    }

    const depth = getElementDepth(containerElement, candidate);

    if (depth > innermostDepth) {
      innermostElement = candidate;
      innermostDepth = depth;
    }
  }

  return innermostElement;
}

function getElementDepth(
  rootElement: HTMLElement,
  element: HTMLElement,
): number {
  let depth = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement !== rootElement) {
    depth += 1;
    currentElement = currentElement.parentElement;
  }

  return depth;
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
    // 항목의 첫 블록은 마커와 함께 움직여야 하므로 항목 전체를 대상으로 둔다.
    // 뒤따르는 블록(항목 안에 들어온 헤딩 등)은 그 블록 자체를 잡아야
    // 핸들이 그 줄 앞에 놓이고 따로 드래그해 빼낼 수 있다.
    const ownBlockElement = element.closest(BLOCK_ELEMENT_SELECTOR);

    if (
      !(ownBlockElement instanceof HTMLElement) ||
      !listItemElement.contains(ownBlockElement) ||
      listItemElement.querySelector(BLOCK_ELEMENT_SELECTOR) === ownBlockElement
    ) {
      return listItemElement;
    }

    return ownBlockElement;
  }

  const blockquoteElement = element.closest("blockquote");

  if (
    blockquoteElement instanceof HTMLElement &&
    rootElement.contains(blockquoteElement)
  ) {
    return blockquoteElement;
  }

  const blockElement = element.closest(BLOCK_ELEMENT_SELECTOR);

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
