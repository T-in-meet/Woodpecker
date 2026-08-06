import { AI_MODEL_PROVIDER } from "@/features/ai/constants/models";
import { streamAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiChatStreamEvent } from "@/features/ai/providers/types";

import { NOTE_CHAT_DEFAULT_TEMPERATURE } from "../constants";
import type { PreparedNoteChatExecution } from "./prepare-execution";

/**
 * AI Provider별 API Key를 서버 환경 변수에서 조회합니다.
 *
 * @param provider 실행할 AI Provider
 * @returns Provider API Key
 */
function getNoteChatProviderApiKey(provider: string): string {
  switch (provider) {
    case AI_MODEL_PROVIDER.OPENAI: {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      return apiKey;
    }

    case AI_MODEL_PROVIDER.GOOGLE: {
      const apiKey = process.env.GOOGLE_API_KEY;

      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is not configured.");
      }

      return apiKey;
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

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
  const chatModel = prepared.settings.chatModel;

  return streamAiChatCompletionWithProvider({
    apiKey: getNoteChatProviderApiKey(chatModel.provider),
    messages: prepared.messages,
    model: chatModel.model,
    provider: chatModel.provider,
    temperature: NOTE_CHAT_DEFAULT_TEMPERATURE,
  });
}
