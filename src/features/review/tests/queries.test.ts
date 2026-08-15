import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

import {
  getNoteContentForComparison,
  getPendingReviewLog,
  getReviewableNote,
  hasCompletedReviewForNoteToday,
} from "../queries";

function createReviewLogsQueryMock(data: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };

  return {
    chain,
    supabase: {
      from: vi.fn().mockReturnValue(chain),
    },
  };
}

function createCompletedReviewLogsCountQueryMock(
  count: number | null,
  error: Error | null = null,
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ count, error }),
  };

  return {
    chain,
    supabase: {
      from: vi.fn().mockReturnValue(chain),
    },
  };
}

function createNotesQueryMock(data: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };

  return {
    chain,
    supabase: {
      from: vi.fn().mockReturnValue(chain),
    },
  };
}

describe("getReviewableNote", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns the note review status fields needed by the review page", async () => {
    const { chain, supabase } = createNotesQueryMock({
      title: "테스트 노트",
      next_review_at: "2026-01-06T09:00:00.000Z",
      review_round: 2,
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewableNote(
      "11111111-1111-4111-8111-111111111111",
      "user-123",
    );

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(chain.select).toHaveBeenCalledWith(
      "title, next_review_at, review_round",
    );
    expect(result).toEqual({
      title: "테스트 노트",
      next_review_at: "2026-01-06T09:00:00.000Z",
      review_round: 2,
    });
  });
});

describe("getNoteContentForComparison", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  // 채점 기준 대조는 본문 해시로 한다. updated_at은 본문과 무관한 UPDATE에도 바뀌어 쓰지 않는다.
  it("reads only the note body", async () => {
    const { chain, supabase } = createNotesQueryMock({
      content: "원본 내용",
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getNoteContentForComparison(
      "11111111-1111-4111-8111-111111111111",
      "user-123",
    );

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(chain.select).toHaveBeenCalledWith("content");
    expect(result).toEqual({ content: "원본 내용" });
  });
});

describe("getPendingReviewLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00.000Z"));
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the pending review log even before its scheduled time", async () => {
    const { supabase } = createReviewLogsQueryMock({
      id: "22222222-2222-4222-8222-222222222222",
      note_id: "11111111-1111-4111-8111-111111111111",
      round: 1,
      scheduled_at: "2026-01-06T09:00:00.000Z",
      completed_at: null,
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getPendingReviewLog(
      "11111111-1111-4111-8111-111111111111",
      "user-123",
    );

    expect(supabase.from).toHaveBeenCalledWith("review_logs");
    expect(result).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      note_id: "11111111-1111-4111-8111-111111111111",
      round: 1,
      scheduled_at: "2026-01-06T09:00:00.000Z",
      completed_at: null,
    });
  });
});

describe("hasCompletedReviewForNoteToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T14:30:00.000Z"));
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries completed review logs within the current KST day bounds", async () => {
    const { chain, supabase } = createCompletedReviewLogsCountQueryMock(1);

    createClientMock.mockResolvedValue(supabase);

    const result = await hasCompletedReviewForNoteToday(
      "11111111-1111-4111-8111-111111111111",
      "user-123",
    );

    expect(supabase.from).toHaveBeenCalledWith("review_logs");
    expect(chain.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(chain.eq).toHaveBeenNthCalledWith(
      1,
      "note_id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(chain.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
    expect(chain.not).toHaveBeenCalledWith("completed_at", "is", null);
    expect(chain.gte).toHaveBeenCalledWith(
      "completed_at",
      "2026-04-22T15:00:00.000Z",
    );
    expect(chain.lt).toHaveBeenCalledWith(
      "completed_at",
      "2026-04-23T15:00:00.000Z",
    );
    expect(result).toBe(true);
  });

  it("returns false when no completed review log exists today", async () => {
    const { supabase } = createCompletedReviewLogsCountQueryMock(0);

    createClientMock.mockResolvedValue(supabase);

    await expect(
      hasCompletedReviewForNoteToday(
        "11111111-1111-4111-8111-111111111111",
        "user-123",
      ),
    ).resolves.toBe(false);
  });

  it("returns false when Supabase returns a null count without an error", async () => {
    const { supabase } = createCompletedReviewLogsCountQueryMock(null);

    createClientMock.mockResolvedValue(supabase);

    await expect(
      hasCompletedReviewForNoteToday(
        "11111111-1111-4111-8111-111111111111",
        "user-123",
      ),
    ).resolves.toBe(false);
  });

  it("throws when the completed review lookup fails", async () => {
    const queryError = new Error("review logs query failed");
    const { supabase } = createCompletedReviewLogsCountQueryMock(
      null,
      queryError,
    );

    createClientMock.mockResolvedValue(supabase);

    await expect(
      hasCompletedReviewForNoteToday(
        "11111111-1111-4111-8111-111111111111",
        "user-123",
      ),
    ).rejects.toBe(queryError);
  });
});
