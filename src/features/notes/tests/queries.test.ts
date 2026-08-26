import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";

const { createClientMock, getKstDayBoundsUtcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getKstDayBoundsUtcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/review/lib/kstDay", () => ({
  getKstDayBoundsUtc: getKstDayBoundsUtcMock,
}));

vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

import {
  getNoteById,
  getNotes,
  getReviewWaitingNotes,
  getTodayReviewNotes,
} from "../queries";

// ─── 공통 픽스처 ────────────────────────────────────────────────────────────

const BASE_NOTE = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "테스트 노트",
  content: "테스트 내용",
  next_review_at: "2026-05-07T10:00:00.000Z",
  review_round: 1,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
};

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
        created_at: "2026-03-29T00:00:00.000Z",
        updated_at: "2026-03-29T12:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        content: "내용 2",
        next_review_at: null,
        review_round: 3,
        created_at: "2026-03-28T00:00:00.000Z",
        updated_at: "2026-03-28T12:00:00.000Z",
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
      [
        "id, title, content, next_review_at, review_round, created_at, updated_at",
        { count: "exact" },
      ],
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

// ─── getTodayReviewNotes ──────────────────────────────────────────────────────

describe("getTodayReviewNotes", () => {
  const KST_START = "2026-05-07T15:00:00.000Z";
  const KST_END = "2026-05-08T15:00:00.000Z";

  beforeEach(() => {
    createClientMock.mockReset();
    getKstDayBoundsUtcMock.mockReturnValue({
      startUtcIso: KST_START,
      endUtcIso: KST_END,
    });
  });

  it("KST 오늘 범위 내 노트를 반환한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: { data: [BASE_NOTE], count: 1 },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    const calls = callsFor("notes");
    expect(calls).toContainEqual(["eq", ["user_id", "user-123"]]);
    expect(calls).toContainEqual(["gte", ["next_review_at", KST_START]]);
    expect(calls).toContainEqual(["lt", ["next_review_at", KST_END]]);
    expect(calls).toContainEqual([
      "order",
      ["next_review_at", { ascending: true }],
    ]);
    expect(calls).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
    expect(result).toEqual({ notes: [BASE_NOTE], total: 1 });
  });

  it("기본 page=1은 첫 페이지 range로 조회한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: { data: [BASE_NOTE], count: 1 },
    });
    createClientMock.mockResolvedValue(supabase);

    await getTodayReviewNotes("user-123");

    expect(callsFor("notes")).toContainEqual(["range", [0, 8]]);
  });

  it("page/pageSize에 맞는 range로 조회한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: { data: [], count: 20 },
    });
    createClientMock.mockResolvedValue(supabase);

    await getTodayReviewNotes("user-123", 3, 9);

    expect(callsFor("notes")).toContainEqual(["range", [18, 26]]);
  });

  it("스키마 파싱 실패 시 빈 결과를 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [{ ...BASE_NOTE, id: "not-a-uuid" }], count: 1 },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    expect(result).toEqual({ notes: [], total: 0 });
  });

  it("DB 쿼리 에러 발생 시 throw한다", async () => {
    const dbError = new Error("DB connection failed");
    const { supabase } = createSupabaseQueryMock({
      notes: { data: null, error: dbError },
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(getTodayReviewNotes("user-123")).rejects.toThrow(
      "DB connection failed",
    );
  });

  it("DB가 빈 배열을 반환하면 빈 결과를 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [], count: 0 },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    expect(result).toEqual({ notes: [], total: 0 });
  });
});

// ─── getReviewWaitingNotes ────────────────────────────────────────────────────

describe("getReviewWaitingNotes", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("미래 next_review_at을 가진 노트를 반환한다", async () => {
    const futureNote = {
      ...BASE_NOTE,
      next_review_at: "2026-05-08T10:00:00.000Z",
      review_round: 1,
    };
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [futureNote] },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([futureNote]);
  });

  it("next_review_at이 null이고 round가 0인 노트(미시작)를 반환한다", async () => {
    const newNote = {
      ...BASE_NOTE,
      next_review_at: null,
      review_round: 0,
    };
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [newNote] },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([newNote]);
  });

  it("DB 쿼리에서 완주 노트(null && round>0)를 제외하는 필터를 사용한다", async () => {
    const { supabase, callsFor } = createSupabaseQueryMock({
      notes: { data: [] },
    });
    createClientMock.mockResolvedValue(supabase);

    await getReviewWaitingNotes("user-123");

    expect(callsFor("notes")).toContainEqual([
      "or",
      [
        expect.stringContaining(
          "and(next_review_at.is.null,review_round.eq.0)",
        ),
      ],
    ]);
  });

  it("미시작 노트(null && round=0)와 미래 예약 노트를 함께 반환한다", async () => {
    const newNote = { ...BASE_NOTE, next_review_at: null, review_round: 0 };
    const futureNote = {
      ...BASE_NOTE,
      id: "22222222-2222-4222-8222-222222222222",
      next_review_at: "2026-05-08T10:00:00.000Z",
      review_round: 1,
    };
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [newNote, futureNote] },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([newNote, futureNote]);
  });

  it("스키마 파싱 실패 시 빈 배열을 반환한다", async () => {
    const { supabase } = createSupabaseQueryMock({
      notes: { data: [{ ...BASE_NOTE, id: "not-a-uuid" }] },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([]);
  });

  it("DB 쿼리 에러 발생 시 throw한다", async () => {
    const dbError = new Error("DB connection failed");
    const { supabase } = createSupabaseQueryMock({
      notes: { data: null, error: dbError },
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(getReviewWaitingNotes("user-123")).rejects.toThrow(
      "DB connection failed",
    );
  });
});
