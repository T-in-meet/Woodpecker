import type { AiTokenUsage } from "@/features/ai/providers/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import { executeNoteChat } from "../execution/execute";
import { parseNoteChatProviderResponse } from "../execution/parse-response";
import type { NoteChatExecutionSettings } from "../execution/prepare-execution";
import { resolveNoteChatUsedNoteIds } from "../execution/resolve-used-note-ids";
import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  markNoteChatRunRunning,
  saveNoteChatExpandedQuery,
} from "../execution/run-persistence";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";
import {
  NOTE_CHAT_NO_CONTEXT_MESSAGE,
  NOTE_CHAT_NO_CONTEXT_USAGE,
} from "./constants";
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

  /** 현재 AI 실행을 요청한 사용자 ID입니다. */
  userId: string;

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
 * 2. 문맥 기반 질의 확장과 노트 검색을 포함한 실행 정보를 준비합니다.
 * 3. 문맥 기반 확장 질의를 Run Snapshot으로 저장합니다.
 * 4. Provider 스트림을 소비하고 텍스트 조각을 스트림 이벤트로 전달합니다.
 * 5. Provider 스트림이 완료되면 Assistant Message와 Run 성공 결과를 저장합니다.
 * 6. 실행 중 오류가 발생하면 Run을 실패 상태로 완료합니다.
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
   *
   * 이 단계가 실패하면 아직 running 상태가 아니므로
   * 이후 실패 완료 RPC를 시도하지 않고 원래 오류를 그대로 전달합니다.
   */
  try {
    await markNoteChatRunRunning(params.runId);
  } catch (error) {
    /*
     * 실행을 시작하지 못한 Run을 식별할 수 있도록 Run과 대화 ID만 기록합니다.
     * 사용자 질문 본문은 운영 오류 Context에 저장하지 않습니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: params.userId,
      context: {
        conversationId: params.conversationId,
        runId: params.runId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_RUNNING_UPDATE_FAILED,
      message: "노트 챗봇 Run 실행 시작 처리에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.MARK_RUN_RUNNING,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: params.userId,
    });

    throw error;
  }

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

    /*
     * 실행 준비 과정에서 생성된 문맥 기반 확장 질의를 Run에 Snapshot으로 저장합니다.
     *
     * 이후 Provider 응답 처리와 무관하게 이번 Run에서 실제 노트 검색에 사용한
     * 질의를 관리자 실행 기록에서 확인할 수 있도록 보존합니다.
     */
    try {
      await saveNoteChatExpandedQuery({
        expandedQuery: execution.expandedQuery,
        runId: params.runId,
      });
    } catch (error) {
      /*
       * 확장 질의 원문은 별도로 Run에 저장하려던 사용자 관련 데이터이므로
       * 운영 오류 Context에는 중복 저장하지 않고 식별자만 기록합니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXPANDED_QUERY_SAVE_FAILED,
        message: "노트 챗봇 확장 질의 저장에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.SAVE_EXPANDED_QUERY,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
        userId: params.userId,
      });

      throw error;
    }

    const { sources } = execution;

    /*
     * 검색된 Note Context가 없으면 Answer Provider를 호출하지 않습니다.
     *
     * Context 없이 일반 지식으로 답변하는 것을 방지하고 불필요한 Provider
     * 호출 비용을 줄이면서, 클라이언트에는 기존과 동일한 text-delta /
     * finish 이벤트 계약으로 고정 안내 답변을 전달합니다.
     */
    if (sources.length === 0) {
      const content = NOTE_CHAT_NO_CONTEXT_MESSAGE;
      const usedNoteIds: string[] = [];
      const noContextUsage = NOTE_CHAT_NO_CONTEXT_USAGE;

      await onEvent({
        delta: content,
        type: "text-delta",
      });

      let assistantMessageId: string;

      try {
        assistantMessageId = await completeNoteChatRunSuccess({
          content,
          runId: params.runId,
          sources,
          usage: noContextUsage,
          usedNoteIds,
        });
      } catch (error) {
        await reportNoteChatOperationalError({
          actorUserId: params.userId,
          context: {
            conversationId: params.conversationId,
            runId: params.runId,
          },
          error,
          errorCode:
            NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_SUCCESS_COMPLETE_FAILED,
          message: "노트 챗봇 Run 성공 완료 처리에 실패했습니다.",
          operation:
            NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RUN_SUCCESS,
          stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
          userId: params.userId,
        });

        throw error;
      }

      await onEvent({
        assistantMessageId,
        runId: params.runId,
        type: "finish",
        usedNoteIds,
      });

      return {
        assistantMessageId,
        content,
        runId: params.runId,
        usage: noContextUsage,
        usedNoteIds,
      };
    }

    let consumed;

    try {
      consumed = await consumeNoteChatProviderStream(
        execution.providerStream,
        async (event) => {
          await onEvent(event);
        },
      );
    } catch (error) {
      /*
       * Provider 스트림 소비 과정에서 finish 이벤트 누락이나
       * 누적 content 불일치가 발생하면 Note Chat 실행 계약 위반으로 보고합니다.
       *
       * Provider 원본 응답이나 생성 중인 답변은 운영 오류 Context에 저장하지 않습니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_STREAM_CONSUME_FAILED,
        message: "노트 챗봇 Provider 스트림 처리에 실패했습니다.",
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CONSUME_PROVIDER_STREAM,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
        userId: params.userId,
      });

      throw error;
    }

    usage = consumed.result.usage;

    let parsedResponse;

    try {
      parsedResponse = parseNoteChatProviderResponse(consumed.content);
    } catch (error) {
      /*
       * Provider 호출 자체는 완료됐지만 최종 응답이 Note Chat Prompt 계약의
       * JSON 구조를 만족하지 못한 경우 실행 응답 검증 실패로 보고합니다.
       *
       * Provider 응답 원문은 운영 오류 Context에 저장하지 않습니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_RESPONSE_PARSE_FAILED,
        message: "노트 챗봇 Provider 응답 파싱에 실패했습니다.",
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.PARSE_PROVIDER_RESPONSE,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
        userId: params.userId,
      });

      throw error;
    }

    let usedNoteIds: string[];

    try {
      usedNoteIds = resolveNoteChatUsedNoteIds(
        parsedResponse.usedContextIndexes,
        sources,
      );
    } catch (error) {
      /*
       * Provider가 실제 Context에 존재하지 않는 index를 반환했거나
       * Source Snapshot 구조가 예상한 형식과 다르면 실행 결과를 신뢰할 수 없습니다.
       *
       * Source 원문은 운영 오류에 복제하지 않고 실행 식별자만 기록합니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.USED_NOTES_RESOLVE_FAILED,
        message: "노트 챗봇 사용 노트 확인에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_USED_NOTES,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
        userId: params.userId,
      });

      throw error;
    }

    let assistantMessageId: string;

    try {
      assistantMessageId = await completeNoteChatRunSuccess({
        content: parsedResponse.answer,
        runId: params.runId,
        sources,
        usage,
        usedNoteIds,
      });
    } catch (error) {
      /*
       * Provider 응답은 이미 완료된 상태이므로 생성된 답변이나 Sources를
       * 운영 오류에 복제하지 않고 실패한 Run 식별 정보만 기록합니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_SUCCESS_COMPLETE_FAILED,
        message: "노트 챗봇 Run 성공 완료 처리에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RUN_SUCCESS,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
        userId: params.userId,
      });

      throw error;
    }

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
    } catch (failureCompletionError) {
      /*
       * 실패 상태 저장 오류는 원래 실행 오류와 별개의 운영 장애이므로
       * 별도로 보고하되, 이후에는 최초 실행 오류를 그대로 유지합니다.
       */
      await reportNoteChatOperationalError({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error: failureCompletionError,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_FAILURE_COMPLETE_FAILED,
        message: "노트 챗봇 Run 실패 완료 처리에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RUN_FAILURE,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
        userId: params.userId,
      });
    }

    await onEvent({
      message: "답변 생성에 실패했습니다.",
      runId: params.runId,
      type: "error",
    });

    throw error;
  }
}
