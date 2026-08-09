import Link from "next/link";

import { getNoteChatConversationRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import type { NoteChatConversationListItem } from "../types";

type NoteChatConversationListProps = {
  conversations: NoteChatConversationListItem[];
  selectedConversationId?: string;
  isSearching?: boolean;
};

/**
 * 사용자의 노트 챗봇 Conversation 목록을 표시합니다.
 *
 * @param props Conversation 목록과 현재 선택된 Conversation ID
 * @returns 노트 챗봇 대화 목록
 */
export function NoteChatConversationList({
  conversations,
  selectedConversationId,
  isSearching = false,
}: NoteChatConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {isSearching
            ? "검색 결과가 없습니다."
            : "아직 생성된 대화가 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-1">
      {conversations.map((conversation) => {
        if (!conversation.id) {
          return null;
        }

        const isSelected = conversation.id === selectedConversationId;
        const lastMessage = getLastMessageText(
          conversation.last_message_content,
        );

        return (
          <li key={conversation.id}>
            <Link
              href={getNoteChatConversationRoute(conversation.id)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-3 transition-colors hover:bg-muted",
                isSelected && "bg-muted",
              )}
            >
              <p className="truncate text-sm font-medium">
                {conversation.title}
              </p>

              <p className="mt-1 truncate text-xs text-muted-foreground">
                {lastMessage ?? "아직 메시지가 없습니다."}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Conversation 목록 View의 마지막 메시지 content에서
 * 화면에 표시할 text를 추출합니다.
 */
function getLastMessageText(content: unknown): string | null {
  if (
    typeof content !== "object" ||
    content === null ||
    !("text" in content) ||
    typeof content.text !== "string"
  ) {
    return null;
  }

  const text = content.text.trim();

  return text.length > 0 ? text : null;
}
