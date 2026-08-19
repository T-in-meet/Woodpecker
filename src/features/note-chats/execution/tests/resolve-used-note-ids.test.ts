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

  it("같은 Context index가 중복되어도 해당 Note ID는 한 번만 반환한다", () => {
    const sources = [
      {
        contextIndex: 1,
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        type: "note",
      },
    ];

    const result = resolveNoteChatUsedNoteIds([1, 1], sources);

    expect(result).toEqual(["550e8400-e29b-41d4-a716-446655440000"]);
  });

  it("서로 다른 chunk Context가 같은 Note를 가리키면 Note ID는 한 번만 반환한다", () => {
    const noteId = "550e8400-e29b-41d4-a716-446655440000";

    const sources = [
      {
        contextIndex: 1,
        noteId,
        type: "note",
      },
      {
        contextIndex: 2,
        noteId,
        type: "note",
      },
      {
        contextIndex: 3,
        noteId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        type: "note",
      },
    ];

    const result = resolveNoteChatUsedNoteIds([1, 2, 3], sources);

    expect(result).toEqual([noteId, "6ba7b810-9dad-41d1-80b4-00c04fd430c8"]);
  });

  it("중복 제거 후에도 LLM이 반환한 Context 순서 기준으로 Note 순서를 유지한다", () => {
    const noteAId = "550e8400-e29b-41d4-a716-446655440000";
    const noteBId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

    const sources = [
      {
        contextIndex: 1,
        noteId: noteAId,
        type: "note",
      },
      {
        contextIndex: 2,
        noteId: noteBId,
        type: "note",
      },
      {
        contextIndex: 3,
        noteId: noteAId,
        type: "note",
      },
    ];

    const result = resolveNoteChatUsedNoteIds([2, 3, 1], sources);

    expect(result).toEqual([noteBId, noteAId]);
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

  it("일부 Context index가 유효하더라도 존재하지 않는 index가 포함되면 오류를 발생시킨다", () => {
    const sources = [
      {
        contextIndex: 1,
        noteId: "550e8400-e29b-41d4-a716-446655440000",
        type: "note",
      },
    ];

    expect(() => resolveNoteChatUsedNoteIds([1, 2], sources)).toThrow(
      "Note chat used context index not found: 2",
    );
  });

  it("사용된 Context index가 없으면 빈 Note ID 목록을 반환한다", () => {
    expect(resolveNoteChatUsedNoteIds([], [])).toEqual([]);
  });
});
