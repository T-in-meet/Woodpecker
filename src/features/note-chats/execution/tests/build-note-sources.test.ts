import { describe, expect, it } from "vitest";

import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";

import { buildNoteChatSources } from "../build-note-sources";

describe("buildNoteChatSources", () => {
  it("검색된 Note를 Note Source Snapshot으로 변환한다", () => {
    const notes: MatchedNote[] = [
      {
        content: "다익스트라 알고리즘은 음수 가중치를 처리할 수 없다.",
        distance: 0.05,
        embeddingId: "embedding-1",
        id: "11111111-1111-4111-8111-111111111111",
        similarity: 0.95,
        title: "다익스트라 알고리즘",
      },
    ];

    expect(buildNoteChatSources(notes)).toEqual([
      {
        contextIndex: 1,
        content: "다익스트라 알고리즘은 음수 가중치를 처리할 수 없다.",
        distance: 0.05,
        embeddingId: "embedding-1",
        noteId: "11111111-1111-4111-8111-111111111111",
        similarity: 0.95,
        title: "다익스트라 알고리즘",
        type: "note",
      },
    ]);
  });

  it("여러 Note의 Context Index를 1부터 검색 순서대로 부여한다", () => {
    const notes: MatchedNote[] = [
      {
        content: "첫 번째 내용",
        distance: 0.1,
        embeddingId: "embedding-1",
        id: "11111111-1111-4111-8111-111111111111",
        similarity: 0.9,
        title: "첫 번째 노트",
      },
      {
        content: "두 번째 내용",
        distance: 0.2,
        embeddingId: "embedding-2",
        id: "22222222-2222-4222-8222-222222222222",
        similarity: 0.8,
        title: "두 번째 노트",
      },
    ];

    expect(buildNoteChatSources(notes)).toEqual([
      {
        contextIndex: 1,
        content: "첫 번째 내용",
        distance: 0.1,
        embeddingId: "embedding-1",
        noteId: "11111111-1111-4111-8111-111111111111",
        similarity: 0.9,
        title: "첫 번째 노트",
        type: "note",
      },
      {
        contextIndex: 2,
        content: "두 번째 내용",
        distance: 0.2,
        embeddingId: "embedding-2",
        noteId: "22222222-2222-4222-8222-222222222222",
        similarity: 0.8,
        title: "두 번째 노트",
        type: "note",
      },
    ]);
  });

  it("검색된 Note가 없으면 빈 배열을 반환한다", () => {
    expect(buildNoteChatSources([])).toEqual([]);
  });
});
