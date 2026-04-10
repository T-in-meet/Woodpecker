import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { createNoteAction } from "../actions";

function createSupabaseMock({
  userId = "user-123",
  rpcError = null,
  rpcResult = "note-123",
}: {
  userId?: string | null;
  rpcError?: { message: string } | null;
  rpcResult?: string | null;
} = {}) {
  const rpcMock = vi.fn().mockResolvedValue({
    data: rpcError ? null : rpcResult,
    error: rpcError,
  });

  return {
    rpcMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: userId ? { id: userId } : null,
          },
        }),
      },
      rpc: rpcMock,
    },
  };
}

describe("createNoteAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    createClientMock.mockReset();
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
    const { supabase, rpcMock } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the note creation RPC and returns the new note id when the payload is valid", async () => {
    const { supabase, rpcMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "javascript");

    const result = await createNoteAction(null, formData);

    expect(rpcMock).toHaveBeenCalledWith(
      "create_note_with_initial_review_log",
      {
        p_title: "Valid title",
        p_content: "Valid content",
        p_language: "javascript",
        p_scheduled_at: "2026-01-02T00:00:00.000Z",
      },
    );
    expect(result).toEqual({ success: true, newNoteId: "note-123" });
  });

  it("omits language from the RPC payload when the language is empty", async () => {
    const { supabase, rpcMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "");

    const result = await createNoteAction(null, formData);

    expect(rpcMock).toHaveBeenCalledWith(
      "create_note_with_initial_review_log",
      {
        p_title: "Valid title",
        p_content: "Valid content",
        p_scheduled_at: "2026-01-02T00:00:00.000Z",
      },
    );
    expect(result).toEqual({ success: true, newNoteId: "note-123" });
  });

  it("returns a general error when the RPC fails", async () => {
    const { supabase, rpcMock } = createSupabaseMock({
      rpcError: { message: "rpc failed" },
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
    expect(rpcMock).toHaveBeenCalledOnce();
  });

  it("returns a general error when the RPC returns no note id", async () => {
    const { supabase, rpcMock } = createSupabaseMock({ rpcResult: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");
    formData.set("language", "markdown");

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({
      error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
  });
});
