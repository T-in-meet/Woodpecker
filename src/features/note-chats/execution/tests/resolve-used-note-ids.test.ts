import { describe, expect, it } from "vitest";

import { resolveNoteChatUsedNoteIds } from "../resolve-used-note-ids";

describe("resolveNoteChatUsedNoteIds", () => {
  it("Context index를 실제 Note ID 목록으로 변환한다", () => {
    const sources = [
      {
        contextIndex: 1,
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        type: "note",
      },
      {
        contextIndex: 2,
        noteId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        type: "note",
      },
    ];

    const result = resolveNoteChatUsedNoteIds([2, 1], sources);

    expect(result).toEqual([
      "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      "550e8400-e29b-41d4-a716-446655440000",
    ]);
  });

  it("사용된 Context index가 중복되면 해당 Note ID도 중복해서 반환한다", () => {
    const sources = [
      {
        contextIndex: 1,
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        type: "note",
      },
    ];

    const result = resolveNoteChatUsedNoteIds([1, 1], sources);

    expect(result).toEqual([
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440000",
    ]);
  });

  it("존재하지 않는 Context index가 반환되면 오류를 발생시킨다", () => {
    const sources = [
      {
        contextIndex: 1,
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        type: "note",
      },
    ];

    expect(() => resolveNoteChatUsedNoteIds([2], sources)).toThrow(
      "Note chat used context index not found: 2",
    );
  });
});
