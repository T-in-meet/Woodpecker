"use client";

import { Ellipsis, Siren } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ROUTES } from "@/lib/constants/routes";

/**
 * AI 추천 Related Note에 대한 추가 액션을 표시합니다.
 *
 * 현재는 신고 이동만 제공하며,
 * 이후 AI 추천 평가 기능이 추가되면 좋아요/싫어요 액션을 함께 제공합니다.
 *
 * @returns AI 추천 Related Note 액션 Popover
 */
export function RelatedNoteAiActionsPopover() {
  /*
   * TODO: Related Notes 신고 연결 시 신고 대상을 식별하기 위해
   * 현재 Note, 추천된 Note, 추천 실행/관계 중 어떤 정보를 문의 흐름에
   * 전달해야 하는지 검토합니다.
   */
  const reportSearchParams = new URLSearchParams({
    section: "support",
    tab: "inquiry",
  });

  const reportHref = `${ROUTES.MYPAGE}?${reportSearchParams.toString()}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="더보기"
          title="더보기"
        >
          <Ellipsis className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-1">
        {/* TODO: AI 추천 평가 기능 구현 후 좋아요/싫어요 액션을 추가합니다. */}
        <Button
          asChild
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2"
        >
          <Link href={reportHref} target="_blank">
            <Siren className="size-4" />
            <span>신고</span>
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
