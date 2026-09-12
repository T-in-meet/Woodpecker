import { describe, expect, it, vi } from "vitest";

import {
  NoteChatStreamRequestError,
  streamNoteChatQuestion,
  streamNoteChatUserMessageUpdate,
} from "../client";

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
    },
  });
}

describe("streamNoteChatQuestion", () => {
  it("새 질문을 올바른 URL과 Body로 요청한다", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        createStreamResponse([
          '{"type":"start","userMessageId":"message-1"}\n',
        ]),
      );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: {
        text: "질문입니다.",
      },
    });

    const events = [];

    for await (const event of stream) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/note-chats/stream",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            text: "질문입니다.",
          },
          conversationId: "conversation-1",
        }),
      }),
    );

    expect(events).toEqual([
      {
        type: "start",
        userMessageId: "message-1",
      },
    ]);
  });

  it("NDJSON 스트림을 이벤트 순서대로 변환한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse([
        '{"type":"start","userMessageId":"message-1"}\n{"type":"text-delta","delta":"안녕',
        '하세요."}\n{"type":"finish","assistantMessageId":"assistant-1","usedNoteIds":[]}\n',
      ]),
    );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: {
        text: "질문입니다.",
      },
    });

    const events = [];

    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "start",
        userMessageId: "message-1",
      },
      {
        type: "text-delta",
        delta: "안녕하세요.",
      },
      {
        assistantMessageId: "assistant-1",
        type: "finish",
        usedNoteIds: [],
      },
    ]);
  });

  it("스트림 응답 본문이 없으면 오류를 발생시킨다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: {
        text: "질문입니다.",
      },
    });

    await expect(
      (async () => {
        for await (const _event of stream) {
          // 스트림 실행
        }
      })(),
    ).rejects.toThrow("노트 챗봇 스트림 응답 본문이 없습니다.");
  });
});

describe("streamNoteChatUserMessageUpdate", () => {
  it("기존 사용자 메시지를 올바른 URL과 Body로 요청한다", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        createStreamResponse([
          '{"type":"start","userMessageId":"message-1"}\n',
        ]),
      );

    const stream = streamNoteChatUserMessageUpdate({
      messageId: "message-1",
      content: {
        text: "수정된 질문입니다.",
      },
    });

    for await (const _event of stream) {
      // 스트림 실행
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/note-chats/messages/message-1/stream",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            text: "수정된 질문입니다.",
          },
        }),
      }),
    );
  });
});

describe("NoteChatStreamRequestError", () => {
  it("요청 오류의 message, status, code를 보존한다", () => {
    const error = new NoteChatStreamRequestError(
      "요청에 실패했습니다.",
      429,
      "NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NoteChatStreamRequestError);
    expect(error.name).toBe("NoteChatStreamRequestError");
    expect(error.message).toBe("요청에 실패했습니다.");
    expect(error.status).toBe(429);
    expect(error.code).toBe("NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED");
    expect(error.redirectTo).toBeNull();
  });
});

describe("streamNoteChatRequest", () => {
  it("HTTP 오류 응답의 JSON message와 code를 요청 오류에 보존한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "오늘의 실행 제한을 초과했습니다.",
          code: "NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: {
        text: "질문입니다.",
      },
    });

    await expect(
      (async () => {
        for await (const _event of stream) {
          // 스트림 실행
        }
      })(),
    ).rejects.toMatchObject({
      name: "NoteChatStreamRequestError",
      message: "오늘의 실행 제한을 초과했습니다.",
      status: 429,
      code: "NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED",
    });
  });

  it("법적 문서 확인 403 응답의 redirectTo를 요청 오류에 보존한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "legal_acceptance_required",
          redirectTo: "/agreements?redirect=%2Fnote-chats",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: { text: "질문입니다." },
    });

    await expect(
      (async () => {
        for await (const _event of stream) {
          // 스트림 실행
        }
      })(),
    ).rejects.toMatchObject({
      name: "NoteChatStreamRequestError",
      redirectTo: "/agreements?redirect=%2Fnote-chats",
      status: 403,
    });
  });

  it("HTTP 오류 응답이 JSON이 아니면 기본 오류 메시지를 사용한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
      }),
    );

    const stream = streamNoteChatQuestion({
      conversationId: "conversation-1",
      content: {
        text: "질문입니다.",
      },
    });

    await expect(
      (async () => {
        for await (const _event of stream) {
          // 스트림 실행
        }
      })(),
    ).rejects.toMatchObject({
      name: "NoteChatStreamRequestError",
      message: "노트 챗봇 요청에 실패했습니다. (500)",
      status: 500,
      code: null,
    });
  });
});
