import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/lib/supabase/getUser", () => ({
  getUser: getUserMock,
}));

import { getLearningStats, getMyFeedbacks } from "../queries";

type NotesRow = { review_round: number; next_review_at?: string | null };
type ReviewLogsRow = {
  round: number;
  scheduled_at: string;
  completed_at: string | null;
};

function makeSupabase({
  notesData,
  reviewLogsData,
}: {
  notesData: NotesRow[];
  reviewLogsData: ReviewLogsRow[];
}) {
  const notesEq = vi.fn().mockResolvedValue({ data: notesData });
  const notesSelect = vi.fn().mockReturnValue({ eq: notesEq });
  const reviewLogsEq = vi.fn().mockResolvedValue({ data: reviewLogsData });
  const reviewLogsSelect = vi.fn().mockReturnValue({ eq: reviewLogsEq });

  const from = vi.fn((table: string) => {
    if (table === "notes") return { select: notesSelect };
    if (table === "review_logs") return { select: reviewLogsSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    supabase: { from },
    notesSelect,
    notesEq,
    reviewLogsSelect,
    reviewLogsEq,
    from,
  };
}

describe("getLearningStats", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getUserMock.mockReset();
    // 2026-05-03 12:00 KST = 2026-05-03T03:00:00.000Z UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty stats when user is not authenticated", async () => {
    getUserMock.mockResolvedValue(null);

    const result = await getLearningStats();

    expect(result).toEqual({
      totalNotes: 0,
      completedReviews: 0,
      todayReviews: 0,
      reviewWaitingCount: 0,
      completedNotesCount: 0,
      notesByRound: [],
      recentActivity: [],
      studyStreak: { current: 0, longest: 0 },
      onTimeRate: { completed: 0, onTime: 0 },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("aggregates notesByRound from notes.review_round", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [
        { review_round: 0 },
        { review_round: 1 },
        { review_round: 1 },
        { review_round: 3 },
      ],
      reviewLogsData: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.totalNotes).toBe(4);
    expect(result.notesByRound).toEqual([
      { round: 0, count: 1 },
      { round: 1, count: 2 },
      { round: 2, count: 0 },
      { round: 3, count: 1 },
    ]);
  });

  it("todayReviews: 오늘 예정과 기한이 지난(overdue) 미완료 복습을 함께 포함한다", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [],
      reviewLogsData: [
        // 어제 KST에 예정 (2026-05-02T05:00Z = 2026-05-02 14:00 KST) → overdue, 포함
        {
          round: 1,
          scheduled_at: "2026-05-02T05:00:00.000Z",
          completed_at: null,
        },
        // 오늘 KST (2026-05-02T16:00Z = 2026-05-03 01:00 KST) → 포함
        {
          round: 1,
          scheduled_at: "2026-05-02T16:00:00.000Z",
          completed_at: null,
        },
        // 내일 이후 → 제외
        {
          round: 3,
          scheduled_at: "2026-05-04T05:00:00.000Z",
          completed_at: null,
        },
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.todayReviews).toBe(2);
  });

  it("computes on-time rate based on KST date equality", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [],
      reviewLogsData: [
        // 같은 KST 날짜(2026-05-01) 내 완료 → onTime
        {
          round: 1,
          scheduled_at: "2026-05-01T05:00:00.000Z",
          completed_at: "2026-05-01T08:00:00.000Z",
        },
        // 예정일(2026-04-30 KST) 다음 날 완료 → late
        {
          round: 1,
          scheduled_at: "2026-04-30T05:00:00.000Z",
          completed_at: "2026-05-01T05:00:00.000Z",
        },
        // 같은 KST 날짜(2026-05-02) 내 완료 → onTime
        {
          round: 2,
          scheduled_at: "2026-05-02T05:00:00.000Z",
          completed_at: "2026-05-02T05:30:00.000Z",
        },
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.onTimeRate).toEqual({ completed: 3, onTime: 2 });
  });

  it("computes current and longest streak based on KST completion days", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [],
      reviewLogsData: [
        // 2026-04-25 KST
        {
          round: 1,
          scheduled_at: "2026-04-25T01:00:00.000Z",
          completed_at: "2026-04-25T05:00:00.000Z",
        },
        // 2026-04-26 KST
        {
          round: 1,
          scheduled_at: "2026-04-26T01:00:00.000Z",
          completed_at: "2026-04-26T05:00:00.000Z",
        },
        // 2026-04-27 KST
        {
          round: 1,
          scheduled_at: "2026-04-27T01:00:00.000Z",
          completed_at: "2026-04-27T05:00:00.000Z",
        },
        // 갭(2026-04-28, 29 누락)
        // 2026-05-02 KST
        {
          round: 2,
          scheduled_at: "2026-05-02T01:00:00.000Z",
          completed_at: "2026-05-02T05:00:00.000Z",
        },
        // 2026-05-03 KST (오늘)
        {
          round: 2,
          scheduled_at: "2026-05-03T01:00:00.000Z",
          completed_at: "2026-05-03T02:00:00.000Z",
        },
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    // current: 오늘부터 거꾸로 연속 → 2026-05-03, 2026-05-02 → 2
    // longest: 2026-04-25,26,27 연속 3일이 최장
    expect(result.studyStreak).toEqual({ current: 2, longest: 3 });
  });

  it("reviewWaitingCount: next_review_at이 null이고 round가 0인 노트를 포함한다", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [
        { review_round: 0, next_review_at: null }, // 미시작 → 대기
        { review_round: 1, next_review_at: null }, // 완주 → 제외
        { review_round: 3, next_review_at: null }, // 완주 → 제외
      ],
      reviewLogsData: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.reviewWaitingCount).toBe(1);
  });

  it("reviewWaitingCount: 미래 next_review_at을 가진 노트를 포함한다", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    // 현재 시각: 2026-05-03T03:00:00.000Z
    const { supabase } = makeSupabase({
      notesData: [
        {
          review_round: 1,
          next_review_at: "2026-05-04T00:00:00.000Z", // 미래 → 대기
        },
        {
          review_round: 2,
          next_review_at: "2026-05-02T00:00:00.000Z", // 과거(오버듀) → 제외
        },
      ],
      reviewLogsData: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.reviewWaitingCount).toBe(1);
  });

  it("reviewWaitingCount: 미시작·미래 혼합 케이스를 정확히 집계한다", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [
        { review_round: 0, next_review_at: null }, // 미시작 → 대기
        {
          review_round: 1,
          next_review_at: "2026-05-10T00:00:00.000Z", // 미래 → 대기
        },
        { review_round: 3, next_review_at: null }, // 완주 → 제외
        {
          review_round: 2,
          next_review_at: "2026-05-01T00:00:00.000Z", // 과거 → 제외
        },
      ],
      reviewLogsData: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.reviewWaitingCount).toBe(2);
  });

  it("completedNotesCount: next_review_at이 null이고 round가 MAX인 노트만 포함한다", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [
        { review_round: 3, next_review_at: null }, // 완주 → 포함
        { review_round: 0, next_review_at: null }, // 미시작 → 제외
        {
          review_round: 3,
          next_review_at: "2026-05-10T00:00:00.000Z", // 예정 있음 → 제외
        },
      ],
      reviewLogsData: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.completedNotesCount).toBe(1);
  });

  it("buckets recentActivity into 30 KST days ending today", async () => {
    getUserMock.mockResolvedValue({ id: "user-123" });

    const { supabase } = makeSupabase({
      notesData: [],
      reviewLogsData: [
        {
          round: 1,
          scheduled_at: "2026-05-01T01:00:00.000Z",
          completed_at: "2026-05-01T05:00:00.000Z",
        },
        {
          round: 1,
          scheduled_at: "2026-05-01T01:00:00.000Z",
          completed_at: "2026-05-01T08:00:00.000Z",
        },
        {
          round: 2,
          scheduled_at: "2026-05-03T01:00:00.000Z",
          completed_at: "2026-05-03T02:00:00.000Z",
        },
        // 윈도우 밖(35일 전) → recentActivity 미반영
        {
          round: 1,
          scheduled_at: "2026-03-29T01:00:00.000Z",
          completed_at: "2026-03-29T05:00:00.000Z",
        },
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getLearningStats();

    expect(result.recentActivity).toHaveLength(30);
    expect(result.recentActivity.at(-1)).toEqual({
      date: "2026-05-03",
      count: 1,
    });
    expect(result.recentActivity.find((d) => d.date === "2026-05-01")).toEqual({
      date: "2026-05-01",
      count: 2,
    });
    expect(
      result.recentActivity.find((d) => d.date === "2026-03-29"),
    ).toBeUndefined();
  });
});

// ---- 피드백 (#266) ----

type FeedbackQueryRow = {
  id: string;
  category: string;
  title: string;
  content: string;
  image_urls: string[];
  status: string;
  created_at: string;
  note: { id: string; title: string } | null;
  reply: {
    title: string;
    content: string;
    image_paths: string[];
    created_at: string;
  } | null;
};

function makeFeedbackRow(
  overrides: Partial<FeedbackQueryRow> = {},
): FeedbackQueryRow {
  return {
    id: "feedback-1",
    category: "BUG",
    title: "버그 신고",
    content: "동작하지 않아요",
    image_urls: [],
    status: "OPEN",
    created_at: "2026-05-01T00:00:00.000Z",
    note: null,
    reply: null,
    ...overrides,
  };
}

function makeFeedbackQuerySupabase({
  rows = [] as FeedbackQueryRow[],
  selectError = null as { message: string } | null,
  signedUrlError = null as { message: string } | null,
}: {
  rows?: FeedbackQueryRow[];
  selectError?: { message: string } | null;
  signedUrlError?: { message: string } | null;
} = {}) {
  const feedbacksOrder = vi.fn().mockResolvedValue({
    data: selectError ? null : rows,
    error: selectError,
  });
  const feedbacksEq = vi.fn().mockReturnValue({ order: feedbacksOrder });
  const feedbacksSelect = vi.fn().mockReturnValue({ eq: feedbacksEq });

  const createSignedUrlsMocks = new Map<string, ReturnType<typeof vi.fn>>();
  const storageFrom = vi.fn((bucket: string) => {
    const createSignedUrls =
      createSignedUrlsMocks.get(bucket) ??
      vi.fn().mockImplementation((paths: string[]) =>
        Promise.resolve(
          signedUrlError
            ? { data: null, error: signedUrlError }
            : {
                data: paths.map((path) => ({
                  path,
                  signedUrl: `https://signed.example.com/${bucket}/${path}`,
                })),
                error: null,
              },
        ),
      );
    createSignedUrlsMocks.set(bucket, createSignedUrls);
    return { createSignedUrls };
  });

  const from = vi.fn((table: string) => {
    if (table === "feedbacks") return { select: feedbacksSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    supabase: { from, storage: { from: storageFrom } },
    storageFrom,
  };
}

describe("getMyFeedbacks", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    // 2026-05-03 12:00 KST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("조회 실패 시 빈 결과를 반환한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = makeFeedbackQuerySupabase({
      selectError: { message: "boom" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getMyFeedbacks("user-123");
    expect(result).toEqual({ feedbacks: [], hasSubmittedToday: false });
  });

  it("피드백과 답변 이미지에 서명 URL을 매핑한다", async () => {
    const { supabase } = makeFeedbackQuerySupabase({
      rows: [
        makeFeedbackRow({
          image_urls: ["user-123/feedback-1/a.png"],
          note: { id: "note-1", title: "노트 제목" },
          reply: {
            title: "답변",
            content: "확인했습니다",
            image_paths: ["feedback-1/r.png"],
            created_at: "2026-05-02T00:00:00.000Z",
          },
        }),
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getMyFeedbacks("user-123");

    expect(result.feedbacks).toHaveLength(1);
    const feedback = result.feedbacks[0];
    expect(feedback?.note).toEqual({ id: "note-1", title: "노트 제목" });
    expect(feedback?.images).toEqual([
      {
        path: "user-123/feedback-1/a.png",
        url: "https://signed.example.com/feedbacks/user-123/feedback-1/a.png",
      },
    ]);
    expect(feedback?.reply?.images).toEqual([
      {
        path: "feedback-1/r.png",
        url: "https://signed.example.com/feedback_replies/feedback-1/r.png",
      },
    ]);
  });

  it("서명 URL 생성 실패 시 url을 null로 둔다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = makeFeedbackQuerySupabase({
      rows: [makeFeedbackRow({ image_urls: ["user-123/feedback-1/a.png"] })],
      signedUrlError: { message: "boom" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getMyFeedbacks("user-123");
    expect(result.feedbacks[0]?.images).toEqual([
      { path: "user-123/feedback-1/a.png", url: null },
    ]);
  });

  it("이미지가 없으면 서명 URL을 요청하지 않는다", async () => {
    const { supabase, storageFrom } = makeFeedbackQuerySupabase({
      rows: [makeFeedbackRow()],
    });
    createClientMock.mockResolvedValue(supabase);

    await getMyFeedbacks("user-123");
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("KST 기준 오늘 제출한 피드백이 있으면 hasSubmittedToday가 true다", async () => {
    // 2026-05-03T00:00Z = KST 2026-05-03 09:00 → 오늘
    const { supabase } = makeFeedbackQuerySupabase({
      rows: [makeFeedbackRow({ created_at: "2026-05-03T00:00:00.000Z" })],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getMyFeedbacks("user-123");
    expect(result.hasSubmittedToday).toBe(true);
  });

  it("오늘 제출한 피드백이 없으면 hasSubmittedToday가 false다", async () => {
    const { supabase } = makeFeedbackQuerySupabase({
      rows: [makeFeedbackRow({ created_at: "2026-05-02T00:00:00.000Z" })],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getMyFeedbacks("user-123");
    expect(result.hasSubmittedToday).toBe(false);
  });
});
