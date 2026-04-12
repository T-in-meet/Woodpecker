import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute, getNoteReviewRoute } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const NEXT_REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";

const {
  createClientMock,
  getNoteContentForComparisonMock,
  getPendingReviewLogMock,
  getReviewableNoteMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getNoteContentForComparisonMock: vi.fn(),
  getPendingReviewLogMock: vi.fn(),
  getReviewableNoteMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
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

function createAuthSupabaseMock(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  };
}

function createCompleteReviewSupabaseMock({
  userId = "user-123",
  rpcResult = NOTE_ID,
  rpcError = null,
}: {
  userId?: string | null;
  rpcResult?: string | null;
  rpcError?: { message: string } | null;
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

describe("submitAnswerAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getNoteContentForComparisonMock.mockReset();
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

  it("returns the original content for comparison when the note exists", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock("user-123"));
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "원본 내용",
      language: "markdown",
    });

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("answer", "내 답안");

    const result = await submitAnswerAction(null, formData);

    expect(getNoteContentForComparisonMock).toHaveBeenCalledWith(
      NOTE_ID,
      "user-123",
    );
    expect(result).toEqual({
      success: true,
      originalContent: "원본 내용",
      language: "markdown",
      userAnswer: "내 답안",
    });
  });
});

describe("completeReviewAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns an auth error when the user is not logged in", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock(null));

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("reviewLogId", REVIEW_LOG_ID);

    const result = await completeReviewAction(null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(getReviewableNoteMock).not.toHaveBeenCalled();
  });

  it("returns an error when the pending review log does not match", async () => {
    createClientMock.mockResolvedValue(createAuthSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      language: "markdown",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: NEXT_REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("reviewLogId", REVIEW_LOG_ID);

    const result = await completeReviewAction(null, formData);

    expect(result).toEqual({ error: "진행 중인 복습을 찾을 수 없습니다." });
  });

  it("completes a non-final review and schedules the next one", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock();

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      language: "markdown",
      review_round: 0,
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
    formData.set("reviewLogId", REVIEW_LOG_ID);

    await expect(completeReviewAction(null, formData)).rejects.toBe(
      REDIRECT_ERROR,
    );

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
      language: "markdown",
      review_round: 2,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 3,
      scheduled_at: "2026-01-08T00:00:00.000Z",
      completed_at: null,
    });

    const formData = new FormData();
    formData.set("noteId", NOTE_ID);
    formData.set("reviewLogId", REVIEW_LOG_ID);

    await expect(completeReviewAction(null, formData)).rejects.toBe(
      REDIRECT_ERROR,
    );

    expect(rpcMock).toHaveBeenCalledWith("complete_review_and_schedule_next", {
      p_note_id: NOTE_ID,
      p_review_log_id: REVIEW_LOG_ID,
    });
  });

  it("returns an error when completing the review log fails", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock({
      rpcError: { message: "rpc failed" },
    });

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      language: "markdown",
      review_round: 0,
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
    formData.set("reviewLogId", REVIEW_LOG_ID);

    const result = await completeReviewAction(null, formData);

    expect(result).toEqual({
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an error when the RPC returns no note id", async () => {
    const { rpcMock, supabase } = createCompleteReviewSupabaseMock({
      rpcResult: null,
    });

    createClientMock.mockResolvedValue(supabase);
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      language: "markdown",
      review_round: 0,
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
    formData.set("reviewLogId", REVIEW_LOG_ID);

    const result = await completeReviewAction(null, formData);

    expect(result).toEqual({
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
