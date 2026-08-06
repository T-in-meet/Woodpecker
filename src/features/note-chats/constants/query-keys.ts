/**
 * 노트 챗봇 관련 TanStack Query Key를 관리합니다.
 */
export const noteChatQueryKeys = {
  all: ["note-chats"] as const,

  conversations: () => [...noteChatQueryKeys.all, "conversations"] as const,

  conversationList: () =>
    [...noteChatQueryKeys.conversations(), "list"] as const,

  conversationDetail: (conversationId: string) =>
    [...noteChatQueryKeys.conversations(), "detail", conversationId] as const,
};
