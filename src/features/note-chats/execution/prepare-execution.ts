import type { AiProviderChatMessage } from "@/features/ai/providers/types";

import { getNoteChatConversationDetail } from "../queries";
import type { NoteChatRunSettings } from "../schema";
import type { NoteChatConversation } from "../types";
import { resolveNoteChatExecutionMessages } from "./resolve-execution-messages";
import type { NoteChatExecutionSettings } from "./resolve-settings";
import { resolveNoteChatExecutionSettings } from "./resolve-settings";

/**
 * Provider 스트리밍 호출 직전에 확정된 노트 챗봇 실행 정보입니다.
 */
export type PreparedNoteChatExecution = {
  /** 실행 대상 대화입니다. */
  conversation: NoteChatConversation;

  /** Provider에 전달할 System·대화 이력·현재 질문 메시지입니다. */
  messages: AiProviderChatMessage[];

  /** 검증을 마친 Prompt와 Model Config입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

type PrepareNoteChatExecutionParams = {
  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;

  /** 질문 또는 수정 요청에서 확정된 AI 설정 ID입니다. */
  settings: NoteChatRunSettings;
};

/**
 * 노트 챗봇 Provider 스트리밍 호출에 필요한 데이터를 준비합니다.
 *
 * 다음 작업을 수행합니다.
 *
 * 1. Prompt와 Chat·Embedding Model Config를 조회하고 검증합니다.
 * 2. 현재 사용자가 접근할 수 있는 대화와 전체 메시지를 조회합니다.
 * 3. 현재 사용자 메시지 이전의 대화 이력과 Prompt Template을 조합합니다.
 *
 * 이 함수는 Provider를 호출하거나 Run 상태를 변경하지 않습니다.
 *
 * @param params 대화, 사용자 메시지 및 AI 설정 정보
 * @returns Provider 호출 직전에 확정된 실행 정보
 */
export async function prepareNoteChatExecution(
  params: PrepareNoteChatExecutionParams,
): Promise<PreparedNoteChatExecution> {
  /*
   * AI 설정 조회와 대화 상세 조회는 서로 의존하지 않으므로
   * 병렬로 실행하여 준비 시간을 줄입니다.
   */
  const [settings, detail] = await Promise.all([
    resolveNoteChatExecutionSettings(params.settings),
    getNoteChatConversationDetail(params.conversationId),
  ]);

  if (!detail) {
    throw new Error(
      `Note chat conversation not found: ${params.conversationId}`,
    );
  }

  /*
   * 현재 사용자 메시지를 기준으로 이전 대화 이력과 현재 질문을 분리하고,
   * 선택한 Prompt Version의 Template을 사용해 최종 메시지를 생성합니다.
   */
  const messages = resolveNoteChatExecutionMessages({
    messages: detail.messages,
    systemTemplate: settings.prompt.version.system_template,
    userMessageId: params.userMessageId,
    userTemplate: settings.prompt.version.user_template,
  });

  return {
    conversation: detail.conversation,
    messages,
    settings,
    userMessageId: params.userMessageId,
  };
}
