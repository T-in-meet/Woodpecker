import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

import { getNoteById, getNotes } from "../queries";

// ─── getNotes ────────────────────────────────────────────────────────────────

describe("getNotes", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns note summaries ordered by updated time", async () => {
    const notes = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "최근 노트",
        content: "내용 1",
        next_review_at: "2026-03-30T09:00:00.000Z",
        review_round: 1,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        content: "내용 2",
        next_review_at: null,
        review_round: 3,
      },
    ];
    const { supabase, from, callsFor } = createSupabaseQueryMock({
      notes: { data: notes, count: 2 },
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(from).toHaveBeenCalledWith("notes");
    const calls = callsFor("notes");
    expect(calls).toContainEqual([
      "select",
      ["id, title, content, next_review_at, review_round", { count: "exact" }],
    ]);
    expect(calls).toContainEqual(["eq", ["user_id", "user-123"]]);
    expect(calls).toContainEqual([
      "order",
      ["updated_at", { ascending: false }],
    ]);
    expect(calls).toContainEqual(["range", [0, NOTES_PAGE_SIZE - 1]]);
    expect(result).toEqual({ notes, total: 2 });
  });

  it("returns an empty list when the query result does not match the schema", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: {
        data: [
          {
            id: "invalid-note-id",
            title: "잘못된 노트",
            content: "내용",
            next_review_at: null,
            review_round: 1,
            created_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T12:00:00.000Z",
          },
        ],
        count: 1,
      },
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(result).toEqual({ notes: [], total: 1 });
  });

  it("DB 쿼리 에러 발생 시 throw한다", async () => {
    const dbError = new Error("DB connection failed");
    const { supabase } = createSupabaseQueryMock({
      notes: { data: null, count: 0, error: dbError },
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(getNotes("user-123")).rejects.toThrow("DB connection failed");
  });

  it.each([
    ["due", "lte", ["next_review_at", expect.any(String)]],
    ["scheduled", "or", [expect.stringContaining("next_review_at.gt.")]],
    ["completed", "is", ["next_review_at", null]],
  ] as const)("%s 보기에 맞는 필터를 적용한다", async (view, method, args) => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: { data: [], count: 0 },
    });
    createClientMock.mockResolvedValue(supabase);

    await getNotes("user-123", 1, "", NOTES_PAGE_SIZE, view);

    expect(callsFor("notes")).toContainEqual([method, args]);
    if (view === "due" || view === "scheduled") {
      expect(callsFor("notes")).toContainEqual([
        "order",
        ["created_at", { ascending: false }],
      ]);
    }
    if (view === "completed") {
      expect(callsFor("notes")).toContainEqual(["eq", ["review_round", 3]]);
    }
  });

  it("returns note detail with notification time of day and pending scheduled_at", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: {
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "알림 시간 노트",
          content: "note body",
          next_review_at: "2026-03-30T09:00:00.000Z",
          notification_time_of_day: "21:30:00",
          review_round: 1,
          created_at: "2026-03-29T00:00:00.000Z",
          updated_at: "2026-03-29T01:00:00.000Z",
          user_id: "22222222-2222-4222-8222-222222222222",
        },
      },
      review_logs: { data: { scheduled_at: "2026-03-30T12:30:00.000Z" } },
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getNoteById(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    const noteCalls = callsFor("notes");
    expect(noteCalls).toContainEqual([
      "select",
      [
        "id, title, content, next_review_at, notification_time_of_day, review_round, created_at, updated_at, user_id",
      ],
    ]);
    expect(noteCalls).toContainEqual([
      "eq",
      ["id", "11111111-1111-4111-8111-111111111111"],
    ]);
    expect(noteCalls).toContainEqual([
      "eq",
      ["user_id", "22222222-2222-4222-8222-222222222222"],
    ]);
    expect(noteCalls).toContainEqual(["maybeSingle", []]);

    const logCalls = callsFor("review_logs");
    expect(logCalls).toContainEqual(["select", ["scheduled_at"]]);
    expect(logCalls).toContainEqual([
      "eq",
      ["note_id", "11111111-1111-4111-8111-111111111111"],
    ]);
    expect(logCalls).toContainEqual([
      "eq",
      ["user_id", "22222222-2222-4222-8222-222222222222"],
    ]);
    expect(logCalls).toContainEqual(["is", ["completed_at", null]]);
    expect(logCalls).toContainEqual([
      "order",
      ["scheduled_at", { ascending: true }],
    ]);
    expect(logCalls).toContainEqual(["limit", [1]]);

    expect(result).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      notification_time_of_day: "21:30:00",
      next_scheduled_at: "2026-03-30T12:30:00.000Z",
    });
  });

  it("returns next_scheduled_at as null when no pending review_log exists", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: {
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "완료된 노트",
          content: "note body",
          next_review_at: null,
          notification_time_of_day: null,
          review_round: 3,
          created_at: "2026-03-29T00:00:00.000Z",
          updated_at: "2026-03-29T01:00:00.000Z",
          user_id: "22222222-2222-4222-8222-222222222222",
        },
      },
      review_logs: { data: null },
    });

    createClientMock.mockResolvedValue(supabase);

    const result = await getNoteById(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(result?.next_scheduled_at).toBeNull();
  });
});
