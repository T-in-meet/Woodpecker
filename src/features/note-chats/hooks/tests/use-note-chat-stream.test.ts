// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routerReplaceMock } = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

import {
  NoteChatStreamRequestError,
  streamNoteChatQuestion,
  streamNoteChatUserMessageUpdate,
} from "../../stream/client";
import type { NoteChatStreamEvent } from "../../stream/types";
import { useNoteChatStream } from "../use-note-chat-stream";

vi.mock("../../stream/client", async () => {
  const actual = await vi.importActual<typeof import("../../stream/client")>(
    "../../stream/client",
  );

  return {
    ...actual,
    streamNoteChatQuestion: vi.fn(),
    streamNoteChatUserMessageUpdate: vi.fn(),
  };
});

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440003";
const ASSISTANT_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440005";
const NOTE_ID = "550e8400-e29b-41d4-a716-446655440006";

const START_EVENT: NoteChatStreamEvent = {
  type: "start",
  userMessageId: USER_MESSAGE_ID,
};

const FINISH_EVENT: NoteChatStreamEvent = {
  type: "finish",
  assistantMessageId: ASSISTANT_MESSAGE_ID,
  usedNoteIds: [NOTE_ID],
};

const TEXT_EVENT: NoteChatStreamEvent = {
  type: "text-delta",
  delta: "안녕하세요.",
};

function createStream(...events: NoteChatStreamEvent[]) {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function createDeferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve,
  };
}

