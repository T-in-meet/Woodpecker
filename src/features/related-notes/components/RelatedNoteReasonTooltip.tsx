"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RelatedNoteReasonTooltipProps = {
  /** 화면에 표시할 Related Note reason입니다. */
  reason: string;
};

/**
 * 한 줄로 잘린 Related Note reason을 표시하고,
 * hover 시 전체 내용을 Tooltip으로 보여줍니다.
 *
 * 목록의 한 줄 레이아웃은 유지하면서
 * 긴 reason도 전체 내용을 확인할 수 있도록 합니다.
 *
 * @param props 표시할 Related Note reason
 */
export function RelatedNoteReasonTooltip({
  reason,
}: RelatedNoteReasonTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0 w-[20%] truncate text-sm text-muted-foreground">
          {reason}
        </span>
      </TooltipTrigger>

      <TooltipContent className="max-w-sm whitespace-normal rounded-sm border-amber-200 bg-amber-50 text-amber-950">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
