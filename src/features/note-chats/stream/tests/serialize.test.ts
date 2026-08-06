import { describe, expect, it } from "vitest";

import { encodeNoteChatStreamEvent } from "../serialize";
import type { NoteChatStreamEvent } from "../types";

const textDecoder = new TextDecoder();

/**
 * 직렬화된 스트림 데이터를 테스트용 문자열로 변환합니다.
 *
 * @param value UTF-8로 인코딩된 스트림 데이터
 * @returns 디코딩된 문자열
 */
function decodeStreamEvent(value: Uint8Array): string {
  return textDecoder.decode(value);
}

describe("encodeNoteChatStreamEvent", () => {
  it.each<NoteChatStreamEvent>([
    {
      runId: "11111111-1111-4111-8111-111111111111",
      type: "start",
    },
    {
      delta: "생성된 텍스트",
      type: "text-delta",
    },
    {
      assistantMessageId: "22222222-2222-4222-8222-222222222222",
      referencedNoteRanks: [1, 3],
      runId: "11111111-1111-4111-8111-111111111111",
      type: "finish",
    },
    {
      message: "답변 생성에 실패했습니다.",
      runId: "11111111-1111-4111-8111-111111111111",
      type: "error",
    },
  ])("$type 이벤트를 NDJSON 한 줄로 직렬화한다", (event) => {
    const result = decodeStreamEvent(encodeNoteChatStreamEvent(event));

    expect(result).toBe(`${JSON.stringify(event)}\n`);
  });

  it("한글과 줄바꿈이 포함된 텍스트를 UTF-8로 보존한다", () => {
    const event: NoteChatStreamEvent = {
      delta: "첫 번째 줄\n두 번째 줄",
      type: "text-delta",
    };

    const result = decodeStreamEvent(encodeNoteChatStreamEvent(event));

    expect(JSON.parse(result.trim())).toEqual(event);
  });
});
