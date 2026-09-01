import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "../constants";
import { runNoteChatStream } from "../run-note-chat-stream";

const mocks = vi.hoisted(() => ({
  completeNoteChatExecutionClaim: vi.fn(),
  completeNoteChatExecutionSuccess: vi.fn(),
  completeNoteChatRunFailure: vi.fn(),
  completeNoteChatRunSuccess: vi.fn(),
  consumeNoteChatProviderStream: vi.fn(),
  executeNoteChat: vi.fn(),
  parseNoteChatProviderResponse: vi.fn(),
  reportNoteChatOperationalError: vi.fn(),
  resolveNoteChatUsedNoteIds: vi.fn(),
  saveNoteChatExpandedQuery: vi.fn(),
  saveNoteChatRunAnswerGeneration: vi.fn(),
  saveNoteChatRunQueryEmbedding: vi.fn(),
  saveNoteChatRunQueryExpansion: vi.fn(),
  saveNoteChatRunSources: vi.fn(),
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

vi.mock("../../execution/run-persistence", async () => {
  const actual = await vi.importActual<
    typeof import("../../execution/run-persistence")
  >("../../execution/run-persistence");

  return {
    ...actual,
    completeNoteChatRunFailure: mocks.completeNoteChatRunFailure,
    completeNoteChatRunSuccess: mocks.completeNoteChatRunSuccess,
    saveNoteChatExpandedQuery: mocks.saveNoteChatExpandedQuery,
    saveNoteChatRunAnswerGeneration: mocks.saveNoteChatRunAnswerGeneration,
    saveNoteChatRunQueryEmbedding: mocks.saveNoteChatRunQueryEmbedding,
    saveNoteChatRunQueryExpansion: mocks.saveNoteChatRunQueryExpansion,
    saveNoteChatRunSources: mocks.saveNoteChatRunSources,
  };
});

vi.mock("../../execution/execute", () => ({
  executeNoteChat: mocks.executeNoteChat,
}));

vi.mock("../../execution/parse-response", () => ({
  parseNoteChatProviderResponse: mocks.parseNoteChatProviderResponse,
}));

vi.mock("../../execution/resolve-used-note-ids", () => ({
  resolveNoteChatUsedNoteIds: mocks.resolveNoteChatUsedNoteIds,
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: mocks.reportNoteChatOperationalError,
}));

vi.mock("../consume-provider-stream", () => ({
  consumeNoteChatProviderStream: mocks.consumeNoteChatProviderStream,
}));

/** 테스트용 실행 입력입니다. */
const params = {
  claimId: "claim-1",
  conversationId: "conversation-1",
  runId: "run-1",
  settings: {
    chat: {
      model: {
        model: "gpt-4o-mini",
        provider: "openai",
      },
    },
    embedding: {
      model: {
        model: "text-embedding-3-small",
        provider: "openai",
      },
    },
    queryExpansion: {
      model: {
        model: "gpt-4o-mini",
        provider: "openai",
      },
    },
  } as Parameters<typeof runNoteChatStream>[0]["settings"],
  userId: "user-1",
  userMessageId: "message-1",
};

/** 테스트용 Provider stream입니다. */
const providerStream = (async function* () {
  yield {
    delta: "답변",
    type: "text-delta" as const,
  };
})();

/** 테스트용 Source snapshot입니다. */
const sources = [
  {
    contextIndex: 1,
    noteId: "11111111-1111-4111-8111-111111111111",
    title: "Note",
    type: "note",
  },
];

/** Query Expansion usage fixture입니다. */
const queryExpansionUsage = {
  inputTokens: 5,
  outputTokens: 10,
  totalTokens: 15,
};

/** Query Embedding usage fixture입니다. */
const queryEmbeddingUsage = {
  inputTokens: 4,
  outputTokens: 0,
  totalTokens: 4,
};

/** Answer Generation usage fixture입니다. */
const answerUsage = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

/** 성공 실행 mock을 구성합니다. */
function setupSuccessfulExecution() {
  mocks.executeNoteChat.mockImplementation(async (input) => {
    await input.onQueryExpansionUsage?.(queryExpansionUsage);
    await input.onQueryEmbeddingUsage?.(queryEmbeddingUsage);

    return {
      expandedQuery: "확장된 검색 질의",
      providerStream,
      queryEmbeddingUsage,
      queryExpansionUsage,
      sources,
    };
  });

  mocks.consumeNoteChatProviderStream.mockResolvedValue({
    content: '{"answer":"답변입니다.","usedContextIndexes":[1]}',
    result: {
      content: '{"answer":"답변입니다.","usedContextIndexes":[1]}',
      usage: answerUsage,
    },
  });

  mocks.parseNoteChatProviderResponse.mockReturnValue({
    answer: "답변입니다.",
    usedContextIndexes: [1],
  });

  mocks.resolveNoteChatUsedNoteIds.mockReturnValue([
    "11111111-1111-4111-8111-111111111111",
  ]);

  mocks.completeNoteChatExecutionSuccess.mockResolvedValue(
    "assistant-message-1",
  );
  mocks.completeNoteChatExecutionClaim.mockResolvedValue(undefined);
  mocks.completeNoteChatRunFailure.mockResolvedValue(undefined);
  mocks.completeNoteChatRunSuccess.mockResolvedValue(undefined);
  mocks.saveNoteChatExpandedQuery.mockResolvedValue(undefined);
  mocks.saveNoteChatRunAnswerGeneration.mockResolvedValue(undefined);
  mocks.saveNoteChatRunQueryEmbedding.mockResolvedValue(undefined);
  mocks.saveNoteChatRunQueryExpansion.mockResolvedValue(undefined);
  mocks.saveNoteChatRunSources.mockResolvedValue(undefined);
}

describe("runNoteChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("단계별 usage와 snapshot을 저장하고 Assistant Message와 Claim 성공을 원자적으로 확정한다", async () => {
    setupSuccessfulExecution();

    const onEvent = vi.fn();

    const result = await runNoteChatStream(params, onEvent);

    expect(mocks.saveNoteChatRunQueryExpansion).toHaveBeenCalledWith({
      modelKey: "openai-gpt-4o-mini",
      runId: params.runId,
      usage: queryExpansionUsage,
    });

    expect(mocks.saveNoteChatRunQueryEmbedding).toHaveBeenCalledWith({
      modelKey: "openai-text-embedding-3-small",
      runId: params.runId,
      usage: queryEmbeddingUsage,
    });

    expect(mocks.saveNoteChatRunAnswerGeneration).toHaveBeenCalledWith({
      modelKey: "openai-gpt-4o-mini",
      runId: params.runId,
      usage: answerUsage,
    });

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalledWith({
      claimId: params.claimId,
      content: "답변입니다.",
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    expect(mocks.completeNoteChatRunSuccess).toHaveBeenCalledWith({
      assistantMessageId: "assistant-message-1",
      runId: params.runId,
      sources,
    });

    /*
     * 성공 Claim 전환은 completeNoteChatExecutionSuccess RPC 내부에서
     * Assistant Message 저장과 함께 처리하므로 별도 completion RPC를
     * 호출하면 안 됩니다.
     */
    expect(mocks.completeNoteChatExecutionClaim).not.toHaveBeenCalled();

    /*
     * start / finish / error는 HTTP 응답 lifecycle 이벤트이므로
     * runNoteChatStream이 직접 전달하지 않습니다.
     *
     * Provider의 실제 text-delta 전달 여부는 consumeNoteChatProviderStream이
     * 전달받은 callback을 실행하는 테스트에서 별도로 검증합니다.
     */
    expect(onEvent).not.toHaveBeenCalled();

    expect(result).toEqual({
      assistantMessageId: "assistant-message-1",
      content: "답변입니다.",
      runId: params.runId,
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("Provider가 생성한 스트림 이벤트는 전달한다", async () => {
    setupSuccessfulExecution();

    const providerEvent = {
      delta: "답변",
      type: "text-delta" as const,
    };

    mocks.consumeNoteChatProviderStream.mockImplementation(
      async (_stream, onEvent) => {
        await onEvent(providerEvent);

        return {
          content: '{"answer":"답변입니다.","usedContextIndexes":[1]}',
          result: {
            content: '{"answer":"답변입니다.","usedContextIndexes":[1]}',
            usage: answerUsage,
          },
        };
      },
    );

    const onEvent = vi.fn();

    await runNoteChatStream(params, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(providerEvent);
  });

  it("Run 중간 저장 실패는 운영 오류로 기록하고 기능 성공을 계속한다", async () => {
    setupSuccessfulExecution();

    const updateError = new Error("run update failed");

    mocks.saveNoteChatExpandedQuery.mockRejectedValue(updateError);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).resolves.toEqual(
      expect.objectContaining({
        assistantMessageId: "assistant-message-1",
      }),
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: updateError,
      }),
    );

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalled();
    expect(mocks.completeNoteChatExecutionClaim).not.toHaveBeenCalled();
  });

  it("Run 생성 실패로 runId가 null이어도 Chat 실행과 성공 확정을 계속한다", async () => {
    setupSuccessfulExecution();

    const runlessParams = {
      ...params,
      runId: null,
    };

    const onEvent = vi.fn();

    await expect(runNoteChatStream(runlessParams, onEvent)).resolves.toEqual(
      expect.objectContaining({
        assistantMessageId: "assistant-message-1",
        runId: null,
      }),
    );

    expect(mocks.saveNoteChatExpandedQuery).not.toHaveBeenCalled();
    expect(mocks.saveNoteChatRunQueryExpansion).not.toHaveBeenCalled();
    expect(mocks.saveNoteChatRunQueryEmbedding).not.toHaveBeenCalled();
    expect(mocks.saveNoteChatRunAnswerGeneration).not.toHaveBeenCalled();
    expect(mocks.saveNoteChatRunSources).not.toHaveBeenCalled();

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalledWith({
      claimId: params.claimId,
      content: "답변입니다.",
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    expect(mocks.completeNoteChatRunSuccess).not.toHaveBeenCalled();

    /*
     * runId 유무와 무관하게 start / finish lifecycle 이벤트는
     * Route에서 처리합니다.
     */
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("성공 확정 RPC 실패는 실행 실패로 처리하고 Claim failed 정리를 시도한다", async () => {
    setupSuccessfulExecution();

    const completionError = new Error("atomic success failed");

    mocks.completeNoteChatExecutionSuccess.mockRejectedValue(completionError);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "atomic success failed",
    );

    expect(mocks.completeNoteChatRunSuccess).not.toHaveBeenCalled();

    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      failureMessage: "atomic success failed",
      runId: params.runId,
    });

    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: "failed",
    });

    /*
     * 실행 실패를 클라이언트 error 이벤트로 변환하는 책임도
     * Route로 이동했으므로 runNoteChatStream은 error 이벤트를 보내지 않습니다.
     */
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("Run 성공 기록 실패는 기능 성공을 뒤집지 않는다", async () => {
    setupSuccessfulExecution();

    const runError = new Error("run success update failed");

    mocks.completeNoteChatRunSuccess.mockRejectedValue(runError);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).resolves.toEqual({
      assistantMessageId: "assistant-message-1",
      content: "답변입니다.",
      runId: params.runId,
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalled();

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: runError,
      }),
    );

    /*
     * 기능 성공은 atomic success RPC에서 이미 확정됐으므로
     * Run 감사 기록 실패 때문에 Claim을 failed로 되돌리면 안 됩니다.
     */
    expect(mocks.completeNoteChatExecutionClaim).not.toHaveBeenCalled();

    /*
     * Run 성공 기록 실패 여부와 관계없이 finish 이벤트는
     * runNoteChatStream의 책임이 아닙니다.
     */
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("검색 Context가 없으면 Provider 답변 생성을 건너뛰고 안내 메시지로 성공 확정한다", async () => {
    setupSuccessfulExecution();

    mocks.executeNoteChat.mockImplementation(async (input) => {
      await input.onQueryExpansionUsage?.(queryExpansionUsage);
      await input.onQueryEmbeddingUsage?.(queryEmbeddingUsage);

      return {
        expandedQuery: "확장된 검색 질의",
        providerStream,
        queryEmbeddingUsage,
        queryExpansionUsage,
        sources: [],
      };
    });

    const onEvent = vi.fn();

    const result = await runNoteChatStream(params, onEvent);

    expect(mocks.consumeNoteChatProviderStream).not.toHaveBeenCalled();
    expect(mocks.saveNoteChatRunAnswerGeneration).not.toHaveBeenCalled();

    /*
     * Context 없음 고정 응답은 Provider stream을 거치지 않으므로
     * runNoteChatStream이 직접 text-delta를 전달합니다.
     */
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      delta: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      type: "text-delta",
    });

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalledWith({
      claimId: params.claimId,
      content: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      usedNoteIds: [],
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    expect(mocks.completeNoteChatRunSuccess).toHaveBeenCalledWith({
      assistantMessageId: "assistant-message-1",
      runId: params.runId,
      sources: [],
    });

    expect(mocks.completeNoteChatExecutionClaim).not.toHaveBeenCalled();

    expect(result).toEqual({
      assistantMessageId: "assistant-message-1",
      content: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      runId: params.runId,
      usedNoteIds: [],
    });
  });

  it("검색 Context가 없는 성공 확정도 실패하면 Claim failed 정리를 시도한다", async () => {
    setupSuccessfulExecution();

    mocks.executeNoteChat.mockImplementation(async (input) => {
      await input.onQueryExpansionUsage?.(queryExpansionUsage);
      await input.onQueryEmbeddingUsage?.(queryEmbeddingUsage);

      return {
        expandedQuery: "확장된 검색 질의",
        providerStream,
        queryEmbeddingUsage,
        queryExpansionUsage,
        sources: [],
      };
    });

    const completionError = new Error("no-context atomic success failed");

    mocks.completeNoteChatExecutionSuccess.mockRejectedValue(completionError);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "no-context atomic success failed",
    );

    expect(mocks.consumeNoteChatProviderStream).not.toHaveBeenCalled();

    expect(onEvent).toHaveBeenCalledWith({
      delta: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      type: "text-delta",
    });

    expect(mocks.completeNoteChatRunSuccess).not.toHaveBeenCalled();

    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      failureMessage: "no-context atomic success failed",
      runId: params.runId,
    });

    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: "failed",
    });
  });
});
