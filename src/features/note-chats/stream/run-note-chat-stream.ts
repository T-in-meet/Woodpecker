import {
  checkpointAiRun,
  completeAiRunFailed,
  completeAiRunSucceeded,
} from "@/features/ai/runs/persistence";
import type { AiRunPersistenceHandle } from "@/features/ai/runs/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import type {
  NoteChatOperationalErrorCodeType,
  NoteChatOperationalErrorOperationType,
} from "@/features/operational-errors/constants/note-chat";

import type { NoteChatSnapshotAccumulator } from "../ai-runs/snapshot-accumulator";
import { executeNoteChat } from "../execution/execute";
import {
  completeNoteChatExecutionClaim,
  completeNoteChatExecutionSuccess,
  NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS,
} from "../execution/execution-claim-persistence";
import { parseNoteChatProviderResponse } from "../execution/parse-response";
import type { NoteChatExecutionSettings } from "../execution/prepare-execution";
import { resolveNoteChatUsedNoteIds } from "../execution/resolve-used-note-ids";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";
import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "./constants";
import { consumeNoteChatProviderStream } from "./consume-provider-stream";
import type { NoteChatStreamEvent } from "./types";

/** 노트 챗봇 스트림 실행 입력입니다. */
export type RunNoteChatStreamParams = {
  /** 현재 AI execution의 공통 Run persistence 정보입니다. */
  aiRun: AiRunPersistenceHandle;
  /** 실행 제어를 담당하는 Claim ID입니다. */
  claimId: string;
  /** 실행할 대화 ID입니다. */
  conversationId: string;
  /** 실행별 Note Chat Snapshot accumulator입니다. */
  snapshotAccumulator: NoteChatSnapshotAccumulator;
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
  /** 클라이언트에 전달하고 저장하는 최종 답변입니다. */
  content: string;
  /** 실제 답변 생성에 사용한 Note ID 목록입니다. */
  usedNoteIds: string[];
};

