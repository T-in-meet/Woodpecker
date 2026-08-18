import { describe, expect, it, vi } from "vitest";

import type {
  AiChatStreamEvent,
  AiChatStreamResult,
} from "@/features/ai/providers/types";

import { consumeNoteChatProviderStream } from "../consume-provider-stream";

function createProviderStream(
  events: AiChatStreamEvent[],
): AsyncGenerator<AiChatStreamEvent> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function createResult(content: string): AiChatStreamResult {
  return {
    content,
  } as AiChatStreamResult;
}

describe("consumeNoteChatProviderStream", () => {
  it("Provider의 JSON 응답에서 answer만 추출하여 text-delta로 전달한다", async () => {
    const result = createResult(
      '{"answer":"안녕하세요.","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"안녕',
      },
      {
        type: "text-delta",
        delta: '하세요.","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    const consumed = await consumeNoteChatProviderStream(
      providerStream,
      onTextDelta,
    );

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "안녕",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: "하세요.",
    });

    expect(consumed).toEqual({
      content: '{"answer":"안녕하세요.","usedContextIndexes":[]}',
      result,
    });
  });

  it("answer key가 Provider delta 경계에서 끊겨도 이어서 파싱한다", async () => {
    const result = createResult('{"answer":"답변","usedContextIndexes":[]}');

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"ans',
      },
      {
        type: "text-delta",
        delta: 'wer":"답변","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(1);
    expect(onTextDelta).toHaveBeenCalledWith({
      type: "text-delta",
      delta: "답변",
    });
  });

  it("answer key 뒤의 공백과 콜론이 delta 경계에서 끊겨도 이어서 파싱한다", async () => {
    const result = createResult(
      '{"answer" : "공백 포함 답변","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer" ',
      },
      {
        type: "text-delta",
        delta: ": ",
      },
      {
        type: "text-delta",
        delta: '"공백 포함 ',
      },
      {
        type: "text-delta",
        delta: '답변","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "공백 포함 ",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: "답변",
    });
  });

  it("JSON escape sequence가 delta 경계에서 끊겨도 다음 delta에서 이어서 처리한다", async () => {
    const result = createResult(
      '{"answer":"첫 줄\\n두 번째 줄","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"첫 줄\\',
      },
      {
        type: "text-delta",
        delta: 'n두 번째 줄","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "첫 줄",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: "\n두 번째 줄",
    });
  });

  it("escaped quote가 delta 경계에서 끊겨도 다음 delta에서 이어서 처리한다", async () => {
    const result = createResult(
      '{"answer":"그는 \\"안녕\\"이라고 말했다.","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"그는 \\',
      },
      {
        type: "text-delta",
        delta: '"안녕\\',
      },
      {
        type: "text-delta",
        delta: '"이라고 말했다.","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(3);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "그는 ",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: '"안녕',
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(3, {
      type: "text-delta",
      delta: '"이라고 말했다.',
    });
  });

  it("escaped backslash가 delta 경계에서 끊겨도 다음 delta에서 이어서 처리한다", async () => {
    const result = createResult(
      '{"answer":"C:\\\\temp","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"C:\\',
      },
      {
        type: "text-delta",
        delta: '\\temp","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "C:",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: "\\temp",
    });
  });

  it("\\uXXXX escape가 delta 경계에서 끊겨도 네 자리 hex가 모두 도착한 뒤 처리한다", async () => {
    const result = createResult(
      '{"answer":"한글: \\uAC00","usedContextIndexes":[]}',
    );

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"한글: \\uA',
      },
      {
        type: "text-delta",
        delta: "C",
      },
      {
        type: "text-delta",
        delta: '00","usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, {
      type: "text-delta",
      delta: "한글: ",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(2, {
      type: "text-delta",
      delta: "가",
    });
  });

  it("answer가 끝난 뒤의 JSON 필드는 text-delta로 전달하지 않는다", async () => {
    const result = createResult('{"answer":"답변","usedContextIndexes":[1,2]}');

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"답변"',
      },
      {
        type: "text-delta",
        delta: ',"usedContextIndexes":[1',
      },
      {
        type: "text-delta",
        delta: ",2]}",
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(onTextDelta).toHaveBeenCalledTimes(1);
    expect(onTextDelta).toHaveBeenCalledWith({
      type: "text-delta",
      delta: "답변",
    });
  });

  it("빈 answer는 text-delta를 전달하지 않는다", async () => {
    const result = createResult('{"answer":"","usedContextIndexes":[]}');

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":""',
      },
      {
        type: "text-delta",
        delta: ',"usedContextIndexes":[]}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn();

    const consumed = await consumeNoteChatProviderStream(
      providerStream,
      onTextDelta,
    );

    expect(onTextDelta).not.toHaveBeenCalled();
    expect(consumed).toEqual({
      content: '{"answer":"","usedContextIndexes":[]}',
      result,
    });
  });

  it("finish 이벤트가 없으면 오류를 발생시킨다", async () => {
    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"답변"}',
      },
    ]);

    const onTextDelta = vi.fn();

    await expect(
      consumeNoteChatProviderStream(providerStream, onTextDelta),
    ).rejects.toThrow("AI Provider stream completed without a finish event.");
  });

  it("최종 Provider 결과와 누적된 text-delta가 다르면 오류를 발생시킨다", async () => {
    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"답변"}',
      },
      {
        type: "finish",
        result: createResult('{"answer":"다른 답변"}'),
      },
    ]);

    const onTextDelta = vi.fn();

    await expect(
      consumeNoteChatProviderStream(providerStream, onTextDelta),
    ).rejects.toThrow(
      "AI Provider stream content does not match accumulated text deltas.",
    );
  });

  it("onTextDelta의 비동기 처리가 완료된 후 다음 이벤트를 처리한다", async () => {
    const result = createResult('{"answer":"첫 번째두 번째"}');

    const calls: string[] = [];

    const providerStream = createProviderStream([
      {
        type: "text-delta",
        delta: '{"answer":"첫 번째',
      },
      {
        type: "text-delta",
        delta: '두 번째"}',
      },
      {
        type: "finish",
        result,
      },
    ]);

    const onTextDelta = vi.fn(async (event) => {
      calls.push(`start:${event.delta}`);

      await Promise.resolve();

      calls.push(`end:${event.delta}`);
    });

    await consumeNoteChatProviderStream(providerStream, onTextDelta);

    expect(calls).toEqual([
      "start:첫 번째",
      "end:첫 번째",
      "start:두 번째",
      "end:두 번째",
    ]);
  });
});
