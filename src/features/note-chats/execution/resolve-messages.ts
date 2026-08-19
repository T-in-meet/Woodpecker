import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";

import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatMessage } from "../types";

/**
 * 노트 챗봇 DB 메시지를 AI Provider에 전달할 공통 메시지로 변환합니다.
 *
 * DB에 저장된 메시지의 `sequence_number` 순서는 호출자가 보장해야 합니다.
 * 사용자 메시지는 Provider의 `user`, AI 메시지는 `assistant` 역할로 변환합니다.
 *
 * @param messages 대화 순서대로 정렬된 노트 챗봇 메시지
 * @returns AI Provider에 전달할 공통 메시지 목록
 */
export function resolveNoteChatProviderMessages(
  messages: NoteChatMessage[],
): AiProviderChatMessage[] {
  return messages.map((message) => {
    switch (message.role) {
      case AI_CHAT_MESSAGE_ROLE.USER: {
        /*
         * DB의 JSON content를 사용자 메시지 스키마로 다시 검증하여
         * Provider에 문자열이 아닌 잘못된 값이 전달되지 않도록 합니다.
         */
        const content = noteChatUserMessageContentSchema.parse(message.content);

        return {
          role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
          content: content.text,
        };
      }

      case AI_CHAT_MESSAGE_ROLE.ASSISTANT: {
        /*
         * Assistant content에는 usedNoteIds도 포함되지만,
         * 이전 대화 이력에는 답변 본문만 전달합니다.
         */
        const content = noteChatAssistantMessageContentSchema.parse(
          message.content,
        );

        return {
          role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
          content: content.text,
        };
      }

      default: {
        /*
         * DB 제약조건과 타입이 어긋난 상태를 조용히 무시하지 않고
         * 실행을 중단하여 잘못된 대화 이력이 Provider에 전달되지 않게 합니다.
         */
        throw new Error(`Unsupported note chat message role: ${message.role}`);
      }
    }
  });
}
