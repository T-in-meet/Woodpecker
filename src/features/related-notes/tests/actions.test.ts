import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import {
  addManualRelatedNotesAction,
  deleteRelatedNoteAction,
  requestRelatedNoteRecommendationAction,
  updateManualRelatedNoteReasonAction,
} from "../actions";
import { RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS } from "../execution/execution-claim-persistence";
import { scheduleRelatedNoteRecommendation } from "../execution/schedule-related-note-recommendation";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("../execution/schedule-related-note-recommendation", () => ({
  scheduleRelatedNoteRecommendation: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);
const redirectMock = vi.mocked(redirect);
const requireCurrentLegalAcceptanceMock = vi.mocked(
  requireCurrentLegalAcceptance,
);
const scheduleRelatedNoteRecommendationMock = vi.mocked(
  scheduleRelatedNoteRecommendation,
);

const authenticatedUserId = "99999999-9999-4999-8999-999999999999";

/** 인증된 사용자를 반환하는 auth.getUser mock을 만듭니다. */
function createAuthMock({
  emailConfirmedAt = "2026-08-31T00:00:00.000Z",
}: {
  emailConfirmedAt?: string | null;
} = {}) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: authenticatedUserId,
          email_confirmed_at: emailConfirmedAt,
        },
      },
    }),
  };
}

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
      auth: createAuthMock(),
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

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      authenticatedUserId,
      getNoteDetailRoute(noteId),
    );

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
      auth: createAuthMock(),
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
      auth: createAuthMock(),
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
      auth: createAuthMock(),
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
  const relationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 입력이면 manual Related Note의 reason 수정 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relationId,
      reason: "수정된 연결 이유",
    });

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      authenticatedUserId,
      getNoteDetailRoute(noteId),
    );

    expect(rpc).toHaveBeenCalledWith("update_note_related_manual_reason", {
      p_note_id: noteId,
      p_relation_id: relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relationId,
      reason: "",
    });

    expect(rpc).toHaveBeenCalledWith("update_note_related_manual_reason", {
      p_note_id: noteId,
      p_relation_id: relationId,
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("입력값이 올바르지 않으면 RPC를 호출하지 않는다", async () => {
    const result = await updateManualRelatedNoteReasonAction({
      noteId: "invalid-note-id",
      relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await updateManualRelatedNoteReasonAction({
      noteId,
      relationId,
      reason: "수정된 연결 이유",
    });

    expect(result).toEqual({
      error: "수정할 관련 노트를 찾을 수 없습니다.",
    });
  });
});

describe("deleteRelatedNoteAction", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const relationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 입력이면 Related Note 삭제 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
    });

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await deleteRelatedNoteAction({
      noteId,
      relationId,
    });

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      authenticatedUserId,
      getNoteDetailRoute(noteId),
    );

    expect(rpc).toHaveBeenCalledWith("delete_note_related", {
      p_note_id: noteId,
      p_relation_id: relationId,
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it("입력값이 올바르지 않으면 RPC를 호출하지 않는다", async () => {
    const result = await deleteRelatedNoteAction({
      noteId: "invalid-note-id",
      relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await deleteRelatedNoteAction({
      noteId,
      relationId,
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
      auth: createAuthMock(),
      rpc,
    } as never);

    const result = await deleteRelatedNoteAction({
      noteId,
      relationId,
    });

    expect(result).toEqual({
      error: "삭제할 관련 노트를 찾을 수 없습니다.",
    });
  });
});

describe("requestRelatedNoteRecommendationAction", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const claimId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createNoteLookupMock({
    data = { id: noteId },
    error = null,
  }: {
    data?: { id: string } | null;
    error?: unknown;
  } = {}) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data,
      error,
    });

    const secondEq = vi.fn().mockReturnValue({
      maybeSingle,
    });

    const firstEq = vi.fn().mockReturnValue({
      eq: secondEq,
    });

    const select = vi.fn().mockReturnValue({
      eq: firstEq,
    });

    return {
      from: vi.fn().mockReturnValue({
        select,
      }),
    };
  }

  it("입력값이 올바르지 않으면 인증이나 추천 실행을 시작하지 않는다", async () => {
    const result = await requestRelatedNoteRecommendationAction({
      noteId: "invalid-note-id",
    });

    expect(result).toEqual({
      error: "관련 노트 추천 요청 정보가 올바르지 않습니다.",
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(scheduleRelatedNoteRecommendationMock).not.toHaveBeenCalled();
  });

  it("인증되지 않은 사용자는 추천 실행을 시작하지 않는다", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
        }),
      },
    } as never);

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(result).toEqual({
      error: "로그인이 필요합니다.",
    });

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(scheduleRelatedNoteRecommendationMock).not.toHaveBeenCalled();
  });

  it("이메일을 확인하지 않은 사용자는 이메일 확인 페이지로 이동시킨다", async () => {
    createClientMock.mockResolvedValue({
      auth: createAuthMock({
        emailConfirmedAt: null,
      }),
    } as never);

    await expect(
      requestRelatedNoteRecommendationAction({
        noteId,
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup`,
    );

    expect(requireCurrentLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(scheduleRelatedNoteRecommendationMock).not.toHaveBeenCalled();
  });

  it("현재 사용자가 소유한 Note인지 확인한 뒤 추천 실행을 요청한다", async () => {
    const noteLookup = createNoteLookupMock();

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      ...noteLookup,
    } as never);

    scheduleRelatedNoteRecommendationMock.mockResolvedValue({
      claimId,
      status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
    });

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(requireCurrentLegalAcceptanceMock).toHaveBeenCalledWith(
      authenticatedUserId,
      getNoteDetailRoute(noteId),
    );

    expect(noteLookup.from).toHaveBeenCalledWith("notes");

    expect(scheduleRelatedNoteRecommendationMock).toHaveBeenCalledTimes(1);
    expect(scheduleRelatedNoteRecommendationMock).toHaveBeenCalledWith({
      noteId,
      ownerUserId: authenticatedUserId,
    });

    expect(result).toEqual({
      success: true,
      execution: {
        claimId,
        status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
      },
    });
  });

  it.each([
    RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DUPLICATE,
    RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE,
    RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
  ])("scheduler의 %s 상태를 그대로 반환한다", async (status) => {
    const noteLookup = createNoteLookupMock();

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      ...noteLookup,
    } as never);

    scheduleRelatedNoteRecommendationMock.mockResolvedValue({
      claimId: null,
      status,
    });

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(result).toEqual({
      success: true,
      execution: {
        claimId: null,
        status,
      },
    });
  });

  it("Note 조회에 실패하면 scheduler를 호출하지 않는다", async () => {
    const noteLookup = createNoteLookupMock({
      data: null,
      error: new Error("database failed"),
    });

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      ...noteLookup,
    } as never);

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(result).toEqual({
      error: "관련 노트 추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });

    expect(scheduleRelatedNoteRecommendationMock).not.toHaveBeenCalled();
  });

  it("현재 사용자가 소유한 Note를 찾을 수 없으면 scheduler를 호출하지 않는다", async () => {
    const noteLookup = createNoteLookupMock({
      data: null,
      error: null,
    });

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      ...noteLookup,
    } as never);

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(result).toEqual({
      error: "추천할 노트를 찾을 수 없습니다.",
    });

    expect(scheduleRelatedNoteRecommendationMock).not.toHaveBeenCalled();
  });

  it("scheduler가 실패하면 사용자용 오류를 반환한다", async () => {
    const noteLookup = createNoteLookupMock();

    createClientMock.mockResolvedValue({
      auth: createAuthMock(),
      ...noteLookup,
    } as never);

    scheduleRelatedNoteRecommendationMock.mockRejectedValue(
      new Error("claim failed"),
    );

    const result = await requestRelatedNoteRecommendationAction({
      noteId,
    });

    expect(result).toEqual({
      error: "관련 노트 추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });
});
