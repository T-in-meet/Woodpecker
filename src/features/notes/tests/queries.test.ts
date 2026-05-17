import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ─── Mock 팩토리 ─────────────────────────────────────────────────────────────

function createNotesQueryMock(data: unknown, count = 0) {
  const rangeMock = vi.fn().mockResolvedValue({ data, count });
  const orMock = vi.fn().mockReturnValue({ range: rangeMock });
  const orderMock = vi.fn().mockReturnValue({ or: orMock, range: rangeMock });
  const eqMock = vi.fn().mockReturnValue({ order: orderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

  return {
    rangeMock,
    orMock,
    orderMock,
    eqMock,
    selectMock,
    supabase: {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    },
  };
}

function createNoteDetailQueryMock(
  data: unknown,
  pendingLog: { scheduled_at: string } | null = null,
) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data });
  const userEqMock = vi.fn().mockReturnValue({
    maybeSingle: maybeSingleMock,
  });
  const idEqMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });
  const noteSelectMock = vi.fn().mockReturnValue({
    eq: idEqMock,
  });

  const pendingMaybeSingleMock = vi
    .fn()
    .mockResolvedValue({ data: pendingLog });
  const pendingLimitMock = vi.fn().mockReturnValue({
    maybeSingle: pendingMaybeSingleMock,
  });
  const pendingOrderMock = vi.fn().mockReturnValue({
    limit: pendingLimitMock,
  });
  const pendingIsMock = vi.fn().mockReturnValue({
    order: pendingOrderMock,
  });
  const pendingUserEqMock = vi.fn().mockReturnValue({
    is: pendingIsMock,
  });
  const pendingNoteEqMock = vi.fn().mockReturnValue({
    eq: pendingUserEqMock,
  });
  const pendingSelectMock = vi.fn().mockReturnValue({
    eq: pendingNoteEqMock,
  });

  const fromMock = vi
    .fn()
    .mockImplementation((table: string) =>
      table === "review_logs"
        ? { select: pendingSelectMock }
        : { select: noteSelectMock },
    );

  return {
    idEqMock,
    maybeSingleMock,
    selectMock: noteSelectMock,
    userEqMock,
    pendingSelectMock,
    pendingNoteEqMock,
    pendingUserEqMock,
    pendingIsMock,
    pendingOrderMock,
    pendingLimitMock,
    pendingMaybeSingleMock,
    fromMock,
    supabase: {
      from: fromMock,
    },
  };
}

