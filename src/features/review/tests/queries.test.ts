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
      review_completed_at: null,
      review_round: 2,
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewableNote(
      "11111111-1111-4111-8111-111111111111",
      "user-123",
    );

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(chain.select).toHaveBeenCalledWith(
      "title, next_review_at, review_completed_at, review_round",
    );
    expect(result).toEqual({
      title: "테스트 노트",
      next_review_at: "2026-01-06T09:00:00.000Z",
      review_completed_at: null,
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
