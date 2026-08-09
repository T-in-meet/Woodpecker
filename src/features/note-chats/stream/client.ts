import type { NoteChatStreamEvent } from "./types";

export type StreamNoteChatQuestionInput = {
  conversationId: string;
  content: {
    text: string;
  };
};

export type StreamNoteChatUserMessageUpdateInput = {
  messageId: string;
  content: {
    text: string;
  };
};

type StreamNoteChatOptions = {
  signal?: AbortSignal;
};

export class NoteChatStreamRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "NoteChatStreamRequestError";
    this.status = status;
  }
}

/**
 * 새 사용자 질문을 생성하고 AI 답변 스트림을 반환합니다.
 */
export function streamNoteChatQuestion(
  input: StreamNoteChatQuestionInput,
  options: StreamNoteChatOptions = {},
): AsyncGenerator<NoteChatStreamEvent> {
  return streamNoteChatRequest(
    "/api/note-chats/stream",
    {
      content: input.content,
      conversationId: input.conversationId,
    },
    options,
  );
}

/**
 * 기존 사용자 질문을 수정하고 새로운 AI 답변 스트림을 반환합니다.
 *
 * 수정 Route에서 대상 Message ID를 경로로 사용하므로,
 * request body에는 수정된 content만 전달합니다.
 */
export function streamNoteChatUserMessageUpdate(
  input: StreamNoteChatUserMessageUpdateInput,
  options: StreamNoteChatOptions = {},
): AsyncGenerator<NoteChatStreamEvent> {
  return streamNoteChatRequest(
    `/api/note-chats/messages/${input.messageId}/stream`,
    {
      content: input.content,
    },
    options,
  );
}

/**
 * 노트 챗봇 Route Handler에 POST 요청을 보내고
 * NDJSON 스트림을 NoteChatStreamEvent로 변환합니다.
 */
async function* streamNoteChatRequest(
  url: string,
  body: unknown,
  options: StreamNoteChatOptions,
): AsyncGenerator<NoteChatStreamEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw await createNoteChatStreamRequestError(response);
  }

  if (!response.body) {
    throw new Error("노트 챗봇 스트림 응답 본문이 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines = buffer.split("\n");

    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      yield parseNoteChatStreamEvent(trimmed);
    }
  }

  buffer += decoder.decode();

  const remaining = buffer.trim();

  if (remaining) {
    yield parseNoteChatStreamEvent(remaining);
  }
}

/**
 * NDJSON 한 줄을 노트 챗봇 스트림 이벤트로 변환합니다.
 */
function parseNoteChatStreamEvent(line: string): NoteChatStreamEvent {
  return JSON.parse(line) as NoteChatStreamEvent;
}

/**
 * 실패 HTTP 응답을 사용자 표시 가능한 요청 오류로 변환합니다.
 */
async function createNoteChatStreamRequestError(
  response: Response,
): Promise<NoteChatStreamRequestError> {
  let message = `노트 챗봇 요청에 실패했습니다. (${response.status})`;

  try {
    const body = (await response.json()) as {
      error?: unknown;
    };

    if (typeof body.error === "string" && body.error.length > 0) {
      message = body.error;
    }
  } catch {
    // JSON 오류 본문이 아니면 기본 메시지를 사용합니다.
  }

  return new NoteChatStreamRequestError(message, response.status);
}