describe("useNoteChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("새 질문 스트림의 이벤트를 상태에 반영하고 정상 완료 결과를 반환한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockReturnValue(
      createStream(
        START_EVENT,
        TEXT_EVENT,
        {
          type: "text-delta",
          delta: "반갑습니다.",
        },
        FINISH_EVENT,
      ),
    );

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "안녕하세요?",
      });
    });

    expect(streamNoteChatQuestion).toHaveBeenCalledWith(
      {
        conversationId: CONVERSATION_ID,
        content: {
          text: "안녕하세요?",
        },
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(executionResult).toEqual({
      success: true,
      userMessageId: USER_MESSAGE_ID,
      errorCode: null,
    });

    expect(result.current.content).toBe("안녕하세요.반갑습니다.");
    expect(result.current.userMessageId).toBe(USER_MESSAGE_ID);
    expect(result.current.assistantMessageId).toBe(ASSISTANT_MESSAGE_ID);
    expect(result.current.usedNoteIds).toEqual([NOTE_ID]);
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("스트림 error 이벤트를 상태에 반영하고 실패 결과를 반환한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockReturnValue(
      createStream(START_EVENT, {
        type: "error",
        message: "답변 생성에 실패했습니다.",
      }),
    );

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    expect(executionResult).toEqual({
      success: false,
      userMessageId: USER_MESSAGE_ID,
      errorCode: null,
    });

    expect(result.current.error).toBe("답변 생성에 실패했습니다.");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.userMessageId).toBe(USER_MESSAGE_ID);
    expect(result.current.isStreaming).toBe(false);
  });

  it("스트림 요청 자체가 실패하면 오류 메시지와 오류 코드를 상태에 반영한다", async () => {
    const error = new NoteChatStreamRequestError(
      "노트 챗봇 AI 설정을 불러오지 못했습니다.",
      500,
      "NOTE_CHAT_AI_CONFIGURATION_LOAD_FAILED",
    );

    vi.mocked(streamNoteChatQuestion).mockImplementation(async function* () {
      yield START_EVENT;
      throw error;
    });

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    expect(executionResult).toEqual({
      success: false,
      userMessageId: USER_MESSAGE_ID,
      errorCode: "NOTE_CHAT_AI_CONFIGURATION_LOAD_FAILED",
    });

    expect(result.current.error).toBe(
      "노트 챗봇 AI 설정을 불러오지 못했습니다.",
    );
    expect(result.current.errorCode).toBe(
      "NOTE_CHAT_AI_CONFIGURATION_LOAD_FAILED",
    );
    expect(result.current.isStreaming).toBe(false);
  });

  it("법적 문서 확인이 필요하면 서버가 제공한 경로로 이동한다", async () => {
    const redirectTo = "/agreements?redirect=%2Fnote-chats";

    vi.mocked(streamNoteChatQuestion).mockImplementation(async function* () {
      throw new NoteChatStreamRequestError(
        "법적 문서 확인이 필요합니다.",
        403,
        null,
        redirectTo,
      );
    });

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    expect(routerReplaceMock).toHaveBeenCalledWith(redirectTo);
    expect(result.current.error).toBeNull();
  });

  it("일반 Error가 발생하면 오류 메시지를 상태에 반영하고 오류 코드는 null로 반환한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockImplementation(async function* () {
      throw new Error("네트워크 오류");
    });

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    expect(executionResult).toEqual({
      success: false,
      userMessageId: null,
      errorCode: null,
    });

    expect(result.current.error).toBe("네트워크 오류");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("cancel을 호출하면 현재 스트림을 중단하고 스트리밍 상태를 종료한다", async () => {
    const deferred = createDeferred();
    let receivedSignal: AbortSignal | undefined;

    vi.mocked(streamNoteChatQuestion).mockImplementation(
      async function* (_input, options) {
        receivedSignal = options?.signal;

        await deferred.promise;

        if (options?.signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }

        yield START_EVENT;
      },
    );

    const { result } = renderHook(() => useNoteChatStream());

    let startPromise!: Promise<unknown>;

    act(() => {
      startPromise = result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    await waitFor(() => {
      expect(receivedSignal).not.toBeNull();
    });

    act(() => {
      result.current.cancel();
    });

    expect(receivedSignal).not.toBeNull();
    expect(receivedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);

    deferred.resolve();

    await act(async () => {
      await startPromise;
    });
  });

  it("reset을 호출하면 스트리밍 임시 상태를 초기 상태로 되돌린다", async () => {
    vi.mocked(streamNoteChatQuestion).mockReturnValue(
      createStream(START_EVENT, TEXT_EVENT, FINISH_EVENT),
    );

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
      });
    });

    expect(result.current.content).toBe("안녕하세요.");
    expect(result.current.assistantMessageId).toBe(ASSISTANT_MESSAGE_ID);
    expect(result.current.usedNoteIds).toEqual([NOTE_ID]);
    expect(result.current.userMessageId).toBe(USER_MESSAGE_ID);

    act(() => {
      result.current.reset();
    });

    expect(result.current).toMatchObject({
      assistantMessageId: null,
      content: "",
      error: null,
      errorCode: null,
      isStreaming: false,
      usedNoteIds: [],
      userMessageId: null,
    });
  });

  it("기존 사용자 질문을 수정하면 수정 스트림을 호출하고 정상 완료 결과를 반환한다", async () => {
    vi.mocked(streamNoteChatUserMessageUpdate).mockReturnValue(
      createStream(START_EVENT, TEXT_EVENT, FINISH_EVENT),
    );

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.update({
        messageId: MESSAGE_ID,
        question: "수정된 질문입니다.",
      });
    });

    expect(streamNoteChatUserMessageUpdate).toHaveBeenCalledWith(
      {
        messageId: MESSAGE_ID,
        content: {
          text: "수정된 질문입니다.",
        },
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(executionResult).toEqual({
      success: true,
      userMessageId: USER_MESSAGE_ID,
      errorCode: null,
    });

    expect(result.current.content).toBe("안녕하세요.");
    expect(result.current.userMessageId).toBe(USER_MESSAGE_ID);
    expect(result.current.assistantMessageId).toBe(ASSISTANT_MESSAGE_ID);
    expect(result.current.usedNoteIds).toEqual([NOTE_ID]);
    expect(result.current.isStreaming).toBe(false);
  });

  it("질문 수정 스트림이 시작 이벤트 없이 종료되면 수정 대상 messageId를 userMessageId로 반환한다", async () => {
    vi.mocked(streamNoteChatUserMessageUpdate).mockReturnValue(
      createStream(TEXT_EVENT, FINISH_EVENT),
    );

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.update({
        messageId: MESSAGE_ID,
        question: "수정된 질문입니다.",
      });
    });

    expect(executionResult).toEqual({
      success: true,
      userMessageId: MESSAGE_ID,
      errorCode: null,
    });
  });

  it("질문 수정 스트림 요청이 실패하면 수정된 질문에 대한 오류 상태를 설정한다", async () => {
    vi.mocked(streamNoteChatUserMessageUpdate).mockImplementation(
      async function* () {
        throw new Error("질문 수정 후 답변 생성에 실패했습니다.");
      },
    );

    const { result } = renderHook(() => useNoteChatStream());

    let executionResult;

    await act(async () => {
      executionResult = await result.current.update({
        messageId: MESSAGE_ID,
        question: "수정된 질문입니다.",
      });
    });

    expect(executionResult).toEqual({
      success: false,
      userMessageId: MESSAGE_ID,
      errorCode: null,
    });

    expect(result.current.error).toBe("질문 수정 후 답변 생성에 실패했습니다.");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("새로운 스트림을 시작하면 기존 스트림을 취소한다", async () => {
    const firstDeferred = createDeferred();
    const firstSignals: AbortSignal[] = [];

    vi.mocked(streamNoteChatQuestion).mockImplementation(
      async function* (_input, options) {
        if (options?.signal) {
          firstSignals.push(options.signal);
        }

        await firstDeferred.promise;

        if (options?.signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }

        yield START_EVENT;
      },
    );

    vi.mocked(streamNoteChatUserMessageUpdate).mockReturnValue(
      createStream(START_EVENT, FINISH_EVENT),
    );

    const { result } = renderHook(() => useNoteChatStream());

    let firstPromise!: Promise<unknown>;

    act(() => {
      firstPromise = result.current.start({
        conversationId: CONVERSATION_ID,
        question: "첫 번째 질문",
      });
    });

    await waitFor(() => {
      expect(firstSignals).toHaveLength(1);
    });

    let secondPromise!: Promise<unknown>;

    act(() => {
      secondPromise = result.current.update({
        messageId: MESSAGE_ID,
        question: "두 번째 질문",
      });
    });

    expect(firstSignals[0]?.aborted).toBe(true);

    firstDeferred.resolve();

    await act(async () => {
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(result.current.assistantMessageId).toBe(ASSISTANT_MESSAGE_ID);
    expect(result.current.isStreaming).toBe(false);
  });
});
