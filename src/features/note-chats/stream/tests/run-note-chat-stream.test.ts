import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import { NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS } from "../../execution/execution-claim-persistence";
import { NOTE_CHAT_NO_CONTEXT_MESSAGE } from "../constants";
import { runNoteChatStream } from "../run-note-chat-stream";

const mocks = vi.hoisted(() => ({
  completeNoteChatExecutionClaim: vi.fn(),
  completeNoteChatExecutionSuccess: vi.fn(),
  consumeNoteChatProviderStream: vi.fn(),
  executeNoteChat: vi.fn(),
  parseNoteChatProviderResponse: vi.fn(),
  reportNoteChatOperationalError: vi.fn(),
  resolveNoteChatUsedNoteIds: vi.fn(),
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

/** 테스트용 실행 입력입니다. */
const params = {
  claimId: "claim-1",
  conversationId: "conversation-1",
  settings: {} as Parameters<typeof runNoteChatStream>[0]["settings"],
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

  it("Provider 응답을 저장하고 Assistant Message ID를 반환한다", async () => {
    mocks.executeNoteChat.mockResolvedValue({
      providerStream,
      sources,
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

    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalledWith({
      claimId: params.claimId,
      content: "답변",
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
      userId: params.userId,
      userMessageId: params.userMessageId,
    });

    expect(result).toEqual({
      assistantMessageId: "assistant-1",
      content: "답변",
      usedNoteIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("Provider가 생성한 스트림 이벤트는 전달한다", async () => {
    mocks.executeNoteChat.mockResolvedValue({
      providerStream,
      sources,
    });

    const providerEvent = {
      delta: "답변",
      type: "text-delta" as const,
    };

    mocks.consumeNoteChatProviderStream.mockImplementation(
      async (_stream, onEvent) => {
        await onEvent(providerEvent);

        return {
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
        };
      },
    );

    mocks.parseNoteChatProviderResponse.mockReturnValue({
      answer: "답변",
      usedContextIndexes: [1],
    });

    mocks.resolveNoteChatUsedNoteIds.mockReturnValue([
      "11111111-1111-4111-8111-111111111111",
    ]);

    const onEvent = vi.fn();

    await runNoteChatStream(params, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(providerEvent);
  });

  it("Context가 없으면 Provider를 호출하지 않고 고정 답변을 저장한다", async () => {
    mocks.executeNoteChat.mockResolvedValue({
      providerStream: null,
      sources: [],
    });

    const onEvent = vi.fn();

    await runNoteChatStream(params, onEvent);

    expect(mocks.consumeNoteChatProviderStream).not.toHaveBeenCalled();

    expect(onEvent).toHaveBeenCalledWith({
      delta: NOTE_CHAT_NO_CONTEXT_MESSAGE,
      type: "text-delta",
    });
    expect(mocks.completeNoteChatExecutionSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        content: NOTE_CHAT_NO_CONTEXT_MESSAGE,
        usedNoteIds: [],
      }),
    );
  });

  it("stream 실패 시 EXECUTION stage로 보고하고 Claim을 실패 처리한다", async () => {
    const streamError = new Error("stream failed");

    mocks.executeNoteChat.mockResolvedValue({
      providerStream,
      sources,
    });

    mocks.consumeNoteChatProviderStream.mockRejectedValue(streamError);

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
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

    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });
  });

  it("Provider 응답 구조 검증 실패를 운영 오류로 보고하고 Claim을 실패 처리한다", async () => {
    const validationError = new Error("Provider response validation failed.");

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

    expect(mocks.reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: validationError,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.PROVIDER_RESPONSE_PARSE_FAILED,
        operation:
          NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.PARSE_PROVIDER_RESPONSE,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
      }),
    );
    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });
  });

  it("Assistant Message 저장 실패를 DATABASE stage로 보고하고 Claim을 실패 처리한다", async () => {
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

    expect(mocks.completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });
  });

  it("실패 cleanup 중 execution claim 완료 실패는 DATABASE stage로 보고한다", async () => {
    const executionError = new Error("execution failed");
    const claimError = new Error("claim completion failed");

    mocks.executeNoteChat.mockRejectedValue(executionError);
    mocks.completeNoteChatExecutionClaim.mockRejectedValue(claimError);

    await expect(runNoteChatStream(params, vi.fn())).rejects.toThrow(
      executionError,
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
