import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "../constants";
import { runNoteChatStream } from "../run-note-chat-stream";

const mocks = vi.hoisted(() => ({
  markNoteChatRunRunning: vi.fn(),
  executeNoteChat: vi.fn(),
  saveNoteChatExpandedQuery: vi.fn(),
  consumeNoteChatProviderStream: vi.fn(),
  parseNoteChatProviderResponse: vi.fn(),
  resolveNoteChatUsedNoteIds: vi.fn(),
  completeNoteChatRunSuccess: vi.fn(),
  completeNoteChatRunFailure: vi.fn(),
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("../../execution/run-persistence", () => ({
  markNoteChatRunRunning: mocks.markNoteChatRunRunning,
  saveNoteChatExpandedQuery: mocks.saveNoteChatExpandedQuery,
  completeNoteChatRunSuccess: mocks.completeNoteChatRunSuccess,
  completeNoteChatRunFailure: mocks.completeNoteChatRunFailure,
}));

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

const params = {
  conversationId: "conversation-1",
  runId: "run-1",
  settings: {} as Parameters<typeof runNoteChatStream>[0]["settings"],
  userId: "user-1",
  userMessageId: "message-1",
};

const providerStream = (async function* () {
  yield {
    type: "text-delta" as const,
    delta: "답변",
  };
})();

const sources = [
  {
    contextIndex: 1,
    noteId: "11111111-1111-4111-8111-111111111111",
    type: "note",
  },
];

/**
 * 질의 확장 Chat Completion에서 사용한 token 사용량입니다.
 */
const queryExpansionUsage = {
  inputTokens: 5,
  outputTokens: 10,
  totalTokens: 15,
};

/**
 * 최종 답변 Chat Completion에서 사용한 token 사용량입니다.
 */
const answerUsage = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

/**
 * 하나의 Note Chat 실행에서 발생한 전체 Chat Completion의
 * token 사용량을 합산한 값입니다.
 */
const totalUsage = {
  inputTokens: 15,
  outputTokens: 30,
  totalTokens: 45,
};

function setupSuccessfulExecution() {
  mocks.markNoteChatRunRunning.mockResolvedValue(undefined);

  mocks.executeNoteChat.mockResolvedValue({
    expandedQuery: "확장된 검색 질의",
    providerStream,
    queryExpansionUsage,
    sources,
  });

  mocks.saveNoteChatExpandedQuery.mockResolvedValue(undefined);

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

  mocks.completeNoteChatRunSuccess.mockResolvedValue("assistant-message-1");
}

describe("runNoteChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("실행을 시작하고 질의 확장과 답변의 usage를 합산하여 성공 처리한다", async () => {
    setupSuccessfulExecution();

    const events: unknown[] = [];
    const onEvent = vi.fn((event) => {
      events.push(event);
    });

    const result = await runNoteChatStream(params, onEvent);

    expect(mocks.markNoteChatRunRunning).toHaveBeenCalledWith(params.runId);

    expect(mocks.executeNoteChat).toHaveBeenCalledWith({
      conversationId: params.conversationId,
      settings: params.settings,
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    expect(mocks.saveNoteChatExpandedQuery).toHaveBeenCalledWith({
      expandedQuery: "확장된 검색 질의",
      runId: params.runId,
    });

    expect(mocks.consumeNoteChatProviderStream).toHaveBeenCalledWith(
      providerStream,
      expect.any(Function),
    );

    expect(mocks.parseNoteChatProviderResponse).toHaveBeenCalledWith(
      '{"answer":"답변입니다.","usedContextIndexes":[1]}',
    );

    expect(mocks.resolveNoteChatUsedNoteIds).toHaveBeenCalledWith([1], sources);

    expect(mocks.completeNoteChatRunSuccess).toHaveBeenCalledWith({
      content: "답변입니다.",
      runId: params.runId,
      sources,
      usage: totalUsage,
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(events).toEqual([
      {
        runId: params.runId,
        type: "start",
        userMessageId: params.userMessageId,
      },
      {
        assistantMessageId: "assistant-message-1",
        runId: params.runId,
        type: "finish",
        usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
      },
    ]);

    expect(result).toEqual({
      assistantMessageId: "assistant-message-1",
      content: "답변입니다.",
      runId: params.runId,
      usage: totalUsage,
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("Provider text-delta를 onEvent로 전달한다", async () => {
    setupSuccessfulExecution();

    const onEvent = vi.fn();

    mocks.consumeNoteChatProviderStream.mockImplementation(
      async (_stream, onTextDelta) => {
        await onTextDelta({
          type: "text-delta",
          delta: "안녕하세요.",
        });

        return {
          content: '{"answer":"안녕하세요.","usedContextIndexes":[]}',
          result: {
            content: '{"answer":"안녕하세요.","usedContextIndexes":[]}',
            usage: answerUsage,
          },
        };
      },
    );

    mocks.parseNoteChatProviderResponse.mockReturnValue({
      answer: "안녕하세요.",
      usedContextIndexes: [],
    });

    mocks.resolveNoteChatUsedNoteIds.mockReturnValue([]);

    await runNoteChatStream(params, onEvent);

    expect(onEvent).toHaveBeenCalledWith({
      type: "start",
      runId: params.runId,
      userMessageId: params.userMessageId,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "text-delta",
      delta: "안녕하세요.",
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "finish",
      runId: params.runId,
      assistantMessageId: "assistant-message-1",
      usedNoteIds: [],
    });

    expect(mocks.completeNoteChatRunSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: totalUsage,
      }),
    );
  });

  it("검색된 Context가 없으면 답변 Provider를 호출하지 않고 질의 확장 usage로 성공 처리한다", async () => {
    setupSuccessfulExecution();

    mocks.executeNoteChat.mockResolvedValue({
      expandedQuery: "확장된 검색 질의",
      providerStream,
      queryExpansionUsage,
      sources: [],
    });

    mocks.completeNoteChatRunSuccess.mockResolvedValue("assistant-message-1");

    const onEvent = vi.fn();

    const result = await runNoteChatStream(params, onEvent);

    expect(mocks.saveNoteChatExpandedQuery).toHaveBeenCalledWith({
      expandedQuery: "확장된 검색 질의",
      runId: params.runId,
    });

    expect(mocks.consumeNoteChatProviderStream).not.toHaveBeenCalled();
    expect(mocks.parseNoteChatProviderResponse).not.toHaveBeenCalled();
    expect(mocks.resolveNoteChatUsedNoteIds).not.toHaveBeenCalled();

    /*
     * Context가 없더라도 질의 확장 Chat Completion은 이미 실행되었으므로
     * Run에는 0이 아니라 질의 확장에서 실제 사용한 token을 저장합니다.
     */
    expect(mocks.completeNoteChatRunSuccess).toHaveBeenCalledWith({
      content: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      runId: params.runId,
      sources: [],
      usage: queryExpansionUsage,
      usedNoteIds: [],
    });

    expect(onEvent).toHaveBeenCalledWith({
      delta: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      type: "text-delta",
    });

    expect(onEvent).toHaveBeenCalledWith({
      assistantMessageId: "assistant-message-1",
      runId: params.runId,
      type: "finish",
      usedNoteIds: [],
    });

    expect(result).toEqual({
      assistantMessageId: "assistant-message-1",
      content: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      runId: params.runId,
      usage: queryExpansionUsage,
      usedNoteIds: [],
    });
  });

  it("Run을 Running 상태로 변경하지 못하면 실행을 중단하고 운영 오류를 기록한다", async () => {
    const error = new Error("mark running failed");

    mocks.markNoteChatRunRunning.mockRejectedValue(error);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "mark running failed",
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        userId: params.userId,
      }),
    );

    expect(mocks.executeNoteChat).not.toHaveBeenCalled();
    expect(mocks.completeNoteChatRunFailure).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("확장 질의 저장에 실패하면 질의 확장 usage를 유지한 채 Run을 실패 처리한다", async () => {
    setupSuccessfulExecution();

    const error = new Error("expanded query save failed");

    mocks.saveNoteChatExpandedQuery.mockRejectedValue(error);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "expanded query save failed",
    );

    /*
     * executeNoteChat()이 완료된 시점에는 질의 확장 Provider 호출도
     * 완료되었으므로 이후 단계가 실패해도 해당 usage는 보존합니다.
     */
    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: queryExpansionUsage,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      runId: params.runId,
      message: "답변 생성에 실패했습니다.",
    });
  });

  it("Provider 스트림 소비에 실패하면 질의 확장 usage를 유지한 채 Run을 실패 처리한다", async () => {
    setupSuccessfulExecution();

    const error = new Error("stream consume failed");

    mocks.consumeNoteChatProviderStream.mockRejectedValue(error);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "stream consume failed",
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: params.userId,
        context: {
          conversationId: params.conversationId,
          runId: params.runId,
        },
        error,
        userId: params.userId,
      }),
    );

    /*
     * 최종 답변 Provider의 완료 usage는 얻지 못했지만
     * 이미 완료된 질의 확장 usage는 Run에 남깁니다.
     */
    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: queryExpansionUsage,
    });
  });

  it("Provider 응답 파싱에 실패하면 합산 usage를 유지한 채 Run을 실패 처리한다", async () => {
    setupSuccessfulExecution();

    const error = new Error("response parse failed");

    mocks.parseNoteChatProviderResponse.mockImplementation(() => {
      throw error;
    });

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "response parse failed",
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: params.userId,
        error,
        userId: params.userId,
      }),
    );

    /*
     * Provider 스트림은 정상 완료되었으므로 질의 확장과
     * 최종 답변의 token 사용량을 모두 보존합니다.
     */
    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: totalUsage,
    });
  });

  it("사용 노트 ID 변환에 실패하면 합산 usage를 유지한 채 Run을 실패 처리한다", async () => {
    setupSuccessfulExecution();

    const error = new Error("used notes resolve failed");

    mocks.resolveNoteChatUsedNoteIds.mockImplementation(() => {
      throw error;
    });

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "used notes resolve failed",
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: params.userId,
        error,
        userId: params.userId,
      }),
    );

    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: totalUsage,
    });
  });

  it("성공 완료 저장에 실패해도 합산 usage를 유지한 채 Run을 실패 처리한다", async () => {
    setupSuccessfulExecution();

    const error = new Error("success completion failed");

    mocks.completeNoteChatRunSuccess.mockRejectedValue(error);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "success completion failed",
    );

    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: totalUsage,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      runId: params.runId,
      message: "답변 생성에 실패했습니다.",
    });
  });

  it("실패 상태 저장에도 실패하면 해당 오류를 별도로 운영 오류로 기록한다", async () => {
    setupSuccessfulExecution();

    const executionError = new Error("stream failed");
    const failureCompletionError = new Error("failure completion failed");

    mocks.consumeNoteChatProviderStream.mockRejectedValue(executionError);
    mocks.completeNoteChatRunFailure.mockRejectedValue(failureCompletionError);

    const onEvent = vi.fn();

    await expect(runNoteChatStream(params, onEvent)).rejects.toThrow(
      "stream failed",
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: executionError,
      }),
    );

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failureCompletionError,
      }),
    );

    expect(mocks.completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: params.runId,
      usage: queryExpansionUsage,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "error",
      runId: params.runId,
      message: "답변 생성에 실패했습니다.",
    });
  });
});
