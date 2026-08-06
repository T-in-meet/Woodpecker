import type { NoteChatRunSettings } from "../schema";
import type { NoteChatStreamEvent } from "./types";

/**
 * 새 질문 스트리밍 요청 입력입니다.
 */
export type StreamNoteChatQuestionInput = {
  conversationId: string;
  content: {
    text: string;
  };
  settings: NoteChatRunSettings;
};

/**
 * 노트 챗봇 스트림 요청 중 발생한 HTTP 오류입니다.
 */
export class NoteChatStreamRequestError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number) {
    super(message);

    this.name = "NoteChatStreamRequestError";
    this.status = status;
  }
}

/**
 * 노트 챗봇 질문을 전송하고 NDJSON 스트림 이벤트를 순서대로 반환합니다.
 *
 * 응답 본문을 청크 단위로 읽고 줄바꿈을 기준으로 분리합니다.
 * 하나의 JSON 이벤트가 여러 네트워크 청크에 나뉘어 들어오는 경우를 위해
 * 아직 완성되지 않은 마지막 줄은 다음 청크까지 버퍼에 유지합니다.
 *
 * @param input 질문과 실행 설정
 * @param options 요청 취소에 사용할 AbortSignal
 * @returns 서버가 전달하는 노트 챗봇 이벤트 스트림
 */
export async function* streamNoteChatQuestion(
  input: StreamNoteChatQuestionInput,
  options: {
    signal?: AbortSignal | undefined;
  } = {},
): AsyncGenerator<NoteChatStreamEvent> {
  const response = await fetch("/api/note-chats/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    ...(options.signal !== undefined
      ? {
          signal: options.signal,
        }
      : {}),
  });

  if (!response.ok) {
    const message = await readStreamErrorMessage(response);

    throw new NoteChatStreamRequestError(message, response.status);
  }

  if (!response.body) {
    throw new Error("노트 챗봇 스트림 응답 본문이 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      /*
       * 마지막 항목은 아직 줄바꿈이 도착하지 않은 불완전한 JSON일 수 있으므로
       * 다음 네트워크 청크까지 버퍼에 유지합니다.
       */
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseNoteChatStreamLine(line);

        if (event) {
          yield event;
        }
      }
    }

    buffer += decoder.decode();

    const finalEvent = parseNoteChatStreamLine(buffer);

    if (finalEvent) {
      yield finalEvent;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * NDJSON 한 줄을 노트 챗봇 스트림 이벤트로 변환합니다.
 *
 * 빈 줄은 무시합니다.
 *
 * @param line NDJSON 한 줄
 * @returns 파싱된 이벤트 또는 빈 줄인 경우 null
 */
function parseNoteChatStreamLine(line: string): NoteChatStreamEvent | null {
  const trimmedLine = line.trim();

  if (trimmedLine.length === 0) {
    return null;
  }

  return JSON.parse(trimmedLine) as NoteChatStreamEvent;
}

/**
 * 실패 응답에서 사용자에게 표시할 오류 메시지를 추출합니다.
 *
 * @param response 실패한 HTTP 응답
 * @returns 서버 오류 메시지
 */
async function readStreamErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
    };

    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // JSON 응답이 아니면 상태 코드 기반 기본 메시지를 사용합니다.
  }

  return `노트 챗봇 요청에 실패했습니다. (${response.status})`;
}
