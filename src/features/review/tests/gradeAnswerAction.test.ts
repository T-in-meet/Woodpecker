import { beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const CLAIM_TOKEN = "55555555-5555-4555-8555-555555555555";
const TEST_USER_ID = "user-123";
const CONFIRMED_AT = "2026-01-01T00:00:00.000Z";
const ANSWER = "기억나는 내용을 적었습니다.";

const VALID_GRADING_RESPONSE = {
  score: 85,
  summary: "핵심 개념을 대부분 회상했어요.",
  missedConcepts: ["개념 A"],
  incorrectPoints: [],
};

const STORED_GRADING = {
  id: "44444444-4444-4444-8444-444444444444",
  review_log_id: REVIEW_LOG_ID,
  round: 1,
  user_answer: ANSWER,
  score: 60,
  feedback: {
    summary: "동시 요청으로 저장된 총평",
    missedConcepts: [],
    incorrectPoints: [],
  },
  created_at: "2026-07-05T00:00:00.000Z",
};

const {
  createAdminClientMock,
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
    createAdminClientMock: vi.fn(),
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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
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

type RpcError = { code?: string; message: string } | null;

/**
 * 두 채점 RPC는 service_role 전용이라 admin 클라이언트로만 호출된다.
 * 사용자 클라이언트는 세션 확인에만 쓰이므로 rpc를 두지 않는다.
 */
function setupSupabase({
  userId = TEST_USER_ID,
  emailConfirmedAt = CONFIRMED_AT,
  claimResult = { status: "ok", claimToken: CLAIM_TOKEN } as unknown,
  claimError = null,
  finalizeResult = "ok",
  finalizeError = null,
}: {
  userId?: string | null;
  emailConfirmedAt?: string | null;
  claimResult?: unknown;
  claimError?: RpcError;
  finalizeResult?: string;
  finalizeError?: RpcError;
} = {}) {
  const rpcMock = vi.fn().mockImplementation((fn: string) => {
    if (fn === "claim_review_grading") {
      return Promise.resolve({ data: claimResult, error: claimError });
    }

    if (fn === "finalize_review_grading") {
      return Promise.resolve({ data: finalizeResult, error: finalizeError });
    }

    return Promise.resolve({ data: null, error: null });
  });

  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: emailConfirmedAt }
            : null,
        },
      }),
    },
  });

  createAdminClientMock.mockReturnValue({ rpc: rpcMock });

  return { rpcMock };
}

function rpcCallsFor(rpcMock: ReturnType<typeof vi.fn>, name: string) {
  return rpcMock.mock.calls.filter((call) => call[0] === name);
}

