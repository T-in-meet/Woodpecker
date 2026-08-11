import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT } from "../../constants/execution";
import { assertNoteChatDailyExecutionLimit } from "../assert-daily-execution-limit";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

const createSupabaseClient = (
  count: number | null,
  error: { message: string } | null = null,
) => {
  const query = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockResolvedValue({ count, error }),
    select: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(query),
    query,
  };
};

describe("assertNoteChatDailyExecutionLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("일일 실행 횟수가 제한 미만이면 정상 종료한다", async () => {
    const supabase = createSupabaseClient(NOTE_CHAT_DAILY_EXECUTION_LIMIT - 1);
    createAdminClientMock.mockReturnValue(supabase);

    await expect(
      assertNoteChatDailyExecutionLimit("user-1"),
    ).resolves.toBeUndefined();
  });

  it("일일 실행 횟수가 제한에 도달하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseClient(NOTE_CHAT_DAILY_EXECUTION_LIMIT);
    createAdminClientMock.mockReturnValue(supabase);

    await expect(assertNoteChatDailyExecutionLimit("user-1")).rejects.toThrow(
      "NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED",
    );
  });

  it("DB 조회에 실패하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseClient(null, {
      message: "database error",
    });
    createAdminClientMock.mockReturnValue(supabase);

    await expect(assertNoteChatDailyExecutionLimit("user-1")).rejects.toThrow(
      "Failed to get note chat daily execution count: database error",
    );
  });

  it("현재 사용자의 오늘 실행 횟수를 조회한다", async () => {
    const supabase = createSupabaseClient(0);
    createAdminClientMock.mockReturnValue(supabase);

    await assertNoteChatDailyExecutionLimit("user-1");

    expect(supabase.from).toHaveBeenCalledWith("note_chat_runs");
    expect(supabase.query.select).toHaveBeenCalledWith(
      `
      id,
      note_chat_messages!note_chat_runs_user_message_id_fkey!inner(
        note_chat_conversations!inner(
          user_id
        )
      )
    `,
      {
        count: "exact",
        head: true,
      },
    );
    expect(supabase.query.eq).toHaveBeenCalledWith(
      "note_chat_messages.note_chat_conversations.user_id",
      "user-1",
    );
  });

  it("한국 시간 기준 오늘 00시부터 다음 날 00시까지의 범위로 조회한다", async () => {
    const supabase = createSupabaseClient(0);
    createAdminClientMock.mockReturnValue(supabase);

    await assertNoteChatDailyExecutionLimit("user-1");

    expect(supabase.query.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-08-10T15:00:00.000Z",
    );
    expect(supabase.query.lt).toHaveBeenCalledWith(
      "created_at",
      "2026-08-11T15:00:00.000Z",
    );
  });
});
