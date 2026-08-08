import { getNoteChatConversationDetail } from "../queries";
import { NoteChatComposer } from "./note-chat-composer";
import { NoteChatMessageList } from "./note-chat-message-list";

type NoteChatConversationProps = {
  /** 표시할 노트 챗봇 대화 ID입니다. */
  conversationId: string;
};

/**
 * 하나의 노트 챗봇 대화 화면을 구성합니다.
 *
 * 대화 상세와 저장된 Message 목록을 직접 조회하고,
 * Message 목록과 질문 Composer를 하나의 화면으로 구성합니다.
 *
 * @param props 표시할 Conversation ID
 * @returns 노트 챗봇 대화 화면
 */
export async function NoteChatConversation({
  conversationId,
}: NoteChatConversationProps) {
  const detail = await getNoteChatConversationDetail(conversationId);

  if (!detail) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        대화를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <section
      aria-label={detail.conversation.title}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <NoteChatMessageList messages={detail.messages} />
      </div>

      <div className="border-t bg-background p-4">
        <NoteChatComposer conversationId={detail.conversation.id} />
      </div>
    </section>
  );
}
