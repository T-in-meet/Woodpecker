import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { getPendingReviewLog } from "../queries";

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
    const { chain, supabase } = createReviewLogsQueryMock({
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
