/**
 * 노트 챗봇 관련 TanStack Query Key를 관리합니다.
 */
export const noteChatQueryKeys = {
  all: ["note-chats"] as const,

  conversations: () => [...noteChatQueryKeys.all, "conversations"] as const,

  conversationLists: () =>
    [...noteChatQueryKeys.conversations(), "list"] as const,

  conversationList: (params: { page: number; search: string }) =>
    [...noteChatQueryKeys.conversationLists(), params] as const,

  conversationDetail: (conversationId: string) =>
    [...noteChatQueryKeys.conversations(), "detail", conversationId] as const,

  conversationMessages: (conversationId: string) =>
    [...noteChatQueryKeys.conversations(), "messages", conversationId] as const,

  /*
   * Note Chat 일일 사용량은 특정 Conversation이 아니라
   * 현재 사용자의 전체 Note Chat 실행을 기준으로 관리합니다.
   */
  dailyUsage: () => [...noteChatQueryKeys.all, "daily-usage"] as const,
};
