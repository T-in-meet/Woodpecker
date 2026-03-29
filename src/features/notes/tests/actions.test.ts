import { beforeEach, describe, expect, it, vi } from "vitest";

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
}: {
  userId?: string | null;
  insertError?: { message: string } | null;
  insertedNoteId?: string;
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({
    data: insertError ? null : { id: insertedNoteId },
    error: insertError,
  });
  const selectMock = vi.fn().mockReturnValue({
    single: singleMock,
  });
  const insertMock = vi.fn().mockReturnValue({
    select: selectMock,
  });
  const fromMock = vi.fn().mockReturnValue({
    insert: insertMock,
  });

  return {
    insertMock,
    selectMock,
    singleMock,
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
    createClientMock.mockReset();
    redirectMock.mockReset();
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
    const { supabase, insertMock } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(insertMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("inserts a note and redirects when the payload is valid", async () => {
    const { supabase, insertMock, selectMock, singleMock, fromMock } =
      createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "javascript");

    await createNoteAction(null, formData);

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(insertMock).toHaveBeenCalledWith({
      title: "Valid title",
      content: "Valid content",
      language: "javascript",
      user_id: "user-123",
    });
    expect(selectMock).toHaveBeenCalledWith("id");
    expect(singleMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute("note-123"));
  });

  it("serializes an empty language as null for the insert payload", async () => {
    const { supabase, insertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "");

    await createNoteAction(null, formData);

    expect(insertMock).toHaveBeenCalledWith({
      title: "Valid title",
      content: "Valid content",
      language: null,
      user_id: "user-123",
    });
    expect(redirectMock).toHaveBeenCalledWith(getNoteDetailRoute("note-123"));
  });

  it("returns a general error when the insert fails", async () => {
    const { supabase, insertMock } = createSupabaseMock({
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
    expect(insertMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