// .eq → .gte → .lt → .order → { data }
function createTodayNotesQueryMock(data: unknown) {
  const order2Mock = vi.fn().mockResolvedValue({ data });
  const order1Mock = vi.fn().mockReturnValue({ order: order2Mock });
  const ltMock = vi.fn().mockReturnValue({ order: order1Mock });
  const gteMock = vi.fn().mockReturnValue({ lt: ltMock });
  const eqMock = vi.fn().mockReturnValue({ gte: gteMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    orderMock: order1Mock,
    order2Mock,
    ltMock,
    gteMock,
    eqMock,
    selectMock,
    supabase: { from: vi.fn().mockReturnValue({ select: selectMock }) },
  };
}

// .eq → .or → .order → .limit → { data }
function createWaitingNotesQueryMock(data: unknown) {
  const limitMock = vi.fn().mockResolvedValue({ data });
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  const orMock = vi.fn().mockReturnValue({ order: orderMock });
  const eqMock = vi.fn().mockReturnValue({ or: orMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    limitMock,
    orderMock,
    orMock,
    eqMock,
    selectMock,
    supabase: { from: vi.fn().mockReturnValue({ select: selectMock }) },
  };
}

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
    const { supabase, selectMock, eqMock, orderMock, rangeMock } =
      createNotesQueryMock(notes, 2);

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(selectMock).toHaveBeenCalledWith(
      "id, title, content, next_review_at, review_round, created_at, updated_at",
      { count: "exact" },
    );
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(rangeMock).toHaveBeenCalledWith(0, 4);
    expect(result).toEqual({ notes, total: 2 });
  });

  it("returns an empty list when the query result does not match the schema", async () => {
    const { supabase } = createNotesQueryMock(
      [
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
      1,
    );

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(result).toEqual({ notes: [], total: 1 });
  });

  it("returns note detail with notification time of day and pending scheduled_at", async () => {
    const {
      supabase,
      selectMock,
      idEqMock,
      userEqMock,
      maybeSingleMock,
      pendingSelectMock,
      pendingNoteEqMock,
      pendingUserEqMock,
      pendingIsMock,
      pendingOrderMock,
      pendingLimitMock,
    } = createNoteDetailQueryMock(
      {
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
      { scheduled_at: "2026-03-30T12:30:00.000Z" },
    );

    createClientMock.mockResolvedValue(supabase);

    const result = await getNoteById(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(selectMock).toHaveBeenCalledWith(
      "id, title, content, next_review_at, notification_time_of_day, review_round, created_at, updated_at, user_id",
    );
    expect(idEqMock).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(userEqMock).toHaveBeenCalledWith(
      "user_id",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(maybeSingleMock).toHaveBeenCalledOnce();

    expect(pendingSelectMock).toHaveBeenCalledWith("scheduled_at");
    expect(pendingNoteEqMock).toHaveBeenCalledWith(
      "note_id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(pendingUserEqMock).toHaveBeenCalledWith(
      "user_id",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(pendingIsMock).toHaveBeenCalledWith("completed_at", null);
    expect(pendingOrderMock).toHaveBeenCalledWith("scheduled_at", {
      ascending: true,
    });
    expect(pendingLimitMock).toHaveBeenCalledWith(1);

    expect(result).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      notification_time_of_day: "21:30:00",
      next_scheduled_at: "2026-03-30T12:30:00.000Z",
    });
  });

  it("returns next_scheduled_at as null when no pending review_log exists", async () => {
    const { supabase } = createNoteDetailQueryMock(
      {
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
      null,
    );

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
    const { supabase, eqMock, gteMock, ltMock, orderMock, order2Mock } =
      createTodayNotesQueryMock([BASE_NOTE]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    expect(eqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(gteMock).toHaveBeenCalledWith("next_review_at", KST_START);
    expect(ltMock).toHaveBeenCalledWith("next_review_at", KST_END);
    expect(orderMock).toHaveBeenCalledWith("next_review_at", {
      ascending: true,
    });
    expect(order2Mock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([BASE_NOTE]);
  });

  it("스키마 파싱 실패 시 빈 배열을 반환한다", async () => {
    const { supabase } = createTodayNotesQueryMock([
      { ...BASE_NOTE, id: "not-a-uuid" },
    ]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    expect(result).toEqual([]);
  });

  it("DB가 빈 배열을 반환하면 빈 배열을 반환한다", async () => {
    const { supabase } = createTodayNotesQueryMock([]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getTodayReviewNotes("user-123");

    expect(result).toEqual([]);
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
    const { supabase } = createWaitingNotesQueryMock([futureNote]);
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
    const { supabase } = createWaitingNotesQueryMock([newNote]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([newNote]);
  });

  it("DB 쿼리에서 완주 노트(null && round>0)를 제외하는 필터를 사용한다", async () => {
    const { supabase, orMock } = createWaitingNotesQueryMock([]);
    createClientMock.mockResolvedValue(supabase);

    await getReviewWaitingNotes("user-123");

    expect(orMock).toHaveBeenCalledWith(
      expect.stringContaining("and(next_review_at.is.null,review_round.eq.0)"),
    );
  });

  it("미시작 노트(null && round=0)와 미래 예약 노트를 함께 반환한다", async () => {
    const newNote = { ...BASE_NOTE, next_review_at: null, review_round: 0 };
    const futureNote = {
      ...BASE_NOTE,
      id: "22222222-2222-4222-8222-222222222222",
      next_review_at: "2026-05-08T10:00:00.000Z",
      review_round: 1,
    };
    const { supabase } = createWaitingNotesQueryMock([newNote, futureNote]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([newNote, futureNote]);
  });

  it("스키마 파싱 실패 시 빈 배열을 반환한다", async () => {
    const { supabase } = createWaitingNotesQueryMock([
      { ...BASE_NOTE, id: "not-a-uuid" },
    ]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getReviewWaitingNotes("user-123");

    expect(result).toEqual([]);
  });
});
