import { describe, expect, it, vi } from "vitest";

import type {
  AiChatStreamEvent,
  AiChatStreamResult,
} from "@/features/ai/providers/types";

import { consumeNoteChatProviderStream } from "../consume-provider-stream";

/**
 * 테스트용 Provider 스트림을 생성합니다.
 *
 * @param events 스트림에서 순서대로 반환할 Provider 이벤트
 * @returns Provider 공통 AsyncGenerator
 */
async function* createProviderStream(
  events: AiChatStreamEvent[],
): AsyncGenerator<AiChatStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

const FINISH_RESULT: AiChatStreamResult = {
  content: "첫 번째 두 번째",
  metadata: {
    provider: "openai",
  },
  usage: {
    inputTokens: 5,
    outputTokens: 3,
    totalTokens: 8,
  },
};

describe("consumeNoteChatProviderStream", () => {
  it("Provider 텍스트 조각을 수신 순서대로 전달한다", async () => {
    const onTextDelta = vi.fn();

    const result = await consumeNoteChatProviderStream(
      createProviderStream([
        {
          delta: "첫 번째 ",
          type: "text-delta",
        },
        {
          delta: "두 번째",
          type: "text-delta",
        },
        {
          result: FINISH_RESULT,
          type: "finish",
        },
      ]),
      onTextDelta,
    );

    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      delta: "첫 번째 ",
      type: "text-delta",
    });

    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      delta: "두 번째",
      type: "text-delta",
    });

    expect(result).toEqual({
      content: "첫 번째 두 번째",
      result: FINISH_RESULT,
    });
  });

  it("비동기 text-delta 처리 함수가 끝날 때까지 기다린다", async () => {
    const handledDeltas: string[] = [];

    await consumeNoteChatProviderStream(
      createProviderStream([
        {
          delta: "첫 번째",
          type: "text-delta",
        },
        {
          result: {
            ...FINISH_RESULT,
            content: "첫 번째",
          },
          type: "finish",
        },
      ]),
      async (event) => {
        await Promise.resolve();
        handledDeltas.push(event.delta);
      },
    );

    expect(handledDeltas).toEqual(["첫 번째"]);
  });

  it("텍스트 조각 없이 finish 이벤트만 있으면 빈 결과를 반환한다", async () => {
    const emptyResult: AiChatStreamResult = {
      content: "",
      metadata: {},
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    };

    const onTextDelta = vi.fn();

    const result = await consumeNoteChatProviderStream(
      createProviderStream([
        {
          result: emptyResult,
          type: "finish",
        },
      ]),
      onTextDelta,
    );

    expect(onTextDelta).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: "",
      result: emptyResult,
    });
  });

  it("finish 이벤트 없이 스트림이 종료되면 오류를 발생시킨다", async () => {
    await expect(
      consumeNoteChatProviderStream(
        createProviderStream([
          {
            delta: "완료되지 않은 답변",
            type: "text-delta",
          },
        ]),
        vi.fn(),
      ),
    ).rejects.toThrow("AI Provider stream completed without a finish event.");
  });

  it("Provider 최종 content와 누적 delta가 다르면 오류를 발생시킨다", async () => {
    await expect(
      consumeNoteChatProviderStream(
        createProviderStream([
          {
            delta: "실제 전달된 답변",
            type: "text-delta",
          },
          {
            result: {
              ...FINISH_RESULT,
              content: "다른 최종 답변",
            },
            type: "finish",
          },
        ]),
        vi.fn(),
      ),
    ).rejects.toThrow(
      "AI Provider stream content does not match accumulated text deltas.",
    );
  });

  it("text-delta 처리 함수 오류를 호출자에게 전달한다", async () => {
    await expect(
      consumeNoteChatProviderStream(
        createProviderStream([
          {
            delta: "답변",
            type: "text-delta",
          },
          {
            result: {
              ...FINISH_RESULT,
              content: "답변",
            },
            type: "finish",
          },
        ]),
        () => {
          throw new Error("Stream enqueue failed");
        },
      ),
    ).rejects.toThrow("Stream enqueue failed");
  });

  it("Provider 스트림 자체의 오류를 호출자에게 전달한다", async () => {
    async function* createFailedProviderStream(): AsyncGenerator<AiChatStreamEvent> {
      yield {
        delta: "일부 답변",
        type: "text-delta",
      };

      throw new Error("Provider stream failed");
    }

    await expect(
      consumeNoteChatProviderStream(createFailedProviderStream(), vi.fn()),
    ).rejects.toThrow("Provider stream failed");
  });
});
