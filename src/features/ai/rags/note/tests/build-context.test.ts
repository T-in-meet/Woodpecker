import { describe, expect, it } from "vitest";

import { buildNoteContext } from "../build-context";
import type { MatchedNote } from "../get-matched-notes";

describe("buildNoteContext", () => {
  it("검색된 Note의 제목과 본문으로 Context를 구성한다", () => {
    const notes: MatchedNote[] = [
      {
        id: "note-1",
        title: "다익스트라 알고리즘",
        content: "다익스트라 알고리즘은 음수 가중치를 처리할 수 없다.",
        distance: 0.05,
        embeddingId: "embedding-1",
        similarity: 0.95,
      },
    ];

    expect(buildNoteContext({ notes })).toBe(
      "<note>\n<title>다익스트라 알고리즘</title>\n<content>다익스트라 알고리즘은 음수 가중치를 처리할 수 없다.</content>\n</note>",
    );
  });

  it("여러 Note를 빈 줄로 구분한다", () => {
    const notes: MatchedNote[] = [
      {
        id: "note-1",
        title: "첫 번째 노트",
        content: "첫 번째 내용",
        distance: 0.1,
        embeddingId: "embedding-1",
        similarity: 0.9,
      },
      {
        id: "note-2",
        title: "두 번째 노트",
        content: "두 번째 내용",
        distance: 0.2,
        embeddingId: "embedding-2",
        similarity: 0.8,
      },
    ];

    expect(buildNoteContext({ notes })).toBe(
      "<note>\n<title>첫 번째 노트</title>\n<content>첫 번째 내용</content>\n</note>\n\n<note>\n<title>두 번째 노트</title>\n<content>두 번째 내용</content>\n</note>",
    );
  });

  it("검색 결과의 메타데이터를 Context에 포함하지 않는다", () => {
    const notes: MatchedNote[] = [
      {
        id: "note-1",
        title: "테스트 노트",
        content: "테스트 내용",
        distance: 0.05,
        embeddingId: "embedding-1",
        similarity: 0.95,
      },
    ];

    const context = buildNoteContext({ notes });

    expect(context).not.toContain("note-1");
    expect(context).not.toContain("embedding-1");
    expect(context).not.toContain("0.05");
    expect(context).not.toContain("0.95");
  });

  it("검색된 Note가 없으면 빈 문자열을 반환한다", () => {
    expect(buildNoteContext({ notes: [] })).toBe("");
  });
});
