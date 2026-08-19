import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  addManualRelatedNotesAction,
  updateManualRelatedNoteReasonAction,
} from "../actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

describe("addManualRelatedNotesAction", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const firstRelatedNoteId = "22222222-2222-4222-8222-222222222222";
  const secondRelatedNoteId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 입력이면 선택한 Related Notes를 한 번의 RPC 호출로 추가한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await addManualRelatedNotesAction({
      noteId,
      relatedNotes: [
        {
          relatedNoteId: firstRelatedNoteId,
          reason: "같이 참고하려고 연결합니다.",
        },
        {
          relatedNoteId: secondRelatedNoteId,
        },
      ],
    });

    expect(rpc).toHaveBeenCalledTimes(1);

    expect(rpc).toHaveBeenCalledWith("add_note_related_manual", {
      p_note_id: noteId,
      p_related_notes: [
        {
          relatedNoteId: firstRelatedNoteId,
          reason: "같이 참고하려고 연결합니다.",
        },
        {
          relatedNoteId: secondRelatedNoteId,
        },
      ],
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("입력값이 올바르지 않으면 RPC를 호출하지 않는다", async () => {
    const result = await addManualRelatedNotesAction({
      noteId: "invalid-note-id",
      relatedNotes: [
        {
          relatedNoteId: firstRelatedNoteId,
          reason: "",
        },
      ],
    });

    expect(result).toEqual({
      error: "관련 노트 추가 정보가 올바르지 않습니다.",
    });

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("추가할 Related Note가 없으면 RPC를 호출하지 않는다", async () => {
    const result = await addManualRelatedNotesAction({
      noteId,
      relatedNotes: [],
    });

    expect(result).toEqual({
      error: "추가할 관련 노트를 하나 이상 선택해주세요.",
    });

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("RPC 호출에 실패하면 사용자용 오류를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        message: "database failed",
      },
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await addManualRelatedNotesAction({
      noteId,
      relatedNotes: [
        {
          relatedNoteId: firstRelatedNoteId,
          reason: "연결 이유",
        },
      ],
    });

    expect(result).toEqual({
      error: "관련 노트 추가에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });
});

describe("updateManualRelatedNoteReasonAction", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const relatedNoteId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 입력이면 manual Related Note의 reason 수정 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relatedNoteId,
      reason: "수정된 연결 이유",
    });

    expect(rpc).toHaveBeenCalledWith("update_note_related_manual_reason", {
      p_note_id: noteId,
      p_related_note_id: relatedNoteId,
      p_reason: "수정된 연결 이유",
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("reason이 비어 있으면 p_reason을 생략하여 제거 요청을 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relatedNoteId,
      reason: "",
    });

    expect(rpc).toHaveBeenCalledWith("update_note_related_manual_reason", {
      p_note_id: noteId,
      p_related_note_id: relatedNoteId,
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("입력값이 올바르지 않으면 RPC를 호출하지 않는다", async () => {
    const result = await updateManualRelatedNoteReasonAction({
      noteId: "invalid-note-id",
      relatedNoteId,
      reason: "연결 이유",
    });

    expect(result).toEqual({
      error: "관련 노트 수정 정보가 올바르지 않습니다.",
    });

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("RPC 호출에 실패하면 사용자용 오류를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        message: "database failed",
      },
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relatedNoteId,
      reason: "수정된 연결 이유",
    });

    expect(result).toEqual({
      error: "관련 노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });
});