/** Note Chat AI 실행과 도메인 성공 저장을 수행합니다. */
export async function runNoteChatStream(
  params: RunNoteChatStreamParams,
  onEvent: (event: NoteChatStreamEvent) => void | Promise<void>,
): Promise<RunNoteChatStreamResult> {
  let content: string;
  let usedNoteIds: string[];

  try {
    // Query Expansion과 Retrieval은 완료 지점마다 전체 Snapshot을 checkpoint한다.
    const execution = await executeNoteChat({
      conversationId: params.conversationId,
      onQueryExpansionCompleted: () => checkpointRun(params),
      onRetrievalCompleted: () => checkpointRun(params),
      settings: params.settings,
      snapshotAccumulator: params.snapshotAccumulator,
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    if (execution.sources.length === 0) {
      content = NOTE_CHAT_NO_CONTEXT_MESSAGE;
      usedNoteIds = [];
      params.snapshotAccumulator.completeNoContextAnswer(content);
      await onEvent({ delta: content, type: "text-delta" });
    } else {
      if (execution.providerStream === null) {
        throw new Error("Note chat Provider stream was not created.");
      }

      let consumed;

      try {
        consumed = await consumeNoteChatProviderStream(
          execution.providerStream,
          onEvent,
          (partial) => {
            params.snapshotAccumulator.appendAnswerPartialResponse(partial);
          },
        );
        params.snapshotAccumulator.completeAnswerGenerationProvider(
          consumed.result,
        );
      } catch (error) {
        params.snapshotAccumulator.failAnswerGeneration(
          "stream_consumption",
          error,
        );
        await reportExecutionError(params, error, {
          code: NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_STREAM_CONSUME_FAILED,
          message: "노트 챗봇 Provider 스트림 처리에 실패했습니다.",
          operation:
            NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CONSUME_PROVIDER_STREAM,
        });
        throw error;
      }

      let parsedResponse;

      try {
        parsedResponse = parseNoteChatProviderResponse(consumed.content);
        params.snapshotAccumulator.completeAnswerGenerationParsing(
          parsedResponse,
        );
      } catch (error) {
        const stage =
          error instanceof Error && error.message.includes("invalid structure")
            ? "validation"
            : "parse";
        params.snapshotAccumulator.failAnswerGeneration(stage, error);
        await reportExecutionError(params, error, {
          code: NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_RESPONSE_PARSE_FAILED,
          message: "노트 챗봇 Provider 응답 파싱에 실패했습니다.",
          operation:
            NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.PARSE_PROVIDER_RESPONSE,
        });
        throw error;
      }

      try {
        usedNoteIds = resolveNoteChatUsedNoteIds(
          parsedResponse.usedContextIndexes,
          execution.sources,
        );
        params.snapshotAccumulator.completeAnswerGenerationPostProcessing({
          usedContextIndexes: parsedResponse.usedContextIndexes,
          usedNoteIds,
        });
      } catch (error) {
        params.snapshotAccumulator.failAnswerGeneration(
          "post_processing",
          error,
        );
        await reportExecutionError(params, error, {
          code: NOTE_CHAT_OPERATIONAL_ERROR_CODES.USED_NOTES_RESOLVE_FAILED,
          message: "노트 챗봇 사용 노트 확인에 실패했습니다.",
          operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_USED_NOTES,
        });
        throw error;
      }

      content = parsedResponse.answer;
      params.snapshotAccumulator.completeGeneratedAnswer(content, usedNoteIds);
    }
  } catch (error) {
    // AI 처리 실패만 failed terminal로 기록하고 기존 Claim 실패 정리를 유지한다.
    await completeAiRunFailed({
      aiRun: params.aiRun,
      buildSnapshot: params.snapshotAccumulator.buildSnapshot,
      completedAt: new Date().toISOString(),
    });
    await completeExecutionClaimAfterFailure(params);
    throw error;
  }

  let assistantMessageId: string;

  try {
    // Assistant Message와 Claim succeeded는 기존 단일 transaction으로 확정한다.
    assistantMessageId = await completeNoteChatExecutionSuccess({
      claimId: params.claimId,
      content,
      usedNoteIds,
      userId: params.userId,
      userMessageId: params.userMessageId,
    });
  } catch (error) {
    await reportExecutionError(params, error, {
      code: NOTE_CHAT_OPERATIONAL_ERROR_CODES.ASSISTANT_MESSAGE_CREATE_FAILED,
      message: "노트 챗봇 실행 성공 확정에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_ASSISTANT_MESSAGE,
    });

    // AI 자체는 성공했으므로 결과 ID 없이 succeeded terminal을 남긴다.
    await completeSucceededRun(params, []);
    await completeExecutionClaimAfterFailure(params);
    throw error;
  }

  await completeSucceededRun(params, [assistantMessageId]);

  return { assistantMessageId, content, usedNoteIds };
}

/** 현재 전체 Snapshot을 공통 AI Run checkpoint로 저장합니다. */
async function checkpointRun(params: RunNoteChatStreamParams): Promise<void> {
  await checkpointAiRun({
    aiRun: params.aiRun,
    buildSnapshot: params.snapshotAccumulator.buildSnapshot,
  });
}

/** 성공한 AI 처리 결과를 best-effort terminal로 저장합니다. */
async function completeSucceededRun(
  params: RunNoteChatStreamParams,
  featureResultIds: string[],
): Promise<void> {
  await completeAiRunSucceeded({
    aiRun: params.aiRun,
    buildSnapshot: params.snapshotAccumulator.buildSnapshot,
    completedAt: new Date().toISOString(),
    featureResultIds,
  });
}

/** 실패한 execution claim을 기존 정책대로 best-effort 정리합니다. */
async function completeExecutionClaimAfterFailure(
  params: RunNoteChatStreamParams,
): Promise<void> {
  try {
    await completeNoteChatExecutionClaim({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });
  } catch (error) {
    await reportExecutionError(params, error, {
      code: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_CLAIM_COMPLETE_FAILED,
      message: "노트 챗봇 실행 선점 완료 처리에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_EXECUTION_CLAIM,
    });
  }
}

/** Note Chat 실행 오류를 원문 입력 없이 기존 운영 오류 경계에 보고합니다. */
async function reportExecutionError(
  params: RunNoteChatStreamParams,
  error: unknown,
  detail: {
    code: NoteChatOperationalErrorCodeType;
    message: string;
    operation: NoteChatOperationalErrorOperationType;
  },
): Promise<void> {
  await reportNoteChatOperationalError({
    actorUserId: params.userId,
    context: {
      aiRunId: params.aiRun.id,
      conversationId: params.conversationId,
      userMessageId: params.userMessageId,
    },
    error,
    errorCode: detail.code,
    message: detail.message,
    operation: detail.operation,
    stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
    userId: params.userId,
  });
}
