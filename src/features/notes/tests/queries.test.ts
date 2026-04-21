import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

import { getNotes } from "../queries";

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

describe("getNotes", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("returns note summaries ordered by updated time", async () => {
    const { supabase, selectMock, eqMock, orderMock } = createNotesQueryMock([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "최근 노트",
        language: "markdown",
        next_review_at: "2026-03-30T09:00:00.000Z",
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        language: "typescript",
        next_review_at: null,
        review_round: 3,
        updated_at: "2026-03-28T12:00:00.000Z",
      },
    ]);

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(supabase.from).toHaveBeenCalledWith("notes");
    expect(selectMock).toHaveBeenCalledWith(
      "id, title, language, next_review_at, review_round, updated_at",
    );
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "최근 노트",
        language: "markdown",
        next_review_at: "2026-03-30T09:00:00.000Z",
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "이전 노트",
        language: "typescript",
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
        language: "markdown",
        next_review_at: null,
        review_round: 1,
        updated_at: "2026-03-29T12:00:00.000Z",
      },
    ]);

    createClientMock.mockResolvedValue(supabase);

    const result = await getNotes("user-123");

    expect(result).toEqual([]);
  });
});
