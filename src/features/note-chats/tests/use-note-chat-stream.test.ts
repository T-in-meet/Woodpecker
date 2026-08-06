import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteChatStream } from "../hooks/use-note-chat-stream";
import type { NoteChatRunSettings } from "../schema";
import { streamNoteChatQuestion } from "../stream/client";
import type { NoteChatStreamEvent } from "../stream/types";

vi.mock("../stream/client", () => ({
  streamNoteChatQuestion: vi.fn(),
}));

const SETTINGS: NoteChatRunSettings = {
  agentId: "11111111-1111-4111-8111-111111111111",
  promptVersionId: "22222222-2222-4222-8222-222222222222",
  chatModelConfigId: "33333333-3333-4333-8333-333333333333",
  embeddingModelConfigId: "44444444-4444-4444-8444-444444444444",
};

const CONVERSATION_ID = "55555555-5555-4555-8555-555555555555";
const RUN_ID = "66666666-6666-4666-8666-666666666666";
const ASSISTANT_MESSAGE_ID = "77777777-7777-4777-8777-777777777777";

/**
 * 테스트용 노트 챗봇 이벤트 스트림을 생성합니다.
 *
 * @param events 순서대로 반환할 스트림 이벤트
 * @returns 노트 챗봇 이벤트 AsyncGenerator
 */
async function* createEventStream(
  events: NoteChatStreamEvent[],
): AsyncGenerator<NoteChatStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNoteChatStream", () => {
  it("스트림 이벤트를 상태에 순서대로 반영한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockReturnValue(
      createEventStream([
        {
          runId: RUN_ID,
          type: "start",
        },
        {
          delta: "첫 번째 ",
          type: "text-delta",
        },
        {
          delta: "답변",
          type: "text-delta",
        },
        {
          assistantMessageId: ASSISTANT_MESSAGE_ID,
          referencedNoteIds: [],
          runId: RUN_ID,
          type: "finish",
        },
      ]),
    );

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
        settings: SETTINGS,
      });
    });

    expect(streamNoteChatQuestion).toHaveBeenCalledWith(
      {
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
        settings: SETTINGS,
      },
      {
        signal: expect.any(AbortSignal),
      },
    );

    expect(result.current.content).toBe("첫 번째 답변");
    expect(result.current.runId).toBe(RUN_ID);
    expect(result.current.assistantMessageId).toBe(ASSISTANT_MESSAGE_ID);
    expect(result.current.referencedNoteIds).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("서버 오류 이벤트를 상태에 반영한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockReturnValue(
      createEventStream([
        {
          runId: RUN_ID,
          type: "start",
        },
        {
          message: "답변 생성에 실패했습니다.",
          runId: RUN_ID,
          type: "error",
        },
      ]),
    );

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
        settings: SETTINGS,
      });
    });

    expect(result.current.error).toBe("답변 생성에 실패했습니다.");
    expect(result.current.isStreaming).toBe(false);
  });

  it("클라이언트 요청 오류를 상태에 반영한다", async () => {
    vi.mocked(streamNoteChatQuestion).mockImplementation(
      async function* failedStream() {
        throw new Error("요청에 실패했습니다.");
      },
    );

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
        settings: SETTINGS,
      });
    });

    expect(result.current.error).toBe("요청에 실패했습니다.");
    expect(result.current.isStreaming).toBe(false);
  });

  it("cancel을 호출하면 진행 중인 요청을 취소한다", async () => {
    let receivedSignal: AbortSignal | undefined;

    vi.mocked(streamNoteChatQuestion).mockImplementation(
      (_input, options = {}) => {
        receivedSignal = options.signal;

        return createEventStream([]);
      },
    );

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      const startPromise = result.current.start({
        conversationId: CONVERSATION_ID,
        question: "질문입니다.",
        settings: SETTINGS,
      });

      result.current.cancel();

      await startPromise;
    });

    expect(receivedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it("새 요청을 시작하면 이전 실행 상태를 초기화한다", async () => {
    vi.mocked(streamNoteChatQuestion)
      .mockReturnValueOnce(
        createEventStream([
          {
            delta: "첫 번째 답변",
            type: "text-delta",
          },
          {
            assistantMessageId: ASSISTANT_MESSAGE_ID,
            referencedNoteIds: [],
            runId: RUN_ID,
            type: "finish",
          },
        ]),
      )
      .mockReturnValueOnce(createEventStream([]));

    const { result } = renderHook(() => useNoteChatStream());

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "첫 번째 질문",
        settings: SETTINGS,
      });
    });

    expect(result.current.content).toBe("첫 번째 답변");

    await act(async () => {
      await result.current.start({
        conversationId: CONVERSATION_ID,
        question: "두 번째 질문",
        settings: SETTINGS,
      });
    });

    await waitFor(() => {
      expect(result.current.content).toBe("");
    });

    expect(result.current.assistantMessageId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.runId).toBeNull();
  });
});
