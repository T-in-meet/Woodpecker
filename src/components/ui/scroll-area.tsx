"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * 공통 ScrollArea 컴포넌트의 입력값입니다.
 *
 * Radix ScrollArea의 실제 스크롤은 Root가 아니라 내부 Viewport에서 발생하므로,
 * 스크롤 위치를 직접 관찰해야 하는 화면에서는 Viewport ref와 scroll handler가 필요합니다.
 *
 * 기존 ScrollArea 사용처에는 영향을 주지 않도록 두 속성은 모두 선택값으로 제공합니다.
 */
type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** ScrollArea Viewport에 추가로 적용할 className입니다. */
  viewportClassName?: string;

  /**
   * 실제 스크롤이 발생하는 ScrollArea Viewport에 접근하기 위한 ref입니다.
   *
   * 스크롤 위치, 높이 등을 직접 확인해야 하는 화면에서만 사용합니다.
   */
  viewportRef?: React.Ref<HTMLDivElement>;

  /**
   * 실제 ScrollArea Viewport의 scroll 이벤트를 처리합니다.
   *
   * Root에는 scroll 이벤트가 발생하지 않으므로
   * 현재 스크롤 위치를 추적해야 하는 화면에서 사용합니다.
   */
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
};

function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  onViewportScroll,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName,
        )}
        onScroll={onViewportScroll}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
