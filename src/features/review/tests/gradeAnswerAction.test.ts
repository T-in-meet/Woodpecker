import { beforeEach, describe, expect, it, vi } from "vitest";

import { GRADING_ERROR_MESSAGES } from "../constants";
import { hashNoteContent } from "../lib/contentHash";

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_REVIEW_LOG_ID = "33333333-3333-4333-8333-333333333333";
const CLAIM_TOKEN = "55555555-5555-4555-8555-555555555555";
const TEST_USER_ID = "user-123";
const CONFIRMED_AT = "2026-01-01T00:00:00.000Z";
const ANSWER = "기억나는 내용을 적었습니다.";
const NOTE_CONTENT = "원본 노트 내용";
// 해시는 mock하지 않는다. 실제 함수로 만든 값이라야 액션의 대조가 의미 있다.
const NOTE_CONTENT_HASH = hashNoteContent(NOTE_CONTENT);

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
  graded_content_hash: null,
};

const {
  createAdminClientMock,
  createClientMock,
  generateJsonMock,
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
    generateJsonMock: vi.fn(),
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

// client.ts는 server-only를 import하는데 jsdom에서는 그것만으로 throw한다.
vi.mock("server-only", () => ({}));

// 호출부가 CloudflareAiError로 실패 이유를 가리므로 class도 함께 제공해야 한다.
// generateJson만 mock하면 instanceof 분기가 조용히 unknown으로 떨어진다.
vi.mock("@/lib/ai/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");

  return { ...actual, generateJson: generateJsonMock };
});

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
  originalContentHash = NOTE_CONTENT_HASH,
  answer = ANSWER,
}: {
  noteId?: string;
  reviewLogId?: string;
  originalContentHash?: string;
  answer?: string;
} = {}) {
  const formData = new FormData();

  formData.set("noteId", noteId);
  formData.set("reviewLogId", reviewLogId);
  formData.set("originalContentHash", originalContentHash);
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
    content: NOTE_CONTENT,
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
    expect(generateJsonMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns the stored grading without calling the AI when one exists", async () => {
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
      gradedAnswer: ANSWER,
      basisContentChanged: false,
      grading: {
        score: 70,
        summary: "이전 채점 총평",
        missedConcepts: [],
        incorrectPoints: ["잘못 기억한 내용"],
      },
    });
    expect(generateJsonMock).not.toHaveBeenCalled();
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

    // 경고만 띄우면 사용자는 어떤 문장에 대한 피드백인지 알 수 없다.
    // 기준이 된 답안을 함께 돌려줘야 화면에서 펼쳐 보여줄 수 있다.
    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: true,
      gradedAnswer: "이전에 제출한 다른 답안",
      basisContentChanged: false,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
  });

  it("claims the grading before calling the AI and finalizes with the claim token", async () => {
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      gradedAnswer: ANSWER,
      basisContentChanged: false,
      grading: VALID_GRADING_RESPONSE,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "claim_review_grading", {
      p_user_id: TEST_USER_ID,
      p_review_log_id: REVIEW_LOG_ID,
      p_user_answer: ANSWER,
      // 저장해 둬야 재진입 시 "이 채점의 기준 본문이 바뀌었는지"를 판단할 수 있다
      p_content_hash: NOTE_CONTENT_HASH,
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
  it("constrains the AI response with a JSON schema", async () => {
    setupSupabase();
    mockHappyPathQueries();
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

    await gradeAnswerAction(null, createFormData());

    const request = generateJsonMock.mock.calls[0]?.[0];

    expect(request?.responseSchema).toMatchObject({
      type: "object",
      properties: {
        score: expect.objectContaining({ minimum: 0, maximum: 100 }),
        summary: expect.objectContaining({ type: "string" }),
        missedConcepts: expect.objectContaining({ type: "array" }),
        incorrectPoints: expect.objectContaining({ type: "array" }),
      },
    });
  });

  // 선점 만료(120초)보다 먼저 끊겨야 같은 채점에 AI를 두 번 부르지 않는다
  it("aborts the AI call before the claim goes stale", async () => {
    setupSupabase();
    mockHappyPathQueries();
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

    await gradeAnswerAction(null, createFormData());

    expect(generateJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );
  });

  // deadline은 액션 진입 시각부터 잰다. 선점 RPC에 걸린 시간을 빼지 않으면
  // 종료 시각이 그만큼 뒤로 밀려 "채점 deadline < maxDuration" 순서가 깨진다.
  it("measures the abort deadline from the action entry, not from the claim", async () => {
    setupSupabase();
    mockHappyPathQueries();
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

    const base = Date.now();
    const nowSpy = vi
      .spyOn(Date, "now")
      // 진입 → 예산 계산(5초 경과) → abort 타이머 설정(선점에 15초 더 걸림)
      .mockReturnValueOnce(base)
      .mockReturnValueOnce(base + 5_000)
      .mockReturnValue(base + 20_000);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    await gradeAnswerAction(null, createFormData());

    // GRADING_DEADLINE_MS(60_000) - 경과 시간(20_000)
    expect(timeoutSpy).toHaveBeenCalledWith(40_000);

    timeoutSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it("skips the AI call and returns the stored grading when the claim reports it is already graded", async () => {
    setupSupabase({ claimResult: { status: "already_graded" } });
    mockHappyPathQueries();
    getGradingByReviewLogMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_GRADING);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      gradedAnswer: ANSWER,
      basisContentChanged: false,
      grading: {
        score: 60,
        summary: "동시 요청으로 저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
    });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("skips the AI call when another request holds the claim", async () => {
    setupSupabase({ claimResult: { status: "in_flight" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: GRADING_ERROR_MESSAGES.inFlight });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  // 한도는 claim_review_grading이 판정한다. 액션은 상태를 문구로 옮기기만 한다.
  it("skips the AI call when the daily grading limit is used up", async () => {
    setupSupabase({ claimResult: { status: "daily_exceeded" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: GRADING_ERROR_MESSAGES.dailyExceeded });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("skips the AI call when the claim is rejected", async () => {
    setupSupabase({ claimResult: { status: "not_found" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({ error: "진행 중인 복습을 찾을 수 없습니다." });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("skips the AI call when the claim response has no token", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ claimResult: { status: "ok" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(generateJsonMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("skips the AI call when the claim RPC fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase({ claimError: { message: "rpc down" } });
    mockHappyPathQueries();

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(generateJsonMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("refuses to grade when the note changed after the comparison was shown", async () => {
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();
    // 비교 화면을 띄운 뒤 다른 탭에서 노트를 고친 상황.
    // 화면은 구 본문을 보여주는데 AI가 신 본문으로 채점하면 기준이 어긋난다.
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "수정된 노트 내용",
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error:
        "채점을 준비하는 사이 노트가 수정됐어요. 새로고침 후 다시 비교해주세요.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("still returns an already stored grading when the note changed", async () => {
    setupSupabase();
    mockHappyPathQueries();
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "수정된 노트 내용",
    });
    getGradingByReviewLogMock.mockResolvedValue(STORED_GRADING);

    const result = await gradeAnswerAction(null, createFormData());

    // 이미 확정된 결과는 새로 채점하지 않으므로 버전이 달라도 막지 않는다.
    // 해시 도입 이전 행(graded_content_hash: null)은 판단 근거가 없어 경고하지 않는다.
    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      gradedAnswer: ANSWER,
      basisContentChanged: false,
      grading: { score: STORED_GRADING.score, ...STORED_GRADING.feedback },
    });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  // "답안 다시 작성" 뒤 채점을 누르면 복원 화면이 아니라 이 경로로 결과가 나온다.
  // 여기서 기준 원본 비교를 빠뜨리면 바뀐 원본 옆에 과거 기준 피드백이 경고 없이 놓인다.
  it("flags the stored grading when it was graded from a different note version", async () => {
    setupSupabase();
    mockHappyPathQueries();
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "수정된 노트 내용",
    });
    getGradingByReviewLogMock.mockResolvedValue({
      ...STORED_GRADING,
      graded_content_hash: NOTE_CONTENT_HASH,
    });

    const result = await gradeAnswerAction(
      null,
      createFormData({
        originalContentHash: hashNoteContent("수정된 노트 내용"),
      }),
    );

    expect(result).toMatchObject({
      success: true,
      gradedOtherAnswer: false,
      basisContentChanged: true,
    });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("does not flag the stored grading when the note version still matches", async () => {
    setupSupabase();
    mockHappyPathQueries();
    getGradingByReviewLogMock.mockResolvedValue({
      ...STORED_GRADING,
      graded_content_hash: NOTE_CONTENT_HASH,
    });

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toMatchObject({
      success: true,
      basisContentChanged: false,
    });
  });

  it("skips the claim when too little time is left to finish the AI call", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { rpcMock } = setupSupabase();
    mockHappyPathQueries();

    // 인증·조회가 50초를 먹은 상황. 남은 10초(< MIN_AI_BUDGET_MS 15초)로는
    // 채점을 끝낼 수 없으므로 선점을 잡지 않고 실패해야 한다. 잡아 버리면
    // 선점 만료까지 재시도가 막힌다.
    const base = Date.now();
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(base)
      .mockReturnValue(base + 50_000);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(generateJsonMock).not.toHaveBeenCalled();

    nowSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("returns an error when the AI call fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabase();
    mockHappyPathQueries();
    generateJsonMock.mockRejectedValue(new Error("network error"));

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
    generateJsonMock.mockResolvedValue(
      JSON.stringify({ score: 200, summary: "노트에 적힌 비밀 내용" }),
    );

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
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));
    getGradingByReviewLogMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(STORED_GRADING);

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      success: true,
      gradedOtherAnswer: false,
      gradedAnswer: ANSWER,
      basisContentChanged: false,
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
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

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
    generateJsonMock.mockResolvedValue(JSON.stringify(VALID_GRADING_RESPONSE));

    const result = await gradeAnswerAction(null, createFormData());

    expect(result).toEqual({
      error: "채점 결과를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
