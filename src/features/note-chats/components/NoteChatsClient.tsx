"use client";

import { useNoteChatConversationListQuery } from "../hooks/use-note-chat-conversation-list-query";
import { NoteChatConversationList } from "./NoteChatConversationList";
import { NoteChatConversationSidebar } from "./NoteChatConversationSidebar";
import { NoteChatCreateDialog } from "./NoteChatCreateDialog";

/**
 * 노트 챗봇 사용자 화면의 전체 레이아웃을 렌더링합니다.
 */
export function NoteChatsClient() {
  const {
    data: conversations = [],
    isLoading,
    isError,
  } = useNoteChatConversationListQuery();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-10 md:px-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-foreground">노트 챗봇</h1>
        <p className="text-sm text-muted-foreground">
          저장한 노트를 바탕으로 질문하고 답변을 확인해 보세요.
        </p>
      </div>

      <div className="grid min-h-150 overflow-hidden rounded-lg border md:grid-cols-[280px_minmax(0,1fr)]">
        <NoteChatConversationSidebar />

        <section className="flex min-h-0 flex-col">
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-muted-foreground">
              대화를 선택하거나 새 대화를 시작하세요.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
