"use client";

import { Tooltip } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

const TooltipProvider = Tooltip.Provider;
const TooltipRoot = Tooltip.Root;
const TooltipTrigger = Tooltip.Trigger;
const TooltipPortal = Tooltip.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Tooltip.Content>,
  React.ComponentPropsWithoutRef<typeof Tooltip.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <Tooltip.Portal>
    <Tooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
        className,
      )}
      {...props}
    />
  </Tooltip.Portal>
));
TooltipContent.displayName = Tooltip.Content.displayName;

export {
  TooltipRoot as Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
};
