import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNoteDetailRoute,
  getNoteReviewRoute,
  ROUTES,
} from "@/lib/constants/routes";

import { hashNoteContent } from "../lib/contentHash";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const NEXT_REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const TEST_USER_ID = "user-123";
const CONFIRMED_AT = "2026-01-01T00:00:00.000Z";
const UNVERIFIED_EMAIL_STATES = [null, undefined] as const;

const {
  createClientMock,
  getNoteContentForComparisonMock,
  getPendingReviewLogMock,
  getReviewableNoteMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => {
  return {
    createClientMock: vi.fn(),
    getNoteContentForComparisonMock: vi.fn(),
    getPendingReviewLogMock: vi.fn(),
    getReviewableNoteMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

// actions.ts가 gemini client를 import하므로 GEMINI_API_KEY 없이도 로드되도록 mock
vi.mock("@/lib/gemini/client", () => ({
  getGemini: () => ({ models: { generateContent: vi.fn() } }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("../queries", () => ({
  getNoteContentForComparison: getNoteContentForComparisonMock,
  getPendingReviewLog: getPendingReviewLogMock,
  getReviewableNote: getReviewableNoteMock,
}));

import { completeReviewAction, submitAnswerAction } from "../actions";

function createAuthSupabaseMock(
  userId: string | null,
  options?: { emailConfirmedAt?: string | null | undefined },
) {
  const emailConfirmedAt =
    options && Object.prototype.hasOwnProperty.call(options, "emailConfirmedAt")
      ? options.emailConfirmedAt
      : CONFIRMED_AT;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: emailConfirmedAt }
            : null,
        },
      }),
    },
  };
}

function createCompleteReviewSupabaseMock({
  userId = TEST_USER_ID,
  rpcResult = NOTE_ID,
  rpcError = null,
}: {
  userId?: string | null;
  rpcResult?: string | null;
  rpcError?: { code?: string; message: string } | null;
} = {}) {
  const rpcMock = vi.fn().mockResolvedValue({
    data: rpcError ? null : rpcResult,
    error: rpcError,
  });

  return {
    rpcMock,
    supabase: {
      ...createAuthSupabaseMock(userId),
      rpc: rpcMock,
    },
  };
}

function createCompleteReviewFormData({
  noteId = NOTE_ID,
  reviewLogId = REVIEW_LOG_ID,
}: {
  noteId?: string;
  reviewLogId?: string;
} = {}) {
  const formData = new FormData();

  formData.set("noteId", noteId);
  formData.set("reviewLogId", reviewLogId);

  return formData;
}

describe("submitAnswerAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getNoteContentForComparisonMock.mockReset();
    getPendingReviewLogMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns field errors for invalid answer input", async () => {
    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "   ");

    const result = await submitAnswerAction(null, formData);

    expect(result).toMatchObject({
      error: expect.objectContaining({
        answer: expect.any(Array),
      }),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns an auth error when the user is not logged in", async () => {
    const supabase = createAuthSupabaseMock(null);
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "기억나는 내용");

    const result = await submitAnswerAction(null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(getNoteContentForComparisonMock).not.toHaveBeenCalled();
  });

  it("returns an error when there is no pending review log", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "원본 내용",
    });
    getPendingReviewLogMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "내 답안");

    const result = await submitAnswerAction(null, formData);

    expect(result).toEqual({ error: "진행 중인 복습을 찾을 수 없습니다." });
  });

  it("returns an error when a query throws", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getNoteContentForComparisonMock.mockRejectedValue(
      new Error("db connection failed"),
    );
    getPendingReviewLogMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "내 답안");

    const result = await submitAnswerAction(null, formData);

    expect(result).toEqual({
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });

  it("returns the original content and review log id when the note exists", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "원본 내용",
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "내 답안");

    const result = await submitAnswerAction(null, formData);

    expect(getNoteContentForComparisonMock).toHaveBeenCalledWith(
      NOTE_ID,
      TEST_USER_ID,
    );
    expect(getPendingReviewLogMock).toHaveBeenCalledWith(NOTE_ID, TEST_USER_ID);

    // 채점 요청이 이 해시를 되돌려줘야 서버가 같은 원본인지 확인할 수 있다.
    expect(result).toMatchObject({
      success: true,
      originalContent: "원본 내용",
      originalContentHash: hashNoteContent("원본 내용"),
      userAnswer: "내 답안",
      reviewLogId: REVIEW_LOG_ID,
    });
  });

  it.each(UNVERIFIED_EMAIL_STATES)(
    "redirects unverified emails to the resend-email route when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createAuthSupabaseMock(TEST_USER_ID, { emailConfirmedAt }),
      );

      const formData = new FormData();
      formData.set("noteId", NOTE_ID);
      formData.set("answer", "내 답안");

      await expect(submitAnswerAction(null, formData)).rejects.toBe(
        REDIRECT_ERROR,
      );

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(getNoteContentForComparisonMock).not.toHaveBeenCalled();
      expect(getPendingReviewLogMock).not.toHaveBeenCalled();
    },
  );
});

