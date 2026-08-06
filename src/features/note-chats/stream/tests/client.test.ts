import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteChatRunSettings } from "../../schema";
import { NoteChatStreamRequestError, streamNoteChatQuestion } from "../client";
import type { NoteChatStreamEvent } from "../types";

const SETTINGS: NoteChatRunSettings = {
  agentId: "11111111-1111-4111-8111-111111111111",
  promptVersionId: "22222222-2222-4222-8222-222222222222",
  chatModelConfigId: "33333333-3333-4333-8333-333333333333",
  embeddingModelConfigId: "44444444-4444-4444-8444-444444444444",
};

const INPUT = {
  conversationId: "55555555-5555-4555-8555-555555555555",
  content: {
    text: "질문입니다.",
  },
  settings: SETTINGS,
};

/**
 * 여러 문자열 청크를 순서대로 반환하는 응답 Stream을 생성합니다.
 *
 * @param chunks 네트워크에서 수신할 문자열 청크
 * @returns 테스트용 ReadableStream
 */
function createTextStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

/**
 * AsyncGenerator가 반환하는 이벤트를 배열로 수집합니다.
 *
 * @param stream 수집할 노트 챗봇 스트림
 * @returns 순서대로 수집한 이벤트
 */
async function collectEvents(
  stream: AsyncGenerator<NoteChatStreamEvent>,
): Promise<NoteChatStreamEvent[]> {
  const events: NoteChatStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamNoteChatQuestion", () => {
  it("질문 입력을 Route Handler에 POST로 전달한다", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        createTextStream([
          '{"runId":"66666666-6666-4666-8666-666666666666","type":"start"}\n',
        ]),
        {
          status: 200,
        },
      ),
    );

    await collectEvents(streamNoteChatQuestion(INPUT));

    expect(fetchMock).toHaveBeenCalledWith("/api/note-chats/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(INPUT),
    });
  });

  it("NDJSON 이벤트를 수신 순서대로 반환한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        createTextStream([
          '{"runId":"66666666-6666-4666-8666-666666666666","type":"start"}\n',
          '{"delta":"첫 번째 ","type":"text-delta"}\n',
          '{"delta":"답변","type":"text-delta"}\n',
          '{"assistantMessageId":"77777777-7777-4777-8777-777777777777","referencedNoteIds":[],"runId":"66666666-6666-4666-8666-666666666666","type":"finish"}\n',
        ]),
        {
          status: 200,
        },
      ),
    );

    const events = await collectEvents(streamNoteChatQuestion(INPUT));

    expect(events).toEqual([
      {
        runId: "66666666-6666-4666-8666-666666666666",
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
        assistantMessageId: "77777777-7777-4777-8777-777777777777",
        referencedNoteIds: [],
        runId: "66666666-6666-4666-8666-666666666666",
        type: "finish",
      },
    ]);
  });

  it("하나의 JSON 이벤트가 여러 청크로 나뉘어도 파싱한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        createTextStream(['{"delta":"나뉜 ', '응답","type":"text-delta"}\n']),
        {
          status: 200,
        },
      ),
    );

    const events = await collectEvents(streamNoteChatQuestion(INPUT));

    expect(events).toEqual([
      {
        delta: "나뉜 응답",
        type: "text-delta",
      },
    ]);
  });

  it("마지막 줄에 줄바꿈이 없어도 이벤트를 반환한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        createTextStream(['{"delta":"마지막 응답","type":"text-delta"}']),
        {
          status: 200,
        },
      ),
    );

    const events = await collectEvents(streamNoteChatQuestion(INPUT));

    expect(events).toEqual([
      {
        delta: "마지막 응답",
        type: "text-delta",
      },
    ]);
  });

  it("빈 줄은 무시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        createTextStream([
          "\n",
          '{"delta":"응답","type":"text-delta"}\n',
          "\n",
        ]),
        {
          status: 200,
        },
      ),
    );

    const events = await collectEvents(streamNoteChatQuestion(INPUT));

    expect(events).toEqual([
      {
        delta: "응답",
        type: "text-delta",
      },
    ]);
  });

  it("서버 오류 메시지와 상태 코드를 포함한 오류를 발생시킨다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      ),
    );

    const promise = collectEvents(streamNoteChatQuestion(INPUT));

    await expect(promise).rejects.toMatchObject({
      message: "로그인이 필요합니다.",
      name: "NoteChatStreamRequestError",
      status: 401,
    } satisfies Partial<NoteChatStreamRequestError>);
  });

  it("실패 응답이 JSON이 아니면 기본 오류 메시지를 사용한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    await expect(collectEvents(streamNoteChatQuestion(INPUT))).rejects.toThrow(
      "노트 챗봇 요청에 실패했습니다. (500)",
    );
  });

  it("응답 본문이 없으면 오류를 발생시킨다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(collectEvents(streamNoteChatQuestion(INPUT))).rejects.toThrow(
      "노트 챗봇 스트림 응답 본문이 없습니다.",
    );
  });

  it("AbortSignal을 fetch에 전달한다", async () => {
    const controller = new AbortController();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(createTextStream([]), {
        status: 200,
      }),
    );

    await collectEvents(
      streamNoteChatQuestion(INPUT, {
        signal: controller.signal,
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/note-chats/stream",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});
