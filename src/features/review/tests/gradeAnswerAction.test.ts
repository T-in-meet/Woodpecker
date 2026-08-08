import { beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const TEST_USER_ID = "user-123";
const CONFIRMED_AT = "2026-01-01T00:00:00.000Z";

const VALID_GRADING_RESPONSE = {
  score: 85,
  summary: "핵심 개념을 대부분 회상했어요.",
  missedConcepts: ["개념 A"],
  incorrectPoints: [],
};

const {
  createClientMock,
  generateContentMock,
  getGradingByReviewLogMock,
  getNoteContentForComparisonMock,
  getPendingReviewLogMock,
  getReviewableNoteMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => {
  return {
    createClientMock: vi.fn(),
    generateContentMock: vi.fn(),
    getGradingByReviewLogMock: vi.fn(),
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

vi.mock("@/lib/gemini/client", () => ({
  getGemini: () => ({ models: { generateContent: generateContentMock } }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("../queries", () => ({
  getGradingByReviewLog: getGradingByReviewLogMock,
  getNoteContentForComparison: getNoteContentForComparisonMock,
  getPendingReviewLog: getPendingReviewLogMock,
  getReviewableNote: getReviewableNoteMock,
}));

import { gradeAnswerAction } from "../actions";

function createSupabaseMock({
  userId = TEST_USER_ID,
  emailConfirmedAt = CONFIRMED_AT,
  insertError = null,
}: {
  userId?: string | null;
  emailConfirmedAt?: string | null;
  insertError?: { code?: string; message: string } | null;
} = {}) {
  const insertMock = vi.fn().mockResolvedValue({ error: insertError });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

  return {
    insertMock,
    fromMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: userId
              ? { id: userId, email_confirmed_at: emailConfirmedAt }
              : null,
          },
        }),
      },
      from: fromMock,
    },
  };
}

function createFormData({
  noteId = NOTE_ID,
  reviewLogId = REVIEW_LOG_ID,
  answer = "기억나는 내용을 적었습니다.",
}: {
  noteId?: string;
  reviewLogId?: string;
  answer?: string;
} = {}) {
  const formData = new FormData();

  formData.set("noteId", noteId);
  formData.set("reviewLogId", reviewLogId);
  formData.set("answer", answer);

  return formData;
}

function mockHappyPathQueries() {
  getReviewableNoteMock.mockResolvedValue({
    title: "노트 제목",
    next_review_at: "2026-07-05T00:00:00.000Z",
    review_round: 0,
  });
  getNoteContentForComparisonMock.mockResolvedValue({
    content: "원본 노트 내용",
  });
  getPendingReviewLogMock.mockResolvedValue({
    id: REVIEW_LOG_ID,
    note_id: NOTE_ID,
    round: 1,
    scheduled_at: "2026-07-05T00:00:00.000Z",
    completed_at: null,
  });
  getGradingByReviewLogMock.mockResolvedValue(null);
}

describe("gradeAnswerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid payload", async () => {
    const result = await gradeAnswerAction(
      null,
      createFormData({ noteId: "invalid" }),
    );

    expect(result).toEqual({ error: "요청이 올바르지 않습니다." });
  });

  it("requires a signed-in user", async () => {
    const { supabase } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: "로그인이 필요합니다." });
  });

  it("redirects unverified users to resend email", async () => {
    const { supabase } = createSupabaseMock({ emailConfirmedAt: null });
    createClientMock.mockResolvedValue(supabase);

    await gradeAnswerAction(null, createFormData());

    expect(redirectMock).toHaveBeenCalledWith("/resend-email?purpose=signup");
  });

  it("returns an error when the pending review log does not match", async () => {
    const { supabase } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    getPendingReviewLogMock.mockResolvedValue({
      id: OTHER_REVIEW_LOG_ID,
      note_id: NOTE_ID,
      round: 1,
      scheduled_at: "2026-07-05T00:00:00.000Z",
      completed_at: null,
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: "진행 중인 복습을 찾을 수 없습니다." });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns the stored grading without calling Gemini when one exists", async () => {
    const { supabase, insertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    getGradingByReviewLogMock.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      review_log_id: REVIEW_LOG_ID,
      round: 1,
      score: 70,
      feedback: {
        summary: "이전 채점 총평",
        missedConcepts: [],
        incorrectPoints: ["잘못 기억한 내용"],
      },
      created_at: "2026-07-04T00:00:00.000Z",
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      grading: {
        score: 70,
        summary: "이전 채점 총평",
        missedConcepts: [],
        incorrectPoints: ["잘못 기억한 내용"],
      },
    });
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("grades the answer, stores the result, and returns it", async () => {
    const { supabase, fromMock, insertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      grading: VALID_GRADING_RESPONSE,
    });
    expect(fromMock).toHaveBeenCalledWith("review_gradings");
    expect(insertMock).toHaveBeenCalledWith({
      review_log_id: REVIEW_LOG_ID,
      note_id: NOTE_ID,
      user_id: TEST_USER_ID,
      round: 1,
      user_answer: "기억나는 내용을 적었습니다.",
      score: VALID_GRADING_RESPONSE.score,
      feedback: {
        summary: VALID_GRADING_RESPONSE.summary,
        missedConcepts: VALID_GRADING_RESPONSE.missedConcepts,
        incorrectPoints: VALID_GRADING_RESPONSE.incorrectPoints,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/notes/${NOTE_ID}`);
  });

  it("returns an error when the Gemini call fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { supabase } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    generateContentMock.mockRejectedValue(new Error("network error"));

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });

    consoleErrorSpy.mockRestore();
  });

  it("returns an error when the Gemini response is not valid", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { supabase, insertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ score: 200, summary: "총평" }),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요.",
    });
    expect(insertMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("returns the stored grading when a concurrent request already saved one", async () => {
    const { supabase } = createSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    createClientMock.mockResolvedValue(supabase);
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });
    getGradingByReviewLogMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "44444444-4444-4444-8444-444444444444",
        review_log_id: REVIEW_LOG_ID,
        round: 1,
        score: 60,
        feedback: {
          summary: "동시 요청으로 저장된 총평",
          missedConcepts: [],
          incorrectPoints: [],
        },
        created_at: "2026-07-05T00:00:00.000Z",
      });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
  });
});
