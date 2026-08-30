"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

type NoteChatUserMessageProps = {
  text: string;
  isStreaming?: boolean;
  onEdit?: () => void;
};

/**
 * 노트 챗봇 사용자 메시지를 표시합니다.
 */
export function NoteChatUserMessage({
  text,
  isStreaming = false,
  onEdit,
}: NoteChatUserMessageProps) {
  return (
    <li className="group flex justify-end">
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
