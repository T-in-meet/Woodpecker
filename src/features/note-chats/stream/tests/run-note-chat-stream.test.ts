import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRunPersistenceHandle } from "@/features/ai/runs/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import type { NoteChatSnapshotAccumulator } from "../../ai-runs/snapshot-accumulator";
import { NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS } from "../../execution/execution-claim-persistence";
import { NoteChatProviderResponseError } from "../../execution/parse-response";
import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "../constants";
import { runNoteChatStream } from "../run-note-chat-stream";

const mocks = vi.hoisted(() => ({
  checkpointAiRun: vi.fn(),
  completeAiRunFailed: vi.fn(),
  completeAiRunSucceeded: vi.fn(),
  completeNoteChatExecutionClaim: vi.fn(),
  completeNoteChatExecutionSuccess: vi.fn(),
  consumeNoteChatProviderStream: vi.fn(),
  executeNoteChat: vi.fn(),
  parseNoteChatProviderResponse: vi.fn(),
  reportNoteChatOperationalError: vi.fn(),
  resolveNoteChatUsedNoteIds: vi.fn(),
}));

vi.mock("@/features/ai/runs/persistence", () => ({
  checkpointAiRun: mocks.checkpointAiRun,
  completeAiRunFailed: mocks.completeAiRunFailed,
  completeAiRunSucceeded: mocks.completeAiRunSucceeded,
}));

vi.mock("../../execution/execution-claim-persistence", async () => {
  const actual = await vi.importActual<
    typeof import("../../execution/execution-claim-persistence")
  >("../../execution/execution-claim-persistence");

  return {
    ...actual,
    completeNoteChatExecutionClaim: mocks.completeNoteChatExecutionClaim,
    completeNoteChatExecutionSuccess: mocks.completeNoteChatExecutionSuccess,
  };
});

vi.mock("../../execution/execute", () => ({
  executeNoteChat: mocks.executeNoteChat,
}));

vi.mock("../../execution/parse-response", async () => {
  const actual = await vi.importActual<
    typeof import("../../execution/parse-response")
  >("../../execution/parse-response");

  return {
    ...actual,
    parseNoteChatProviderResponse: mocks.parseNoteChatProviderResponse,
  };
});

vi.mock("../../execution/resolve-used-note-ids", () => ({
  resolveNoteChatUsedNoteIds: mocks.resolveNoteChatUsedNoteIds,
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: mocks.reportNoteChatOperationalError,
}));

vi.mock("../consume-provider-stream", () => ({
  consumeNoteChatProviderStream: mocks.consumeNoteChatProviderStream,
}));

/** 테스트용 AI Run persistence handle입니다. */
const aiRun: AiRunPersistenceHandle = {
  id: "ai-run-1",
  userId: "user-1",
  featureType: "note-chat",
  startedAt: "2026-09-05T00:00:00.000Z",
};

/** 테스트용 Snapshot accumulator mock입니다. */
const snapshotAccumulator = {
  appendAnswerPartialResponse: vi.fn(),
  buildSnapshot: vi.fn(() => ({ schemaVersion: 1 })),
  completeAnswerGenerationParsing: vi.fn(),
  completeAnswerGenerationPostProcessing: vi.fn(),
  completeAnswerGenerationProvider: vi.fn(),
  completeGeneratedAnswer: vi.fn(),
  completeNoContextAnswer: vi.fn(),
  completeQueryExpansion: vi.fn(),
  completeRetrieval: vi.fn(),
  failAnswerGeneration: vi.fn(),
  failQueryExpansion: vi.fn(),
  failRetrieval: vi.fn(),
  observeQueryExpansion: vi.fn(),
  observeRetrieval: vi.fn(),
  prepareAnswerGeneration: vi.fn(),
  prepareQueryExpansion: vi.fn(),
  prepareRetrieval: vi.fn(),
} satisfies NoteChatSnapshotAccumulator;

/** 테스트용 실행 입력입니다. */
const params = {
  aiRun,
  claimId: "claim-1",
  conversationId: "conversation-1",
  settings: {} as Parameters<typeof runNoteChatStream>[0]["settings"],
  snapshotAccumulator,
  userId: "user-1",
  userMessageId: "message-1",
};

/** 테스트용 Provider stream입니다. */
const providerStream = (async function* () {
  yield { delta: "답변", type: "text-delta" as const };
})();

/** 테스트용 Context source입니다. */
const sources = [
  {
    contextIndex: 1,
    noteId: "11111111-1111-4111-8111-111111111111",
    title: "Note",
    type: "note",
  },
];

