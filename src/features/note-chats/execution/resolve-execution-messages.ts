import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";

import { noteChatUserMessageContentSchema } from "../schema";
import type { NoteChatMessage } from "../types";
import { buildNoteChatProviderMessages } from "./build-provider-messages";
import { resolveNoteChatProviderMessages } from "./resolve-messages";

type ResolveNoteChatExecutionMessagesParams = {
  /** 검색된 노트로 구성한 Context입니다. */
  context: string;

  /** 대화 순서대로 정렬된 전체 메시지입니다. */
  messages: NoteChatMessage[];

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;

  /** 실행에 사용할 Prompt Version의 System Template입니다. */
  systemTemplate: string;

  /** 실행에 사용할 Prompt Version의 User Template입니다. */
  userTemplate: string;
};

/**
 * 현재 사용자 메시지와 이전 대화 이력을 기준으로
 * AI Provider에 전달할 최종 메시지 목록을 생성합니다.
 *
 * 현재 사용자 메시지는 Prompt Template의 `question` 변수로 전달하고,
 * 검색된 Note Context는 `context` 변수로 전달합니다.
 *
 * 해당 메시지보다 이전에 생성된 메시지만 대화 이력으로 포함합니다.
 *
 * @param params 전체 대화 메시지와 현재 실행 정보
 * @returns AI Provider에 전달할 최종 메시지 목록
 */
export function resolveNoteChatExecutionMessages(
  params: ResolveNoteChatExecutionMessagesParams,
): AiProviderChatMessage[] {
  const currentUserMessage = params.messages.find(
    (message) => message.id === params.userMessageId,
  );

  if (!currentUserMessage) {
    throw new Error(
      `Note chat user message not found: ${params.userMessageId}`,
    );
  }

  if (currentUserMessage.role !== AI_CHAT_MESSAGE_ROLE.USER) {
    throw new Error(
      `Note chat execution message is not a user message: ${params.userMessageId}`,
    );
  }

  /*
   * DB JSON 값을 사용자 메시지 스키마로 검증한 뒤,
   * 현재 질문 문자열을 안전하게 추출합니다.
   */
  const currentContent = noteChatUserMessageContentSchema.parse(
    currentUserMessage.content,
  );

  /*
   * 현재 질문보다 앞선 메시지만 이전 대화 이력으로 사용합니다.
   * 수정 후 재실행 시 현재 메시지 이후 데이터가 남아 있더라도
   * Provider 요청에 포함되지 않도록 sequence_number를 기준으로 제한합니다.
   */
  const historyMessages = params.messages.filter(
    (message) => message.sequence_number < currentUserMessage.sequence_number,
  );

  const providerHistoryMessages =
    resolveNoteChatProviderMessages(historyMessages);

  return buildNoteChatProviderMessages({
    context: params.context,
    historyMessages: providerHistoryMessages,
    question: currentContent.text,
    systemTemplate: params.systemTemplate,
    userTemplate: params.userTemplate,
  });
}
