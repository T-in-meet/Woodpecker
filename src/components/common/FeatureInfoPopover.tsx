"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

type FeatureInfoPopoverProps = {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

export function FeatureInfoPopover({
  children,
  ariaLabel = "기능 안내 보기",
  className,
  align = "start",
  sideOffset = 4,
}: FeatureInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
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
        align={align}
        sideOffset={sideOffset}
        className="w-72 text-sm leading-relaxed"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
