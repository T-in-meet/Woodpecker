import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatMessage } from "../types";

type NoteChatMessageListProps = {
  /** 대화 순서대로 표시할 노트 챗봇 메시지입니다. */
  messages: NoteChatMessage[];
};

/**
 * 노트 챗봇의 저장된 대화 메시지를 순서대로 표시합니다.
 *
 * User Message와 Assistant Message의 JSON content는
 * 각각의 Zod Schema로 검증한 뒤 화면에 표시합니다.
 *
 * Assistant Message의 usedNoteIds는 이후 참고 노트 UI 연결에 사용하며,
 * 현재 단계에서는 답변 본문만 표시합니다.
 *
 * @param props 대화 메시지 목록
 * @returns 노트 챗봇 메시지 목록
 */
export function NoteChatMessageList({ messages }: NoteChatMessageListProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        switch (message.role) {
          case AI_CHAT_MESSAGE_ROLE.USER: {
            const content = noteChatUserMessageContentSchema.parse(
              message.content,
            );

            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">
                  {content.text}
                </div>
              </div>
            );
          }

          case AI_CHAT_MESSAGE_ROLE.ASSISTANT: {
            const content = noteChatAssistantMessageContentSchema.parse(
              message.content,
            );

            return (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-7">
                  {content.text}
                </div>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