describe("completeReviewAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getPendingReviewLogMock.mockReset();
    getReviewableNoteMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an auth error when the user is not logged in", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(null));

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(getReviewableNoteMock).not.toHaveBeenCalled();
  });

  it.each(UNVERIFIED_EMAIL_STATES)(
    "redirects unverified emails to the resend-email route when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createAuthSupabaseMock(TEST_USER_ID, { emailConfirmedAt }),
      );

      await expect(
        completeReviewAction(null, createCompleteReviewFormData()),
      ).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(getReviewableNoteMock).not.toHaveBeenCalled();
      expect(getPendingReviewLogMock).not.toHaveBeenCalled();
    },
  );

  it("returns an error when there is no pending review log", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue(null);

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error: "이미 완료되었거나 진행 중인 복습이 없습니다.",
    });
  });

  it("returns an error when the pending review log does not match", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: NEXT_REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error: "답안을 제출한 뒤 원본을 확인하고 복습을 완료해주세요.",
    });
  });

  it("completes a non-final review and schedules the next one", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock();

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    await expect(
      completeReviewAction(null, createCompleteReviewFormData()),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(rpcMock).toHaveBeenCalledWith("complete_review_and_schedule_next", {
      p_note_id: NOTE_ID,
      p_review_log_id: REVIEW_LOG_ID,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      getNoteDetailRoute(NOTE_ID),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      getNoteReviewRoute(NOTE_ID),
    );
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute(NOTE_ID));
  });

  it("marks the note as completed on the final review round", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock();

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 2,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 3,
      scheduled_at: "2026-01-08T00:00:00.000Z",
      completed_at: null,
    });

    await expect(
      completeReviewAction(null, createCompleteReviewFormData()),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(rpcMock).toHaveBeenCalledWith("complete_review_and_schedule_next", {
      p_note_id: NOTE_ID,
      p_review_log_id: REVIEW_LOG_ID,
    });
  });

  it("returns a daily limit message when the RPC reports WP001", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock({
      rpcError: {
        code: "WP001",
        message: "daily review completion limit reached",
      },
    });

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error:
        "오늘은 이미 이 노트의 복습을 완료했어요. 내일 자정(KST) 이후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns a generic error when the RPC reports another P0001 failure", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock({
      rpcError: { code: "P0001", message: "pending review log not found" },
    });

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an error when a query throws", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(TEST_USER_ID));
    getReviewableNoteMock.mockRejectedValue(new Error("db connection failed"));
    getPendingReviewLogMock.mockResolvedValue(null);

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an error when the RPC returns no note id", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock({
      rpcResult: null,
    });

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const result = await completeReviewAction(
      null,
      createCompleteReviewFormData(),
    );

    expect(result).toEqual({
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
