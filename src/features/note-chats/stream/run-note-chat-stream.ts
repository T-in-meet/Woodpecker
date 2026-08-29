import type { AiTokenUsage } from "@/features/ai/providers/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import { executeNoteChat } from "../execution/execute";
import {
  completeNoteChatExecutionClaim,
  completeNoteChatExecutionSuccess,
  NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS,
  type NoteChatExecutionClaimCompletionStatus,
} from "../execution/execution-claim-persistence";
import { parseNoteChatProviderResponse } from "../execution/parse-response";
import type { NoteChatExecutionSettings } from "../execution/prepare-execution";
import { resolveNoteChatUsedNoteIds } from "../execution/resolve-used-note-ids";
import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  NOTE_CHAT_RUN_UPDATE_STEP,
  type NoteChatRunUpdateStep,
  saveNoteChatExpandedQuery,
  saveNoteChatRunAnswerGeneration,
  saveNoteChatRunQueryEmbedding,
  saveNoteChatRunQueryExpansion,
  saveNoteChatRunSources,
} from "../execution/run-persistence";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";
import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "./constants";
import { consumeNoteChatProviderStream } from "./consume-provider-stream";
import type { NoteChatStreamEvent } from "./types";

/** 노트 챗봇 스트림 실행 입력입니다. */
export type RunNoteChatStreamParams = {
  /** 실행 제어를 담당하는 Claim ID입니다. */
  claimId: string;

  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** 감사 기록용 Run ID입니다. Run 생성 실패 시 null입니다. */
  runId: string | null;

  /** Route에서 확정된 AI Runtime 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 AI 실행을 요청한 사용자 ID입니다. */
  userId: string;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/** 노트 챗봇 스트림 실행 결과입니다. */
export type RunNoteChatStreamResult = {
  /** 성공 완료 RPC가 생성한 Assistant Message ID입니다. */
  assistantMessageId: string;

  /** 클라이언트에 전달하고 Assistant Message로 저장되는 최종 답변 내용입니다. */
  content: string;

  /** 완료된 Run ID입니다. Run 생성 실패 시 null입니다. */
  runId: string | null;

  /** 현재 답변 생성 과정에서 참고한 노트 ID 목록입니다. */
  usedNoteIds: string[];
};

/**
 * 노트 챗봇 실행을 시작하고 Provider 스트림을 소비하여 결과를 저장합니다.
 *
 * execution claim은 conversation 단위 in-flight와 quota를 담당합니다.
 * Run은 실행 감사 기록이므로 중간 저장 실패를 operational error로 보고하되
 * Provider 실행이나 기능적 성공 처리를 중단하지 않습니다.
 *
 * 성공 시에는 Assistant Message 저장과 Claim succeeded 전환을
 * 하나의 DB transaction으로 확정한 뒤 Run 성공 기록을 best-effort로 남깁니다.
 *
 * @param params 실행할 claim, Run, 대화 및 확정된 Runtime 설정
 * @param onEvent 클라이언트에 전달할 스트림 이벤트 처리 함수
 * @returns 저장까지 완료된 노트 챗봇 실행 결과
 */
export async function runNoteChatStream(
  params: RunNoteChatStreamParams,
  onEvent: (event: NoteChatStreamEvent) => void | Promise<void>,
): Promise<RunNoteChatStreamResult> {
  await onEvent({
    runId: params.runId,
    type: "start",
    userMessageId: params.userMessageId,
  });

  try {
    const execution = await executeNoteChat({
      conversationId: params.conversationId,

      /*
       * Provider 호출 직후 usage를 저장합니다. 이 콜백 자체가 실패해도
       * executeNoteChat이 실패하지 않도록 내부에서 오류를 흡수합니다.
       */
      onQueryEmbeddingUsage: async (usage) => {
        await saveRunUpdateOrReport({
          params,
          step: NOTE_CHAT_RUN_UPDATE_STEP.QUERY_EMBEDDING,
          update: (runId) =>
            saveNoteChatRunQueryEmbedding({
              modelKey: createAiUsageModelKey(params.settings.embedding.model),
              runId,
              usage,
            }),
        });
      },
      onQueryExpansionUsage: async (usage) => {
        await saveRunUpdateOrReport({
          params,
          step: NOTE_CHAT_RUN_UPDATE_STEP.QUERY_EXPANSION,
          update: (runId) =>
            saveNoteChatRunQueryExpansion({
              modelKey: createAiUsageModelKey(
                params.settings.queryExpansion.model,
              ),
              runId,
              usage,
            }),
        });
      },
      settings: params.settings,
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    await saveRunUpdateOrReport({
      params,
      step: NOTE_CHAT_RUN_UPDATE_STEP.EXPANDED_QUERY,
      update: (runId) =>
        saveNoteChatExpandedQuery({
          expandedQuery: execution.expandedQuery,
          runId,
        }),
    });

    await saveRunUpdateOrReport({
      params,
      step: NOTE_CHAT_RUN_UPDATE_STEP.SOURCES,
      update: (runId) =>
        saveNoteChatRunSources({
          runId,
          sources: execution.sources,
        }),
    });

    /*
     * 검색 Context가 없는 경우 Answer Provider는 호출하지 않습니다.
     * 고정 응답도 사용자에게 전달되는 정상적인 성공 결과이므로
     * 일반 답변과 동일하게 Assistant Message + Claim 성공을 원자적으로 확정합니다.
     */
    if (execution.sources.length === 0) {
      const content = NOTE_CHAT_NO_CONTEXT_MESSAGE;
      const usedNoteIds: string[] = [];

      await onEvent({
        delta: content,
        type: "text-delta",
      });

      const assistantMessageId = await completeExecutionSuccessOrThrow({
        content,
        params,
        usedNoteIds,
      });

      await completeRunSuccessOrReport({
        assistantMessageId,
        params,
        sources: execution.sources,
      });

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

    await saveRunUpdateOrReport({
      params,
      step: NOTE_CHAT_RUN_UPDATE_STEP.ANSWER_GENERATION,
      update: (runId) =>
        saveNoteChatRunAnswerGeneration({
          modelKey: createAiUsageModelKey(params.settings.chat.model),
          runId,
          usage: consumed.result.usage,
        }),
    });

    let parsedResponse;

    try {
      parsedResponse = parseNoteChatProviderResponse(consumed.content);
    } catch (error) {
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
        execution.sources,
      );
    } catch (error) {
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

    /*
     * Provider 응답 검증까지 끝난 뒤 기능적 성공을 확정합니다.
     *
     * Assistant Message 저장과 Claim succeeded 전환은 하나의 RPC transaction에서
     * 처리되므로 둘 중 하나만 반영되는 상태가 발생하지 않습니다.
     */
    const assistantMessageId = await completeExecutionSuccessOrThrow({
      content: parsedResponse.answer,
      params,
      usedNoteIds,
    });

    /*
     * 기능적 성공은 위에서 이미 확정되었습니다.
     * Run은 감사 기록이므로 성공 기록 실패는 보고만 하고 사용자 응답은 유지합니다.
     */
    await completeRunSuccessOrReport({
      assistantMessageId,
      params,
      sources: execution.sources,
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
      usedNoteIds,
    };
  } catch (error) {
    /*
     * 기능 실행이 실패한 경우 Run과 Claim을 각각 정리합니다.
     *
     * 둘 다 cleanup 성격이므로 정리 자체의 실패가 원래 실행 오류를 덮어쓰지 않도록
     * best-effort로 처리합니다.
     */
    await completeRunFailureOrReport({
      error,
      params,
    });

    await completeExecutionClaimOrReport({
      params,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });

    await onEvent({
      message: "답변 생성에 실패했습니다.",
      runId: params.runId,
      type: "error",
    });

    throw error;
  }
}

/**
 * AI Model Config를 usage pricing table에서 사용하는 model key로 변환합니다.
 *
 * @param model Runtime에서 확정된 AI Model Config
 * @returns 비용 추정에 사용할 model key
 */
function createAiUsageModelKey(model: { provider: string; model: string }) {
  return `${model.provider}-${model.model}`;
}

/**
 * Note Chat Run 갱신을 시도하고 실패 시 운영 오류를 기록합니다.
 *
 * Run은 기능 제어가 아닌 감사 계층이므로, Run이 없거나 갱신에 실패해도
 * Provider 실행과 기능 처리는 계속 진행합니다.
 *
 * @param input Run 갱신 작업과 오류 보고 context
 */
async function saveRunUpdateOrReport(input: {
  params: RunNoteChatStreamParams;
  step: NoteChatRunUpdateStep;
  update: (runId: string) => Promise<void>;
}): Promise<void> {
  if (input.params.runId === null) {
    return;
  }

  try {
    await input.update(input.params.runId);
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: input.params.userId,
      context: {
        conversationId: input.params.conversationId,
        runId: input.params.runId,
        runUpdateStep: input.step,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_UPDATE_FAILED,
      message: "노트 챗봇 Run 실행 이력 갱신에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.UPDATE_RUN,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: input.params.userId,
    });
  }
}

/**
 * Note Chat 기능적 성공을 확정합니다.
 *
 * Assistant Message 저장과 Claim의 running -> succeeded 전환을
 * 하나의 DB transaction에서 수행합니다.
 *
 * 이 처리가 실패하면 transaction 전체가 rollback되므로 실제 실행 실패로
 * 상위 계층에 전파하고 outer catch에서 실패 cleanup을 수행합니다.
 *
 * @param input 최종 답변과 실행 context
 * @returns 생성된 Assistant Message ID
 */
async function completeExecutionSuccessOrThrow(input: {
  content: string;
  params: RunNoteChatStreamParams;
  usedNoteIds: string[];
}): Promise<string> {
  try {
    return await completeNoteChatExecutionSuccess({
      claimId: input.params.claimId,
      content: input.content,
      usedNoteIds: input.usedNoteIds,
      userId: input.params.userId,
      userMessageId: input.params.userMessageId,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: input.params.userId,
      context: {
        claimId: input.params.claimId,
        conversationId: input.params.conversationId,
        runId: input.params.runId,
        userMessageId: input.params.userMessageId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.ASSISTANT_MESSAGE_CREATE_FAILED,
      message: "노트 챗봇 실행 성공 확정에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_ASSISTANT_MESSAGE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: input.params.userId,
    });

    throw error;
  }
}

/**
 * Run 성공 완료를 시도하고 실패 시 운영 오류만 기록합니다.
 *
 * 기능적 성공은 이미 Assistant Message + Claim transaction에서 확정된 상태이므로
 * Run 성공 기록 실패는 사용자 기능 결과에 영향을 주지 않습니다.
 *
 * @param input 성공 완료 정보와 실행 context
 */
async function completeRunSuccessOrReport(input: {
  assistantMessageId: string;
  params: RunNoteChatStreamParams;
  sources: Parameters<typeof completeNoteChatRunSuccess>[0]["sources"];
}): Promise<void> {
  if (input.params.runId === null) {
    return;
  }

  try {
    await completeNoteChatRunSuccess({
      assistantMessageId: input.assistantMessageId,
      runId: input.params.runId,
      sources: input.sources,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: input.params.userId,
      context: {
        assistantMessageId: input.assistantMessageId,
        conversationId: input.params.conversationId,
        runId: input.params.runId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_SUCCESS_COMPLETE_FAILED,
      message: "노트 챗봇 Run 성공 완료 기록에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RUN_SUCCESS,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: input.params.userId,
    });
  }
}

/**
 * Run 실패 완료를 시도하고 실패 시 운영 오류만 기록합니다.
 *
 * @param input 실패 완료 정보와 실행 context
 */
async function completeRunFailureOrReport(input: {
  error: unknown;
  params: RunNoteChatStreamParams;
}): Promise<void> {
  if (input.params.runId === null) {
    return;
  }

  try {
    await completeNoteChatRunFailure({
      failureMessage:
        input.error instanceof Error ? input.error.message : "Unknown error",
      runId: input.params.runId,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: input.params.userId,
      context: {
        conversationId: input.params.conversationId,
        runId: input.params.runId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_FAILURE_COMPLETE_FAILED,
      message: "노트 챗봇 Run 실패 완료 기록에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RUN_FAILURE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: input.params.userId,
    });
  }
}

/**
 * 실패하거나 만료된 execution claim 종료를 시도하고,
 * 실패 시 운영 오류만 기록합니다.
 *
 * 성공 Claim은 completeNoteChatExecutionSuccess에서 Assistant Message와 함께
 * 원자적으로 완료하므로 이 helper에서 처리하지 않습니다.
 *
 * cleanup 실패가 원래 기능 실행 오류를 덮어쓰지 않도록 best-effort로 처리합니다.
 *
 * @param input claim 완료 정보와 실행 context
 */
async function completeExecutionClaimOrReport(input: {
  params: RunNoteChatStreamParams;
  status: NoteChatExecutionClaimCompletionStatus;
}): Promise<void> {
  try {
    await completeNoteChatExecutionClaim({
      claimId: input.params.claimId,
      status: input.status,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: input.params.userId,
      context: {
        claimId: input.params.claimId,
        claimStatus: input.status,
        conversationId: input.params.conversationId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_CLAIM_COMPLETE_FAILED,
      message: "노트 챗봇 실행 선점 완료 처리에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_EXECUTION_CLAIM,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: input.params.userId,
    });
  }
}

/**
 * 사용량 누적에 필요한 빈 token usage를 생성합니다.
 *
 * @returns 모든 token 값이 0인 usage
 */
export function createEmptyNoteChatTokenUsage(): AiTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}
