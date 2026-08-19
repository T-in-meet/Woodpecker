import { describe, expect, it } from "vitest";

import { encodeNoteChatStreamEvent } from "../serialize";
import type { NoteChatStreamEvent } from "../types";

describe("encodeNoteChatStreamEvent", () => {
  it("스트림 이벤트를 JSON 문자열과 줄바꿈으로 직렬화한다", () => {
    const event: NoteChatStreamEvent = {
      type: "text-delta",
      delta: "안녕하세요",
    };

    const result = new TextDecoder().decode(encodeNoteChatStreamEvent(event));

    expect(result).toBe(`${JSON.stringify(event)}\n`);
  });

  it("UTF-8 문자열을 올바르게 인코딩한다", () => {
    const event: NoteChatStreamEvent = {
      type: "text-delta",
      delta: "노트 챗봇 답변입니다.",
    };

    const encoded = encodeNoteChatStreamEvent(event);
    const decoded = new TextDecoder().decode(encoded);

    expect(decoded).toBe(`${JSON.stringify(event)}\n`);
  });

  it("JSON에 포함되는 특수 문자를 그대로 보존한다", () => {
    const event: NoteChatStreamEvent = {
      type: "text-delta",
      delta: '첫 번째 줄\n"인용"\\테스트',
    };

    const result = new TextDecoder().decode(encodeNoteChatStreamEvent(event));

    expect(result).toBe(`${JSON.stringify(event)}\n`);
    expect(JSON.parse(result)).toEqual(event);
  });

  it("항상 하나의 NDJSON 레코드에 해당하는 줄바꿈으로 끝난다", () => {
    const event: NoteChatStreamEvent = {
      type: "text-delta",
      delta: "",
    };

    const result = new TextDecoder().decode(encodeNoteChatStreamEvent(event));

    expect(result.endsWith("\n")).toBe(true);
    expect(result.split("\n")).toHaveLength(2);
    expect(result.split("\n")[1]).toBe("");
  });
});
