import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "../../constants/execution";
import { noteChatQueryKeys } from "../../constants/query-keys";
import { useNoteChatConversationExecution } from "../use-note-chat-conversation-execution";

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440002";

const mockInvalidateQueries = vi.fn();

const mockCancel = vi.fn();
const mockReset = vi.fn();
const mockStart = vi.fn();
const mockUpdate = vi.fn();

let mockIsStreaming = false;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("../use-note-chat-stream", () => ({
  useNoteChatStream: () => ({
    cancel: mockCancel,
    content: "",
    error: null,
    errorCode: null,
    isStreaming: mockIsStreaming,
    reset: mockReset,
    start: mockStart,
    update: mockUpdate,
  }),
}));

describe("useNoteChatConversationExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStreaming = false;

    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  it("로컬 stream 또는 running Claim이 있으면 답변 생성 중 상태로 처리한다", () => {
    const { result, rerender } = renderHook(
      ({ hasRunningExecution }: { hasRunningExecution: boolean }) =>
        useNoteChatConversationExecution({
          conversationId: CONVERSATION_ID,
          hasRunningExecution,
        }),
      {
        initialProps: {
          hasRunningExecution: true,
        },
      },
    );

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isAnswerGenerating).toBe(true);

    rerender({
      hasRunningExecution: false,
    });

    expect(result.current.isAnswerGenerating).toBe(false);
  });

  it("질문 전송 성공 후 관련 Query를 갱신하고 stream 상태를 초기화한다", async () => {
    mockStart.mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() =>
      useNoteChatConversationExecution({
        conversationId: CONVERSATION_ID,
        hasRunningExecution: false,
      }),
    );

    await act(async () => {
      await result.current.handleQuestionSubmit("새 질문");
    });

    expect(mockStart).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      question: "새 질문",
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: noteChatQueryKeys.conversationDetail(CONVERSATION_ID),
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: noteChatQueryKeys.conversationMessages(CONVERSATION_ID),
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: noteChatQueryKeys.conversationLists(),
    });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(4, {
      queryKey: noteChatQueryKeys.dailyUsage(),
    });

    expect(result.current.pendingQuestion).toBeNull();
    expect(result.current.canRetry).toBe(false);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("질문 전송 실패 시 실패한 User Message를 재시도 가능 상태로 유지한다", async () => {
    mockStart.mockResolvedValue({
      success: false,
      errorCode: "NOTE_CHAT_STREAM_FAILED",
      userMessageId: USER_MESSAGE_ID,
    });

    const { result } = renderHook(() =>
      useNoteChatConversationExecution({
        conversationId: CONVERSATION_ID,
        hasRunningExecution: false,
      }),
    );

    await act(async () => {
      await result.current.handleQuestionSubmit("실패할 질문");
    });

    expect(result.current.pendingQuestion).toBeNull();
    expect(result.current.canRetry).toBe(true);
    expect(result.current.retryCount).toBe(0);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("일일 실행 제한으로 질문 전송이 실패하면 재시도를 허용하지 않는다", async () => {
    mockStart.mockResolvedValue({
      success: false,
      errorCode: NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE,
      userMessageId: USER_MESSAGE_ID,
    });

    const { result } = renderHook(() =>
      useNoteChatConversationExecution({
        conversationId: CONVERSATION_ID,
        hasRunningExecution: false,
      }),
    );

    await act(async () => {
      await result.current.handleQuestionSubmit("제한 초과 질문");
    });

    expect(result.current.pendingQuestion).toBeNull();
    expect(result.current.canRetry).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("기존 질문 수정 성공 후 수정 상태를 해제하고 stream 상태를 초기화한다", async () => {
    mockUpdate.mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() =>
      useNoteChatConversationExecution({
        conversationId: CONVERSATION_ID,
        hasRunningExecution: false,
      }),
    );

    await act(async () => {
      await result.current.handleQuestionUpdate({
        messageId: USER_MESSAGE_ID,
        question: "수정한 질문",
        sequenceNumber: 3,
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      messageId: USER_MESSAGE_ID,
      question: "수정한 질문",
    });

    expect(result.current.editingSequenceNumber).toBeNull();
    expect(result.current.pendingQuestion).toBeNull();
    expect(result.current.canRetry).toBe(false);

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("실패한 질문 재시도가 성공하면 재시도 상태를 초기화한다", async () => {
    mockStart.mockResolvedValue({
      success: false,
      errorCode: "NOTE_CHAT_STREAM_FAILED",
      userMessageId: USER_MESSAGE_ID,
    });

    mockUpdate.mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() =>
      useNoteChatConversationExecution({
        conversationId: CONVERSATION_ID,
        hasRunningExecution: false,
      }),
    );

    await act(async () => {
      await result.current.handleQuestionSubmit("재시도할 질문");
    });

    expect(result.current.canRetry).toBe(true);

    mockInvalidateQueries.mockClear();
    mockReset.mockClear();

    await act(async () => {
      await result.current.handleRetry();
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      messageId: USER_MESSAGE_ID,
      question: "재시도할 질문",
    });

    expect(result.current.canRetry).toBe(false);
    expect(result.current.retryCount).toBe(0);

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("답변 생성 중에는 실패한 질문의 재시도를 차단한다", async () => {
    mockStart.mockResolvedValue({
      success: false,
      errorCode: "NOTE_CHAT_STREAM_FAILED",
      userMessageId: USER_MESSAGE_ID,
    });

    const { result, rerender } = renderHook(
      ({ hasRunningExecution }: { hasRunningExecution: boolean }) =>
        useNoteChatConversationExecution({
          conversationId: CONVERSATION_ID,
          hasRunningExecution,
        }),
      {
        initialProps: {
          hasRunningExecution: false,
        },
      },
    );

    await act(async () => {
      await result.current.handleQuestionSubmit("재시도할 질문");
    });

    expect(result.current.canRetry).toBe(true);

    rerender({
      hasRunningExecution: true,
    });

    expect(result.current.isAnswerGenerating).toBe(true);
    expect(result.current.canRetry).toBe(false);

    mockUpdate.mockClear();
    mockInvalidateQueries.mockClear();

    await act(async () => {
      await result.current.handleRetry();
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
