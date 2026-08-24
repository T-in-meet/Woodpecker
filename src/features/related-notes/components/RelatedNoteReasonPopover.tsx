"use client";

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
 * 한 줄로 잘린 Related Note reason을 표시하고,
 * 클릭 시 전체 내용을 Popover로 보여줍니다.
 *
 * 목록의 한 줄 레이아웃은 유지하면서
 * 데스크톱과 모바일 모두 동일한 방식으로
 * 긴 reason의 전체 내용을 확인할 수 있도록 합니다.
 *
 * @param props 표시할 Related Note reason
 */
export function RelatedNoteReasonPopover({
  reason,
}: RelatedNoteReasonPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 w-[20%] cursor-pointer truncate text-left text-sm text-muted-foreground"
          aria-label="관련 노트 이유 보기"
        >
          {reason}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className="max-w-sm whitespace-normal rounded-sm border-amber-200 bg-amber-50 text-amber-950"
      >
        {reason}
      </PopoverContent>
    </Popover>
  );
}
