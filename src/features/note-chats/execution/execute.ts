import type { AiChatStreamEvent } from "@/features/ai/providers/types";

import type { NoteChatRunSettings } from "../schema";
import {
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

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;

  /** 실행 전에 확정된 AI 설정 ID입니다. */
  settings: NoteChatRunSettings;
};

/**
 * 노트 챗봇 실행 시작 결과입니다.
 *
 * 준비된 실행 정보와 Provider 스트림을 함께 반환합니다.
 * 이후 Route 또는 Stream 계층에서 Provider 이벤트를 소비하고
 * Assistant Message 및 Run 결과를 저장합니다.
 */
export type NoteChatExecution = {
  /** Provider 호출 직전에 확정된 실행 정보입니다. */
  prepared: PreparedNoteChatExecution;

  /** Provider가 반환하는 공통 Chat 스트림입니다. */
  providerStream: AsyncGenerator<AiChatStreamEvent>;
};

/**
 * 노트 챗봇 실행에 필요한 데이터를 준비하고 Provider 스트림을 시작합니다.
 *
 * 이 함수는 다음 작업만 담당합니다.
 *
 * 1. Prompt와 Model Config를 조회·검증합니다.
 * 2. 대화 이력과 현재 질문으로 Provider 메시지를 구성합니다.
 * 3. 선택한 Chat Model의 Provider 스트림을 생성합니다.
 *
 * 이 함수는 Provider 스트림을 직접 소비하지 않으며,
 * Assistant Message 저장이나 Run 성공·실패 처리도 수행하지 않습니다.
 *
 * @param params 실행할 대화, 사용자 메시지 및 AI 설정
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
   * 텍스트 조각을 클라이언트에 전달하게 됩니다.
   */
  const providerStream = startNoteChatProviderStream(prepared);

  return {
    prepared,
    providerStream,
  };
}