describe("runNoteChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeNoteChatExecutionSuccess.mockResolvedValue("assistant-1");
    mocks.completeNoteChatExecutionClaim.mockResolvedValue(undefined);
  });

  it("두 checkpoint 뒤 AI 성공과 Assistant Message ID를 succeeded terminal에 저장한다", async () => {
    mocks.executeNoteChat.mockImplementation(async (input) => {
      await input.onQueryExpansionCompleted?.();
      await input.onRetrievalCompleted?.();

      return {
        providerStream,
        sources,
      };
    });

    mocks.consumeNoteChatProviderStream.mockResolvedValue({
      content: '{"answer":"답변","usedContextIndexes":[1]}',
      result: {
        content: '{"answer":"답변","usedContextIndexes":[1]}',
        metadata: {},
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
        },
      },
    });

    mocks.parseNoteChatProviderResponse.mockReturnValue({
      answer: "답변",
      usedContextIndexes: [1],
    });

    mocks.resolveNoteChatUsedNoteIds.mockReturnValue([
      "11111111-1111-4111-8111-111111111111",
    ]);

    const result = await runNoteChatStream(params, vi.fn());

    expect(mocks.checkpointAiRun).toHaveBeenCalledTimes(2);

    expect(mocks.checkpointAiRun).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
      }),
    );

    expect(mocks.checkpointAiRun).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
      }),
    );

    expect(mocks.completeAiRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
        featureResultIds: ["assistant-1"],
      }),
    );

    expect(mocks.completeAiRunFailed).not.toHaveBeenCalled();

    expect(result).toEqual({
      assistantMessageId: "assistant-1",
      content: "답변",
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("Context가 없으면 Provider를 호출하지 않고 정상 성공 Snapshot을 저장한다", async () => {
    mocks.executeNoteChat.mockResolvedValue({
      providerStream: null,
      sources: [],
    });

    const onEvent = vi.fn();

    await runNoteChatStream(params, onEvent);

    expect(mocks.consumeNoteChatProviderStream).not.toHaveBeenCalled();

    expect(snapshotAccumulator.completeNoContextAnswer).toHaveBeenCalledWith(
      NOTE_CHAT_NO_CONTEXT_MESSAGE,
    );

    expect(mocks.completeAiRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
        featureResultIds: ["assistant-1"],
      }),
    );
  });

  it("stream 실패 시 partial 관측과 failed terminal을 남기고 EXECUTION stage로 보고한다", async () => {
    const streamError = new Error("stream failed");

    mocks.executeNoteChat.mockResolvedValue({
      providerStream,
      sources,
    });

    mocks.consumeNoteChatProviderStream.mockImplementation(
      async (_stream, _onEvent, onPartial) => {
        await onPartial?.({
          partialResponse: "부분",
          rawResponse: "raw",
        });

        throw streamError;
      },
    );

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
      streamError,
    );

    expect(
      snapshotAccumulator.appendAnswerPartialResponse,
    ).toHaveBeenCalledWith({
      partialResponse: "부분",
      rawResponse: "raw",
    });

    expect(snapshotAccumulator.failAnswerGeneration).toHaveBeenCalledWith(
      "stream_consumption",
      streamError,
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: streamError,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_STREAM_CONSUME_FAILED,
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CONSUME_PROVIDER_STREAM,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
      }),
    );

    expect(mocks.completeAiRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
      }),
    );
  });

  it("Provider 응답 구조 검증 실패를 validation stage로 기록한다", async () => {
    const validationError = new NoteChatProviderResponseError(
      "validation",
      "Provider response validation failed.",
    );

    mocks.executeNoteChat.mockResolvedValue({
      providerStream,
      sources,
    });

    mocks.consumeNoteChatProviderStream.mockResolvedValue({
      content: '{"answer":""}',
      result: {
        content: '{"answer":""}',
        metadata: {},
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
        },
      },
    });

    mocks.parseNoteChatProviderResponse.mockImplementation(() => {
      throw validationError;
    });

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
      validationError,
    );

    expect(snapshotAccumulator.failAnswerGeneration).toHaveBeenCalledWith(
      "validation",
      validationError,
    );

    expect(mocks.completeAiRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
      }),
    );
  });

  it("Assistant Message 저장 실패는 DATABASE stage로 보고하고 AI Run을 빈 결과의 succeeded로 유지한다", async () => {
    const persistenceError = new Error("message failed");

    mocks.executeNoteChat.mockResolvedValue({
      providerStream: null,
      sources: [],
    });

    mocks.completeNoteChatExecutionSuccess.mockRejectedValue(persistenceError);

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
      persistenceError,
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: persistenceError,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.ASSISTANT_MESSAGE_CREATE_FAILED,
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_ASSISTANT_MESSAGE,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      }),
    );

    expect(mocks.completeAiRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
        featureResultIds: [],
      }),
    );

    expect(mocks.completeAiRunFailed).not.toHaveBeenCalled();
    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalled();
  });

  it("실패 cleanup 중 execution claim 완료 실패는 DATABASE stage로 보고한다", async () => {
    const executionError = new Error("execution failed");
    const claimError = new Error("claim completion failed");

    mocks.executeNoteChat.mockRejectedValue(executionError);
    mocks.completeNoteChatExecutionClaim.mockRejectedValue(claimError);

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
      executionError,
    );

    expect(mocks.completeAiRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun,
        buildSnapshot: snapshotAccumulator.buildSnapshot,
      }),
    );

    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: claimError,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_CLAIM_COMPLETE_FAILED,
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_EXECUTION_CLAIM,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      }),
    );
  });
});
