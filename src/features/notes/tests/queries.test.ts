import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

import { getNoteById, getNotes } from "../queries";

function createNotesQueryMock(data: unknown) {
  const orderMock = vi.fn().mockResolvedValue({ data });
  const eqMock = vi.fn().mockReturnValue({
    order: orderMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: eqMock,
  });

  return {
    orderMock,
    eqMock,
    selectMock,
    supabase: {
      from: vi.fn().mockReturnValue({
        select: selectMock,
      }),
    },
  };
}

function createNoteDetailQueryMock(data: unknown) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data });
  const userEqMock = vi.fn().mockReturnValue({
    maybeSingle: maybeSingleMock,
  });
  const idEqMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: idEqMock,
  });

  return {
    idEqMock,
    maybeSingleMock,
    selectMock,
    userEqMock,
    supabase: {
      from: vi.fn().mockReturnValue({
        select: selectMock,
      }),
    },
  };
}

describe("getNotes", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns note summaries ordered by updated time", async () => {
    const { supabase, selectMock, eqMock, orderMock } = createNotesQueryMock([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "최근 노트",
        next_review_at: "2026-03-30T09:00:00.000Z",
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        next_review_at: null,
        review_round: 3,
        updated_at: "2026-03-28T12:00:00.000Z",
      },
    ]);

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(selectMock).toHaveBeenCalledWith(
      "id, title, next_review_at, review_round, updated_at",
    );
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "최근 노트",
        next_review_at: "2026-03-30T09:00:00.000Z",
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        next_review_at: null,
        review_round: 3,
        updated_at: "2026-03-28T12:00:00.000Z",
      },
    ]);
  });

  it("returns an empty list when the query result does not match the schema", async () => {
    const { supabase } = createNotesQueryMock([
      {
        id: "invalid-note-id",
        title: "잘못된 노트",
        next_review_at: null,
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
    ]);

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(result).toEqual([]);
  });

  it("returns note detail with notification time of day", async () => {
    const { supabase, selectMock, idEqMock, userEqMock, maybeSingleMock } =
      createNoteDetailQueryMock({
        id: "11111111-1111-4111-8111-111111111111",
        title: "알림 시간 노트",
        content: "note body",
        next_review_at: "2026-03-30T09:00:00.000Z",
        notification_time_of_day: "21:30:00",
        review_round: 1,
        created_at: "2026-03-29T00:00:00.000Z",
        updated_at: "2026-03-29T01:00:00.000Z",
        user_id: "22222222-2222-4222-8222-222222222222",
      });

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
    expect(result).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      notification_time_of_day: "21:30:00",
    });
  });
});
