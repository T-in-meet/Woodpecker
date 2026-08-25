"use client";

import { Check, Copy, Siren } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

/**
 * 노트 챗봇 AI 응답 액션 컴포넌트의 입력값입니다.
 */
type NoteChatAssistantMessageActionsProps = {
  content: string;
  messageId: string;
};

/**
 * 노트 챗봇 AI 응답의 액션 버튼을 표시합니다.
 *
 * 응답 복사와 신고 페이지 이동을 제공하며,
 * 신고 시 대상 메시지를 식별할 수 있도록 메시지 정보를 함께 전달합니다.
 *
 * @param props AI 응답 내용과 메시지 ID
 * @returns AI 응답 액션 버튼 영역
 */
export function NoteChatAssistantMessageActions({
  content,
  messageId,
}: NoteChatAssistantMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  /**
   * AI 응답 내용을 클립보드에 복사합니다.
   *
   * 복사가 완료되면 체크 아이콘을 표시하고,
   * 일정 시간이 지난 뒤 다시 복사 아이콘으로 복원합니다.
   */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  // 신고 페이지에서 대상 AI 응답을 식별할 수 있도록
  // 메시지 유형과 ID를 query parameter로 함께 전달합니다.
  const reportSearchParams = new URLSearchParams({
    section: "support",
    tab: "inquiry",
    targetType: "note-chat-message",
    targetId: messageId,
  });

  const reportHref = `${ROUTES.MYPAGE}?${reportSearchParams.toString()}`;

  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 rounded-md"
        aria-label={copied ? "복사 완료" : "응답 복사"}
        title={copied ? "복사 완료" : "응답 복사"}
        onClick={() => void handleCopy()}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>

      {/* TODO: AI 응답 평가 데이터 구조가 확정되면 좋아요/싫어요 액션을 추가합니다. */}

      <Button asChild size="icon" variant="ghost" className="size-8 rounded-md">
        <Link
          href={reportHref}
          target="_blank"
          aria-label="응답 신고"
          title="응답 신고"
        >
          <Siren className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
