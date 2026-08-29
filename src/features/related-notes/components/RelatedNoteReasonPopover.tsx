"use client";

import { MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type RelatedNoteReasonPopoverProps = {
  /** 화면에 표시할 Related Note reason입니다. */
  reason: string;
};

/**
 * Related Note의 연결 이유를 아이콘으로 표시하고,
 * 클릭 시 전체 내용을 Popover로 보여줍니다.
 *
 * 데스크톱과 모바일 모두 동일한 방식으로
 * reason의 전체 내용을 확인할 수 있도록 합니다.
 *
 * @param props 표시할 Related Note reason
 */
export function RelatedNoteReasonPopover({
  reason,
}: RelatedNoteReasonPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="관련 노트 이유 보기"
        >
          <MessageSquareText className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        sideOffset={6}
        collisionPadding={12}
        className="text-prose-ko w-auto max-w-[calc(100vw-1.5rem)] whitespace-normal rounded-sm border-amber-200 bg-amber-50 text-amber-950 sm:max-w-sm"
      >
        {reason}
      </PopoverContent>
    </Popover>
  );
}
