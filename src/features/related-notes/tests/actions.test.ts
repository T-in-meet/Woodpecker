import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  addManualRelatedNotesAction,
  deleteRelatedNoteAction,
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
        code: "XX000",
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

  it("RPC가 SQLSTATE로 자기 자신 연결을 보고하면 전용 메시지를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "WP007",
        message: "message text can change",
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
        },
      ],
    });

    expect(result).toEqual({
      error: "현재 노트는 관련 노트로 추가할 수 없습니다.",
    });
  });

  it("RPC가 SQLSTATE로 입력 오류를 보고하면 입력 오류 메시지를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "WP009",
        message: "message text can change",
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
        },
      ],
    });

    expect(result).toEqual({
      error: "관련 노트 추가 정보가 올바르지 않습니다.",
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

  it("SQLSTATE로 reason 길이 초과 오류를 매핑한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "WP008",
        message: "changed database message",
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
      error: "연결 이유는 500자 이하로 입력해주세요.",
    });
  });

  it("SQLSTATE로 수정 대상 없음 오류를 매핑한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "P0002",
        message: "changed database message",
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
      error: "수정할 관련 노트를 찾을 수 없습니다.",
    });
  });
});

describe("deleteRelatedNoteAction", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const relatedNoteId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 입력이면 Related Note 삭제 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await deleteRelatedNoteAction({
      noteId,
      relatedNoteId,
    });

    expect(rpc).toHaveBeenCalledWith("delete_note_related", {
      p_note_id: noteId,
      p_related_note_id: relatedNoteId,
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("입력값이 올바르지 않으면 RPC를 호출하지 않는다", async () => {
    const result = await deleteRelatedNoteAction({
      noteId: "invalid-note-id",
      relatedNoteId,
    });

    expect(result).toEqual({
      error: "관련 노트 삭제 정보가 올바르지 않습니다.",
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

    const result = await deleteRelatedNoteAction({
      noteId,
      relatedNoteId,
    });

    expect(result).toEqual({
      error: "관련 노트 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });

  it("SQLSTATE로 삭제 대상 없음 오류를 매핑한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "P0002",
        message: "changed database message",
      },
    });

    createClientMock.mockResolvedValue({
      rpc,
    } as never);

    const result = await deleteRelatedNoteAction({
      noteId,
      relatedNoteId,
    });

    expect(result).toEqual({
      error: "삭제할 관련 노트를 찾을 수 없습니다.",
    });
  });
});
