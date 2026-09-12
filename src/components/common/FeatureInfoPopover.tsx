"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

const MAX_CONTENT_WIDTH_REM = 18;
const VIEWPORT_PADDING_PX = 16;

type FeatureInfoPopoverProps = {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /**
   * true면 세로 위치는 트리거 아이콘 바로 아래를 유지하면서, 가로로는
   * 감싸는 dialog의 가로 중앙에 오도록 alignOffset을 계산해 더한다.
   * 아이콘이 컨테이너 왼쪽에 치우쳐 있어 트리거 기준 정렬로는 좁은
   * 화면에서 팝오버가 한쪽으로 쏠릴 때 쓴다.
   */
  centerOnScreen?: boolean;
};

export function FeatureInfoPopover({
  children,
  ariaLabel = "기능 안내 보기",
  className,
  align = "start",
  sideOffset = 4,
  centerOnScreen = false,
}: FeatureInfoPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [alignOffset, setAlignOffset] = useState(0);

  const handleOpenChange = (open: boolean) => {
    if (!open || !centerOnScreen || !triggerRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const containerRect = (
      triggerRef.current.closest('[role="dialog"]') ?? document.body
    ).getBoundingClientRect();
    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const contentWidth = Math.min(
      MAX_CONTENT_WIDTH_REM * rootFontSize,
      window.innerWidth - VIEWPORT_PADDING_PX * 2,
    );

    setAlignOffset(
      containerRect.left +
        containerRect.width / 2 -
        contentWidth / 2 -
        triggerRect.left,
    );
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className={cn(
            "size-6 text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={centerOnScreen ? "start" : align}
        alignOffset={centerOnScreen ? alignOffset : 0}
        sideOffset={sideOffset}
        collisionPadding={VIEWPORT_PADDING_PX}
        className="w-[min(18rem,calc(100vw-2rem))] text-sm leading-relaxed"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
