"use client";

import { Pencil } from "lucide-react";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";

type NoteChatUserMessageProps = {
  text: string;
  isStreaming?: boolean;
  onEdit?: () => void;

  /**
   * 이 사용자 질문을 스크롤 대상으로 사용할 때 연결할 ref입니다.
   *
   * 실제 스크롤 정책과 위치 계산은 상위 Conversation scroll hook이 담당하며,
   * 이 컴포넌트는 대상 DOM 요소만 제공합니다.
   */
  messageRef?: Ref<HTMLLIElement>;
};

/**
 * 노트 챗봇 사용자 메시지를 표시합니다.
 */
export function NoteChatUserMessage({
  text,
  isStreaming = false,
  onEdit,
  messageRef,
}: NoteChatUserMessageProps) {
  return (
    <li ref={messageRef} className="group flex justify-end">
      <div className="flex max-w-[85%] items-end gap-1 md:max-w-[75%]">
        {onEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label="질문 수정"
            disabled={isStreaming}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}

        <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </li>
  );
}
