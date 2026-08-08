import type { AiProviderChatMessage } from "@/features/ai/providers/types";
import type {
  AiRuntimeChatConfiguration,
  AiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/types";
import type { Json } from "@/types/db.helpers";

import { getNoteChatConversationDetail } from "../queries";
import type { NoteChatConversation } from "../types";
import { resolveNoteChatExecutionMessages } from "./resolve-execution-messages";

/**
 * 노트 챗봇 한 번의 실행에서 확정된 AI Runtime 설정입니다.
 */
export type NoteChatExecutionSettings = {
  /** 답변 생성에 사용할 Chat Runtime Configuration입니다. */
  chat: AiRuntimeChatConfiguration;

  /** 노트 검색에 사용할 Embedding Runtime Configuration입니다. */
  embedding: AiRuntimeEmbeddingConfiguration;
};

/**
 * Provider 스트리밍 호출 직전에 확정된 노트 챗봇 실행 정보입니다.
 */
export type PreparedNoteChatExecution = {
  /** 실행 대상 대화입니다. */
  conversation: NoteChatConversation;

  /** Provider에 전달할 System·대화 이력·현재 질문 메시지입니다. */
  messages: AiProviderChatMessage[];

  /** AI Foundation Runtime에서 확정된 실행 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;

  /** 답변 생성 과정에서 참고한 노트 ID 목록입니다. */
  referencedNoteIds: string[];

  /** 실행 과정에서 생성된 Context 출처 Snapshot입니다. */
  sources: Json[];
};

type PrepareNoteChatExecutionParams = {
  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** Route에서 확정된 AI Runtime 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/**
 * 노트 챗봇 Provider 스트리밍 호출에 필요한 데이터를 준비합니다.
 *
 * 다음 작업을 수행합니다.
 *
 * 1. 현재 사용자가 접근할 수 있는 대화와 전체 메시지를 조회합니다.
 * 2. Runtime에서 확정된 Prompt Template을 사용합니다.
 * 3. 현재 사용자 메시지 이전의 대화 이력과 Prompt를 조합합니다.
 *
 * AI Runtime Configuration은 Route에서 이미 조회·검증되었으므로
 * 이 함수에서는 다시 조회하지 않습니다.
 *
 * 이 함수는 Provider를 호출하거나 Run 상태를 변경하지 않습니다.
 *
 * @param params 대화, 사용자 메시지 및 확정된 Runtime 설정
 * @returns Provider 호출 직전에 확정된 실행 정보
 */
export async function prepareNoteChatExecution(
  params: PrepareNoteChatExecutionParams,
): Promise<PreparedNoteChatExecution> {
  const detail = await getNoteChatConversationDetail(params.conversationId);

  if (!detail) {
    throw new Error(
      `Note chat conversation not found: ${params.conversationId}`,
    );
  }

  /*
   * 현재 사용자 메시지를 기준으로 이전 대화 이력과 현재 질문을 분리하고,
   * Runtime에서 확정된 Prompt Version의 Template을 사용해
   * 최종 Provider 메시지를 생성합니다.
   */
  const messages = resolveNoteChatExecutionMessages({
    messages: detail.messages,
    systemTemplate: params.settings.chat.prompt.version.system_template,
    userMessageId: params.userMessageId,
    userTemplate: params.settings.chat.prompt.version.user_template,
  });

  return {
    conversation: detail.conversation,
    messages,
    referencedNoteIds: [],
    settings: params.settings,
    sources: [],
    userMessageId: params.userMessageId,
  };
}
