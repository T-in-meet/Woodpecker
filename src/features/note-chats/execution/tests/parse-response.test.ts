import { describe, expect, it } from "vitest";

import { parseNoteChatProviderResponse } from "../parse-response";

describe("parseNoteChatProviderResponse", () => {
  it("유효한 Provider 응답을 파싱한다", () => {
    const result = parseNoteChatProviderResponse(
      JSON.stringify({
        answer: "다익스트라 알고리즘은 음수 가중치를 처리할 수 없습니다.",
        usedContextIndexes: [1, 2],
      }),
    );

    expect(result).toEqual({
      answer: "다익스트라 알고리즘은 음수 가중치를 처리할 수 없습니다.",
      usedContextIndexes: [1, 2],
    });
  });

  it("중복된 Context index를 제거한다", () => {
    const result = parseNoteChatProviderResponse(
      JSON.stringify({
        answer: "답변입니다.",
        usedContextIndexes: [1, 2, 1, 3, 2],
      }),
    );

    expect(result).toEqual({
      answer: "답변입니다.",
      usedContextIndexes: [1, 2, 3],
    });
  });

  it("유효하지 않은 JSON이면 오류를 발생시킨다", () => {
    expect(() => parseNoteChatProviderResponse("invalid json")).toThrow(
      "Note chat provider response is not valid JSON.",
    );
  });

  it("응답 구조가 유효하지 않으면 오류를 발생시킨다", () => {
    expect(() =>
      parseNoteChatProviderResponse(
        JSON.stringify({
          answer: "",
          usedContextIndexes: ["1"],
        }),
      ),
    ).toThrow("Note chat provider response has an invalid structure.");
  });
});
