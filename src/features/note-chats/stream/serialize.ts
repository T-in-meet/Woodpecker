import type { NoteChatStreamEvent } from "./types";

const textEncoder = new TextEncoder();

/**
 * 노트 챗봇 스트림 이벤트를 NDJSON 한 줄로 직렬화합니다.
 *
 * 각 이벤트는 JSON 문자열 뒤에 줄바꿈 문자를 붙여 반환하므로,
 * 클라이언트는 ReadableStream을 줄 단위로 분리하여 처리할 수 있습니다.
 *
 * @param event 직렬화할 노트 챗봇 스트림 이벤트
 * @returns UTF-8로 인코딩된 NDJSON 데이터
 */
export function encodeNoteChatStreamEvent(
  event: NoteChatStreamEvent,
): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(event)}\n`);
}