function createFormData({
  noteId = NOTE_ID,
  reviewLogId = REVIEW_LOG_ID,
  answer = ANSWER,
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
    setupSupabase({ userId: null });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: "로그인이 필요합니다." });
  });

  it("redirects unverified users to resend email", async () => {
    setupSupabase({ emailConfirmedAt: null });

    await gradeAnswerAction(null, createFormData());

    expect(redirectMock).toHaveBeenCalledWith("/resend-email?purpose=signup");
  });

  it("returns an error when the pending review log does not match", async () => {
    const { rpcMock } = setupSupabase();
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
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns the stored grading without calling Gemini when one exists", async () => {
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();
    getGradingByReviewLogMock.mockResolvedValue({
      ...STORED_GRADING,
      score: 70,
      feedback: {
        summary: "이전 채점 총평",
        missedConcepts: [],
        incorrectPoints: ["잘못 기억한 내용"],
      },
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      grading: {
        score: 70,
        summary: "이전 채점 총평",
        missedConcepts: [],
        incorrectPoints: ["잘못 기억한 내용"],
      },
    });
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("flags the stored grading when it was graded from a different answer", async () => {
    setupSupabase();
    mockHappyPathQueries();
    getGradingByReviewLogMock.mockResolvedValue({
      ...STORED_GRADING,
      user_answer: "이전에 제출한 다른 답안",
    });

    const result = await gradeAnswerAction(
      null,
      createFormData({ answer: "새로 작성한 답안" }),
    );

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: true,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
  });

  it("claims the grading before calling Gemini and finalizes with the claim token", async () => {
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      grading: VALID_GRADING_RESPONSE,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "claim_review_grading", {
      p_user_id: TEST_USER_ID,
      p_review_log_id: REVIEW_LOG_ID,
      p_user_answer: ANSWER,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "finalize_review_grading", {
      p_user_id: TEST_USER_ID,
      p_review_log_id: REVIEW_LOG_ID,
      p_claim_token: CLAIM_TOKEN,
      p_score: VALID_GRADING_RESPONSE.score,
      p_feedback: {
        summary: VALID_GRADING_RESPONSE.summary,
        missedConcepts: VALID_GRADING_RESPONSE.missedConcepts,
        incorrectPoints: VALID_GRADING_RESPONSE.incorrectPoints,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/notes/${NOTE_ID}`);
  });

  // 형식 이탈은 곧 사용자 에러 + 선점이 풀릴 때까지의 대기다. 디코딩 단계에서 먼저 막는다
  it("constrains the Gemini response with a JSON schema", async () => {
    setupSupabase();
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    await gradeAnswerAction(null, createFormData());

    const config = generateContentMock.mock.calls[0]?.[0]?.config;

    expect(config?.responseJsonSchema).toMatchObject({
      type: "object",
      properties: {
        score: expect.objectContaining({ minimum: 0, maximum: 100 }),
        summary: expect.objectContaining({ type: "string" }),
        missedConcepts: expect.objectContaining({ type: "array" }),
        incorrectPoints: expect.objectContaining({ type: "array" }),
      },
    });
  });

  // 선점 만료(60초)보다 먼저 끊겨야 같은 채점에 Gemini를 두 번 부르지 않는다
  it("aborts the Gemini call before the claim goes stale", async () => {
    setupSupabase();
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    await gradeAnswerAction(null, createFormData());

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          abortSignal: expect.any(AbortSignal),
        }),
      }),
    );
  });

  it("skips Gemini and returns the stored grading when the claim reports it is already graded", async () => {
    setupSupabase({ claimResult: { status: "already_graded" } });
    mockHappyPathQueries();
    getGradingByReviewLogMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_GRADING);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("skips Gemini when another request holds the claim", async () => {
    setupSupabase({ claimResult: { status: "in_flight" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "채점이 진행 중이에요. 잠시 후 다시 시도해주세요.",
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("skips Gemini when the claim is rejected", async () => {
    setupSupabase({ claimResult: { status: "not_found" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: "진행 중인 복습을 찾을 수 없습니다." });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("skips Gemini when the claim response has no token", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ claimResult: { status: "ok" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(generateContentMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("skips Gemini when the claim RPC fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ claimError: { message: "rpc down" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(generateContentMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("skips the claim when too little time is left to finish Gemini", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();

    // 인증·조회가 40초를 먹은 상황. 남은 5초로는 채점을 끝낼 수 없으므로
    // 선점을 잡지 않고 실패해야 한다. 잡아 버리면 선점 만료까지 재시도가 막힌다.
    const base = Date.now();
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 40_000);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();

    nowSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("returns an error when the Gemini call fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase();
    mockHappyPathQueries();
    generateContentMock.mockRejectedValue(new Error("network error"));

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });

    consoleErrorSpy.mockRestore();
  });

  it("returns an error without logging the raw response when it is not valid", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ score: 200, summary: "노트에 적힌 비밀 내용" }),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요.",
    });
    expect(rpcCallsFor(rpcMock, "finalize_review_grading")).toHaveLength(0);

    const logged = consoleErrorSpy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("노트에 적힌 비밀 내용");

    consoleErrorSpy.mockRestore();
  });

  it("returns the stored grading when finalize reports a concurrent save", async () => {
    setupSupabase({ finalizeResult: "already_graded" });
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });
    getGradingByReviewLogMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_GRADING);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
  });

  it("returns an error when the claim was taken over by another request", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ finalizeResult: "stale_claim" });
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "다른 채점 요청이 먼저 진행됐어요. 잠시 후 다시 시도해주세요.",
    });

    consoleErrorSpy.mockRestore();
  });

  it("returns an error instead of the grading when saving fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ finalizeError: { message: "save failed" } });
    mockHappyPathQueries();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(VALID_GRADING_RESPONSE),
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "채점 결과를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
