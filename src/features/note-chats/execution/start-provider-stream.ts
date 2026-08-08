import { streamAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiChatStreamEvent } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";

import type { PreparedNoteChatExecution } from "./prepare-execution";

/**
 * 준비된 노트 챗봇 실행 정보로 AI Provider 스트림을 시작합니다.
 *
 * Provider별 요청과 응답 정규화는 AI Foundation이 담당하며,
 * 이 함수는 노트 챗봇에서 사용할 모델과 메시지를 전달하는 역할만 담당합니다.
 *
 * @param prepared Provider 호출 직전에 확정된 실행 정보
 * @returns Provider 공통 Chat 스트림
 */
export function startNoteChatProviderStream(
  prepared: PreparedNoteChatExecution,
): AsyncGenerator<AiChatStreamEvent> {
  const chatConfiguration = prepared.settings.chat;
  const chatModel = chatConfiguration.model;

  return streamAiChatCompletionWithProvider({
    apiKey: getProviderApiKey(chatModel.provider),
    messages: prepared.messages,
    model: chatModel.model,
    provider: chatModel.provider,
    temperature: chatConfiguration.temperature,
  });
}
