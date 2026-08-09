import Link from "next/link";

import { getNoteChatConversationRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import type { NoteChatConversationListItem } from "../types";
import { NoteChatConversationMenu } from "./NoteChatConversationMenu";

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
      <p className="px-3 py-4 text-sm text-muted-foreground">
        {isSearching ? "검색 결과가 없습니다." : "대화가 없습니다."}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((conversation) => {
        if (!conversation.id) {
          return null;
        }

        const isSelected = conversation.id === selectedConversationId;
        const lastMessage = getLastMessageText(
          conversation.last_message_content,
        );

        return (
          <li
            key={conversation.id}
            className={cn(
              "flex items-center gap-2 rounded-md transition-colors hover:bg-muted",
              isSelected && "bg-muted",
            )}
          >
            <Link
              href={getNoteChatConversationRoute(conversation.id)}
              aria-current={isSelected ? "page" : undefined}
              className="min-w-0 flex-1 px-3 py-3"
            >
              <p className="truncate text-sm font-medium">
                {conversation.title}
              </p>

              <p className="mt-1 truncate text-xs text-muted-foreground">
                {lastMessage ?? "아직 메시지가 없습니다."}
              </p>
            </Link>

            <div className="shrink-0 pr-2">
              <NoteChatConversationMenu
                conversationId={conversation.id}
                title={conversation.title ?? ""}
              />
            </div>
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
