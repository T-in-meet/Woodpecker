import { describe, expect, it } from "vitest";

import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";

import { buildRelatedNoteContext } from "../build-related-note-context";

const notes: MatchedNote[] = [
  {
    chunkText: "첫 번째 노트 chunk",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.9,
    title: "첫 번째 노트",
  },
  {
    chunkText: "두 번째 노트 chunk",
    distance: 0.2,
    embeddingId: "embedding-2",
    id: "22222222-2222-4222-8222-222222222222",
    similarity: 0.8,
    title: "두 번째 노트",
  },
];

describe("buildRelatedNoteContext", () => {
  it("Note ID와 chunk snapshot을 Related Notes Context로 구성한다", () => {
    const result = buildRelatedNoteContext({ notes });

    expect(result).toBe(
      [
        "<note>",
        "<note_id>11111111-1111-4111-8111-111111111111</note_id>",
        "<chunk>첫 번째 노트 chunk</chunk>",
        "</note>",
        "",
        "<note>",
        "<note_id>22222222-2222-4222-8222-222222222222</note_id>",
        "<chunk>두 번째 노트 chunk</chunk>",
        "</note>",
      ].join("\n"),
    );
  });

  it("검색된 Note가 없으면 빈 Context를 반환한다", () => {
    expect(buildRelatedNoteContext({ notes: [] })).toBe("");
  });
});
