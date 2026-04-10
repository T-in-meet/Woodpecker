import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute } from "@/lib/constants/routes";

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { createNoteAction } from "../actions";

function createSupabaseMock({
  userId = "user-123",
  insertError = null,
  insertedNoteId = "note-123",
  reviewLogInsertError = null,
}: {
  userId?: string | null;
  insertError?: { message: string } | null;
  insertedNoteId?: string;
  reviewLogInsertError?: { message: string } | null;
} = {}) {
  const noteSingleMock = vi.fn().mockResolvedValue({
    data: insertError ? null : { id: insertedNoteId },
    error: insertError,
  });
  const noteSelectMock = vi.fn().mockReturnValue({
    single: noteSingleMock,
  });
  const noteInsertMock = vi.fn().mockReturnValue({
    select: noteSelectMock,
  });
  const noteUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const noteUpdateMock = vi.fn().mockReturnValue({ eq: noteUpdateEqMock });
  const reviewLogInsertMock = vi.fn().mockResolvedValue({
    error: reviewLogInsertError,
  });
  const fromMock = vi.fn((table: string) => {
    if (table === "review_logs") {
      return {
        insert: reviewLogInsertMock,
      };
    }

    return {
      insert: noteInsertMock,
      update: noteUpdateMock,
    };
  });

  return {
    noteInsertMock,
    noteSelectMock,
    noteSingleMock,
    noteUpdateMock,
    noteUpdateEqMock,
    reviewLogInsertMock,
    fromMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: userId ? { id: userId } : null,
          },
        }),
      },
      from: fromMock,
    },
  };
}

describe("createNoteAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    createClientMock.mockReset();
    redirectMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns field errors for invalid note data", async () => {
    const formData = new FormData();
    formData.set("title", "");
    formData.set("content", "");

    const result = await createNoteAction(null, formData);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      error: expect.objectContaining({
        title: expect.any(Array),
        content: expect.any(Array),
      }),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a language error for unsupported languages", async () => {
    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "ruby");

    const result = await createNoteAction(null, formData);

    expect(result).toMatchObject({
      error: expect.objectContaining({
        language: expect.any(Array),
      }),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns an auth error when the user is not logged in", async () => {
    const { supabase, noteInsertMock } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(noteInsertMock).not.toHaveBeenCalled();
  });

  it("inserts a note and redirects when the payload is valid", async () => {
    const {
      supabase,
      noteInsertMock,
      noteSelectMock,
      noteSingleMock,
      reviewLogInsertMock,
      fromMock,
    } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "javascript");

    await createNoteAction(null, formData);

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(noteInsertMock).toHaveBeenCalledWith({
      title: "Valid title",
      content: "Valid content",
      language: "javascript",
      next_review_at: "2026-01-02T00:00:00.000Z",
      user_id: "user-123",
    });
    expect(noteSelectMock).toHaveBeenCalledWith("id");
    expect(noteSingleMock).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenCalledWith("review_logs");
    expect(reviewLogInsertMock).toHaveBeenCalledWith({
      note_id: "note-123",
      user_id: "user-123",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
    });
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute("note-123"));
  });

  it("serializes an empty language as null for the insert payload", async () => {
    const { supabase, noteInsertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "");

    await createNoteAction(null, formData);

    expect(noteInsertMock).toHaveBeenCalledWith({
      title: "Valid title",
      content: "Valid content",
      language: null,
      next_review_at: "2026-01-02T00:00:00.000Z",
      user_id: "user-123",
    });
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute("note-123"));
  });

  it("rolls back next_review_at and still redirects when review log scheduling fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { supabase, reviewLogInsertMock, noteUpdateMock, noteUpdateEqMock } =
      createSupabaseMock({
        reviewLogInsertError: { message: "review log failed" },
      });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "markdown");

    await createNoteAction(null, formData);

    expect(reviewLogInsertMock).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to create initial review log",
      expect.objectContaining({
        noteId: "note-123",
        userId: "user-123",
        error: { message: "review log failed" },
      }),
    );
    expect(noteUpdateMock).toHaveBeenCalledWith({ next_review_at: null });
    expect(noteUpdateEqMock).toHaveBeenCalledWith("id", "note-123");
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute("note-123"));
  });

  it("returns a general error when the insert fails", async () => {
    const { supabase, noteInsertMock, reviewLogInsertMock } =
      createSupabaseMock({
        insertError: { message: "insert failed" },
      });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "markdown");

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({
      error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(noteInsertMock).toHaveBeenCalledOnce();
    expect(reviewLogInsertMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
