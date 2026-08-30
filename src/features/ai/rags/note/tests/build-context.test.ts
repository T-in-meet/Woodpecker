import { describe, expect, it } from "vitest";

import { buildNoteContext } from "../build-context";
import type { MatchedNote } from "../get-matched-notes";

describe("buildNoteContext", () => {
  it("검색된 chunk snapshot을 검색 순서대로 Context에 포함한다", () => {
    const notes: MatchedNote[] = [
      {
        chunkText:
          "Title:\n다익스트라 알고리즘\n\nContent:\n음수 가중치에서는 사용할 수 없다.",
        distance: 0.1,
        embeddingId: "11111111-1111-4111-8111-111111111111",
        id: "22222222-2222-4222-8222-222222222222",
        similarity: 0.9,
        title: "다익스트라 알고리즘",
      },
      {
        chunkText:
          "Title:\n벨만-포드 알고리즘\n\nContent:\n음수 가중치를 처리할 수 있다.",
        distance: 0.2,
        embeddingId: "33333333-3333-4333-8333-333333333333",
        id: "44444444-4444-4444-8444-444444444444",
        similarity: 0.8,
        title: "벨만-포드 알고리즘",
      },
    ];

    expect(buildNoteContext({ notes })).toBe(
      `<note>
<index>[1]</index>
<chunk>Title:
다익스트라 알고리즘

Content:
음수 가중치에서는 사용할 수 없다.</chunk>
</note>

<note>
<index>[2]</index>
<chunk>Title:
벨만-포드 알고리즘

Content:
음수 가중치를 처리할 수 있다.</chunk>
</note>`,
    );
  });

  it("같은 Note에서 검색된 여러 chunk도 각각 별도 Context로 유지한다", () => {
    const notes: MatchedNote[] = [
      {
        chunkText: "Title:\nTest Note\n\nContent:\nchunk 0",
        distance: 0.1,
        embeddingId: "11111111-1111-4111-8111-111111111111",
        id: "22222222-2222-4222-8222-222222222222",
        similarity: 0.9,
        title: "Test Note",
      },
      {
        chunkText: "Title:\nTest Note\n\nContent:\nchunk 1",
        distance: 0.2,
        embeddingId: "33333333-3333-4333-8333-333333333333",
        id: "22222222-2222-4222-8222-222222222222",
        similarity: 0.8,
        title: "Test Note",
      },
    ];

    const context = buildNoteContext({ notes });

    expect(context).toContain("<index>[1]</index>");
    expect(context).toContain("<index>[2]</index>");
    expect(context).toContain("Content:\nchunk 0");
    expect(context).toContain("Content:\nchunk 1");
  });

  it("검색 결과가 없으면 빈 Context를 반환한다", () => {
    expect(
      buildNoteContext({
        notes: [],
      }),
    ).toBe("");
  });

  it("검색 메타데이터는 Context에 포함하지 않는다", () => {
    const notes: MatchedNote[] = [
      {
        chunkText: "Title:\nTest Note\n\nContent:\n검색된 내용",
        distance: 0.123,
        embeddingId: "11111111-1111-4111-8111-111111111111",
        id: "22222222-2222-4222-8222-222222222222",
        similarity: 0.877,
        title: "Test Note",
      },
    ];

    const context = buildNoteContext({ notes });

    expect(context).not.toContain("0.123");
    expect(context).not.toContain("0.877");
    expect(context).not.toContain("11111111-1111-4111-8111-111111111111");
  });
});
