import { describe, expect, it } from "vitest";

import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";

import { buildNoteChatSources } from "../build-note-sources";

describe("buildNoteChatSources", () => {
  it("검색된 Note chunk를 Note Source Snapshot으로 변환한다", () => {
    const notes: MatchedNote[] = [
      {
        chunkText:
          "Title:\n다익스트라 알고리즘\n\nContent:\n음수 가중치를 처리할 수 없다.",
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
        content:
          "Title:\n다익스트라 알고리즘\n\nContent:\n음수 가중치를 처리할 수 없다.",
        distance: 0.05,
        embeddingId: "embedding-1",
        noteId: "11111111-1111-4111-8111-111111111111",
        similarity: 0.95,
        title: "다익스트라 알고리즘",
        type: "note",
      },
    ]);
  });

  it("여러 Note chunk의 Context Index를 1부터 검색 순서대로 부여한다", () => {
    const notes: MatchedNote[] = [
      {
        chunkText: "Title:\n첫 번째 노트\n\nContent:\n첫 번째 chunk",
        distance: 0.1,
        embeddingId: "embedding-1",
        id: "11111111-1111-4111-8111-111111111111",
        similarity: 0.9,
        title: "첫 번째 노트",
      },
      {
        chunkText: "Title:\n두 번째 노트\n\nContent:\n두 번째 chunk",
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
        content: "Title:\n첫 번째 노트\n\nContent:\n첫 번째 chunk",
        distance: 0.1,
        embeddingId: "embedding-1",
        noteId: "11111111-1111-4111-8111-111111111111",
        similarity: 0.9,
        title: "첫 번째 노트",
        type: "note",
      },
      {
        contextIndex: 2,
        content: "Title:\n두 번째 노트\n\nContent:\n두 번째 chunk",
        distance: 0.2,
        embeddingId: "embedding-2",
        noteId: "22222222-2222-4222-8222-222222222222",
        similarity: 0.8,
        title: "두 번째 노트",
        type: "note",
      },
    ]);
  });

  it("같은 Note의 여러 chunk도 각각 별도 Source로 유지한다", () => {
    const noteId = "11111111-1111-4111-8111-111111111111";

    const notes: MatchedNote[] = [
      {
        chunkText: "Title:\n테스트 노트\n\nContent:\nchunk 0",
        distance: 0.1,
        embeddingId: "embedding-1",
        id: noteId,
        similarity: 0.9,
        title: "테스트 노트",
      },
      {
        chunkText: "Title:\n테스트 노트\n\nContent:\nchunk 1",
        distance: 0.2,
        embeddingId: "embedding-2",
        id: noteId,
        similarity: 0.8,
        title: "테스트 노트",
      },
    ];

    expect(buildNoteChatSources(notes)).toEqual([
      expect.objectContaining({
        contextIndex: 1,
        content: "Title:\n테스트 노트\n\nContent:\nchunk 0",
        embeddingId: "embedding-1",
        noteId,
      }),
      expect.objectContaining({
        contextIndex: 2,
        content: "Title:\n테스트 노트\n\nContent:\nchunk 1",
        embeddingId: "embedding-2",
        noteId,
      }),
    ]);
  });

  it("검색된 Note chunk가 없으면 빈 배열을 반환한다", () => {
    expect(buildNoteChatSources([])).toEqual([]);
  });
});
