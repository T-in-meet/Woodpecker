import type { AiChatStreamEvent } from "@/features/ai/providers/types";
import type { Json } from "@/types/db.helpers";

import {
  type NoteChatExecutionSettings,
  type PreparedNoteChatExecution,
  prepareNoteChatExecution,
} from "./prepare-execution";
import { startNoteChatProviderStream } from "./start-provider-stream";

/**
 * 노트 챗봇 실행 시작에 필요한 입력입니다.
 */
export type ExecuteNoteChatParams = {
  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** Route에서 확정된 AI Runtime 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/**
 * 노트 챗봇 실행 시작 결과입니다.
 */
export type NoteChatExecution = {
  /** Provider 호출 직전에 확정된 실행 정보입니다. */
  prepared: PreparedNoteChatExecution;

  /** Provider가 반환하는 공통 Chat 스트림입니다. */
  providerStream: AsyncGenerator<AiChatStreamEvent>;

  /** 답변 생성 과정에서 참고한 노트 ID 목록입니다. */
  referencedNoteIds: string[];

  /** 실행 과정에서 생성된 Context 출처 Snapshot입니다. */
  sources: Json[];
};

/**
 * 노트 챗봇 실행에 필요한 데이터를 준비하고 Provider 스트림을 시작합니다.
 *
 * 이 함수는 다음 작업만 담당합니다.
 *
 * 1. 확정된 Runtime 설정과 대화 이력으로 Provider 메시지를 준비합니다.
 * 2. Runtime에서 확정된 Chat Model로 Provider 스트림을 생성합니다.
 * 3. 답변 생성에 필요한 Context 정보를 반환합니다.
 *
 * 이 함수는 Provider 스트림을 직접 소비하지 않으며,
 * Assistant Message 저장이나 Run 성공·실패 처리도 수행하지 않습니다.
 *
 * @param params 실행할 대화, 사용자 메시지 및 Runtime 설정
 * @returns 준비된 실행 정보와 Provider 스트림
 */
export async function executeNoteChat(
  params: ExecuteNoteChatParams,
): Promise<NoteChatExecution> {
  const prepared = await prepareNoteChatExecution({
    conversationId: params.conversationId,
    settings: params.settings,
    userMessageId: params.userMessageId,
  });

  /*
   * Provider 스트림은 아직 소비하지 않습니다.
   * Route 또는 상위 Stream 계층이 AsyncGenerator를 순회하면서
   * 텍스트 조각을 클라이언트에 전달합니다.
   */
  const providerStream = startNoteChatProviderStream(prepared);

  return {
    prepared,
    providerStream,
    referencedNoteIds: prepared.referencedNoteIds,
    sources: prepared.sources,
  };
}
