import type { AiTokenUsage } from "@/features/ai/providers/types";

import { executeNoteChat } from "../execution/execute";
import { parseNoteChatProviderResponse } from "../execution/parse-response";
import type { NoteChatExecutionSettings } from "../execution/prepare-execution";
import { resolveNoteChatUsedNoteIds } from "../execution/resolve-used-note-ids";
import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  markNoteChatRunRunning,
} from "../execution/run-persistence";
import { consumeNoteChatProviderStream } from "./consume-provider-stream";
import type { NoteChatStreamEvent } from "./types";

/**
 * 노트 챗봇 스트림 실행 입력입니다.
 */
export type RunNoteChatStreamParams = {
  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** 질문 생성 또는 수정 RPC가 반환한 Run ID입니다. */
  runId: string;

  /** Route에서 확정된 AI Runtime 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/**
 * 노트 챗봇 스트림 실행 결과입니다.
 */
export type RunNoteChatStreamResult = {
  /** 성공 완료 RPC가 생성한 Assistant Message ID입니다. */
  assistantMessageId: string;

  /** Provider가 생성한 최종 답변입니다. */
  content: string;

  /** 현재 답변 생성 과정에서 참고한 노트 ID 목록입니다. */
  usedNoteIds: string[];

  /** 완료된 Run ID입니다. */
  runId: string;

  /** Provider Token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * 노트 챗봇 실행을 시작하고 Provider 스트림을 소비하여 결과를 저장합니다.
 *
 * 처리 순서는 다음과 같습니다.
 *
 * 1. Pending Run을 Running 상태로 변경합니다.
 * 2. 확정된 Runtime 설정과 대화 이력으로 Provider 스트림을 생성합니다.
 * 3. 텍스트 조각을 노트 챗봇 스트림 이벤트로 전달합니다.
 * 4. Provider 스트림이 완료되면 Assistant Message와 Run 성공 결과를 저장합니다.
 * 5. 실행 중 오류가 발생하면 Run을 실패 상태로 완료합니다.
 *
 * Context 검색 결과는 executeNoteChat 실행 결과에서 전달받아
 * Assistant Message와 Run 결과 저장에 사용합니다.
 *
 * @param params 실행할 Run, 대화 및 확정된 Runtime 설정
 * @param onEvent 클라이언트에 전달할 스트림 이벤트 처리 함수
 * @returns 저장까지 완료된 노트 챗봇 실행 결과
 */
export async function runNoteChatStream(
  params: RunNoteChatStreamParams,
  onEvent: (event: NoteChatStreamEvent) => void | Promise<void>,
): Promise<RunNoteChatStreamResult> {
  /*
   * 성공·실패 완료 RPC는 running 상태의 Run만 처리하므로,
   * Provider 실행 전에 먼저 상태를 변경합니다.
   */
  await markNoteChatRunRunning(params.runId);

  await onEvent({
    runId: params.runId,
    type: "start",
    userMessageId: params.userMessageId,
  });

  let usage: AiTokenUsage | null = null;

  try {
    const execution = await executeNoteChat({
      conversationId: params.conversationId,
      settings: params.settings,
      userMessageId: params.userMessageId,
    });

    const { sources } = execution;

    const consumed = await consumeNoteChatProviderStream(
      execution.providerStream,
      async (event) => {
        await onEvent(event);
      },
    );

    usage = consumed.result.usage;

    const parsedResponse = parseNoteChatProviderResponse(consumed.content);

    const usedNoteIds = resolveNoteChatUsedNoteIds(
      parsedResponse.usedContextIndexes,
      sources,
    );

    const assistantMessageId = await completeNoteChatRunSuccess({
      content: parsedResponse.answer,
      runId: params.runId,
      sources,
      usage,
      usedNoteIds,
    });

    await onEvent({
      assistantMessageId,
      runId: params.runId,
      type: "finish",
      usedNoteIds,
    });

    return {
      assistantMessageId,
      content: parsedResponse.answer,
      runId: params.runId,
      usage,
      usedNoteIds,
    };
  } catch (error) {
    /*
     * Provider 완료 결과를 받기 전 실패하면 usage는 null입니다.
     * 성공 완료 저장 자체가 실패한 경우에는 확인된 Provider usage를 보존합니다.
     */
    try {
      await completeNoteChatRunFailure({
        runId: params.runId,
        usage,
      });
    } catch {
      /*
       * 원래 실행 오류를 유지합니다.
       * 실패 상태 저장 오류는 이후 운영 오류 기록 계층에서 별도로 처리합니다.
       */
    }

    await onEvent({
      message: "답변 생성에 실패했습니다.",
      runId: params.runId,
      type: "error",
    });

    throw error;
  }
}
