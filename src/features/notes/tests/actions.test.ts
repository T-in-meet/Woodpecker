import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const {
  createClientMock,
  redirectMock,
  generateNoteEmbeddingMock,
  resolveAiRuntimeEmbeddingConfigurationMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  generateNoteEmbeddingMock: vi.fn(),
  resolveAiRuntimeEmbeddingConfigurationMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/ai/rags/note/generate-embedding", () => ({
  generateNoteEmbedding: generateNoteEmbeddingMock,
}));

vi.mock("@/features/ai/runtimes/resolve-configuration", () => ({
  resolveAiRuntimeEmbeddingConfiguration:
    resolveAiRuntimeEmbeddingConfigurationMock,
}));

import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from "../actions";

function createSupabaseMock(
  input: {
    userId?: string | null;
    emailConfirmedAt?: string | null | undefined;
    rpcError?: { message: string } | null;
    rpcResult?: string | null;
    deleteError?: { message: string } | null;
    deletedNote?: { id: string } | null;
    updateError?: { message: string } | null;
    updatedNote?: { id: string } | null;
  } = {},
) {
  const {
    userId = "user-123",
    emailConfirmedAt,
    rpcError = null,
    rpcResult = "note-123",
    deleteError = null,
    deletedNote = { id: "11111111-1111-4111-8111-111111111111" },
    updateError = null,
    updatedNote = { id: "11111111-1111-4111-8111-111111111111" },
  } = input;
  const resolvedEmailConfirmedAt = Object.prototype.hasOwnProperty.call(
    input,
    "emailConfirmedAt",
  )
    ? emailConfirmedAt
    : "2026-03-29T00:00:00.000Z";

  const rpcMock = vi.fn().mockResolvedValue({
    data: rpcError ? null : rpcResult,
    error: rpcError,
  });
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: deleteError ? null : deletedNote,
    error: deleteError,
  });
  const selectMock = vi.fn().mockReturnValue({
    maybeSingle: maybeSingleMock,
  });
  const userEqMock = vi.fn().mockReturnValue({
    select: selectMock,
  });
  const noteEqMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });
  const deleteMock = vi.fn().mockReturnValue({
    eq: noteEqMock,
  });

  const updateMaybeSingleMock = vi.fn().mockResolvedValue({
    data: updateError ? null : updatedNote,
    error: updateError,
  });
  const updateSelectMock = vi.fn().mockReturnValue({
    maybeSingle: updateMaybeSingleMock,
  });
  const updateUserEqMock = vi.fn().mockReturnValue({
    select: updateSelectMock,
  });
  const updateNoteEqMock = vi.fn().mockReturnValue({
    eq: updateUserEqMock,
  });
  const updateMock = vi.fn().mockReturnValue({
    eq: updateNoteEqMock,
  });

  const fromMock = vi.fn().mockReturnValue({
    delete: deleteMock,
    update: updateMock,
  });

  return {
    rpcMock,
    fromMock,
    deleteMock,
    noteEqMock,
    userEqMock,
    selectMock,
    maybeSingleMock,
    updateMock,
    updateNoteEqMock,
    updateUserEqMock,
    updateSelectMock,
    updateMaybeSingleMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: userId
              ? { id: userId, email_confirmed_at: resolvedEmailConfirmedAt }
              : null,
          },
        }),
      },
      from: fromMock,
      rpc: rpcMock,
    },
  };
}

describe("createNoteAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    createClientMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
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

  it.each([null, undefined])(
    "redirects unverified emails to the resend-email route when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      const { supabase, rpcMock } = createSupabaseMock({
        emailConfirmedAt,
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Valid title");
      formData.set("content", "Valid content");

      await expect(createNoteAction(null, formData)).rejects.toBe(
        REDIRECT_ERROR,
      );

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it("calls the note creation RPC and returns the new note id when the payload is valid", async () => {
    const { supabase, rpcMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

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

    const result = await createNoteAction(null, formData);

    expect(result).toEqual({
      error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
  });
});

describe("deleteNoteAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an error when the note id is invalid", async () => {
    const result = await deleteNoteAction("invalid-note-id");

    expect(result).toEqual({ error: "삭제할 노트를 찾을 수 없습니다." });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns an auth error when the user is not logged in", async () => {
    const { supabase, fromMock } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteNoteAction(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "redirects unverified emails to the resend-email route when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      const { supabase, fromMock } = createSupabaseMock({
        emailConfirmedAt,
      });
      createClientMock.mockResolvedValue(supabase);

      await expect(
        deleteNoteAction("11111111-1111-4111-8111-111111111111"),
      ).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it("deletes the note and redirects to the notes page", async () => {
    const validNoteId = "11111111-1111-4111-8111-111111111111";
    const {
      supabase,
      fromMock,
      deleteMock,
      noteEqMock,
      userEqMock,
      selectMock,
    } = createSupabaseMock({
      deletedNote: { id: validNoteId },
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(deleteNoteAction(validNoteId)).rejects.toBe(REDIRECT_ERROR);

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(deleteMock).toHaveBeenCalledOnce();
    expect(noteEqMock).toHaveBeenCalledWith("id", validNoteId);
    expect(userEqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(selectMock).toHaveBeenCalledWith("id");
    expect(redirectMock).toHaveBeenCalledWith(ROUTES.NOTES);
  });

  it("returns a not-found error when no matching note is deleted", async () => {
    const { supabase, maybeSingleMock } = createSupabaseMock({
      deletedNote: null,
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteNoteAction(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual({ error: "삭제할 노트를 찾을 수 없습니다." });
    expect(maybeSingleMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns a general error when note deletion fails", async () => {
    const { supabase, maybeSingleMock } = createSupabaseMock({
      deleteError: { message: "delete failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteNoteAction(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual({
      error: "노트 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(maybeSingleMock).toHaveBeenCalledOnce();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("updateNoteAction", () => {
  const validNoteId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    createClientMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an error when the note id is invalid", async () => {
    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

    const result = await updateNoteAction("invalid-note-id", null, formData);

    expect(result).toEqual({ error: "수정할 노트를 찾을 수 없습니다." });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid note data", async () => {
    const formData = new FormData();
    formData.set("title", "");
    formData.set("content", "");

    const result = await updateNoteAction(validNoteId, null, formData);

    expect(result).toMatchObject({
      error: expect.objectContaining({
        title: expect.any(Array),
        content: expect.any(Array),
      }),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns an auth error when the user is not logged in", async () => {
    const { supabase, fromMock } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Valid title");
    formData.set("content", "Valid content");

    const result = await updateNoteAction(validNoteId, null, formData);

    expect(result).toEqual({ error: "로그인이 필요합니다." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "redirects unverified emails to the resend-email route when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      const { supabase, fromMock } = createSupabaseMock({
        emailConfirmedAt,
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Valid title");
      formData.set("content", "Valid content");

      await expect(updateNoteAction(validNoteId, null, formData)).rejects.toBe(
        REDIRECT_ERROR,
      );

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it("updates the note title and content for the owning user", async () => {
    const {
      supabase,
      fromMock,
      updateMock,
      updateNoteEqMock,
      updateUserEqMock,
      updateSelectMock,
    } = createSupabaseMock({
      updatedNote: { id: validNoteId },
    });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Updated title");
    formData.set("content", "Updated content");

    const result = await updateNoteAction(validNoteId, null, formData);

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(updateMock).toHaveBeenCalledWith({
      title: "Updated title",
      content: "Updated content",
    });
    expect(updateNoteEqMock).toHaveBeenCalledWith("id", validNoteId);
    expect(updateUserEqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(updateSelectMock).toHaveBeenCalledWith("id");
    expect(result).toEqual({ success: true });
  });

  it("returns a not-found error when no matching note is updated", async () => {
    const { supabase, updateMaybeSingleMock } = createSupabaseMock({
      updatedNote: null,
    });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Updated title");
    formData.set("content", "Updated content");

    const result = await updateNoteAction(validNoteId, null, formData);

    expect(result).toEqual({ error: "수정할 노트를 찾을 수 없습니다." });
    expect(updateMaybeSingleMock).toHaveBeenCalledOnce();
  });

  it("returns a general error when note update fails", async () => {
    const { supabase, updateMaybeSingleMock } = createSupabaseMock({
      updateError: { message: "update failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("title", "Updated title");
    formData.set("content", "Updated content");

    const result = await updateNoteAction(validNoteId, null, formData);

    expect(result).toEqual({
      error: "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    expect(updateMaybeSingleMock).toHaveBeenCalledOnce();
  });
});

/**
 * Note 저장 Action과 AI embedding lifecycle의 연동을 검증합니다.
 *
 * 기존 Note Action 테스트와 분리하여, Note Chat의 note-retrieval
 * Runtime Configuration을 사용하고 저장된 Note를 embedding하는 계약만 검증합니다.
 */
describe("Note embedding integration", () => {
  const validNoteId = "11111111-1111-4111-8111-111111111111";

  const embeddingConfiguration = {
    model: {
      id: "embedding-model-id",
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
    },
  } as AiRuntimeEmbeddingConfiguration;

  beforeEach(() => {
    createClientMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });

    generateNoteEmbeddingMock.mockReset();
    resolveAiRuntimeEmbeddingConfigurationMock.mockReset();

    resolveAiRuntimeEmbeddingConfigurationMock.mockResolvedValue(
      embeddingConfiguration,
    );
    generateNoteEmbeddingMock.mockResolvedValue({
      id: "embedding-id",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createNoteAction", () => {
    it("Note 생성 후 note-retrieval Runtime Configuration으로 embedding을 생성한다", async () => {
      const { supabase } = createSupabaseMock({
        rpcResult: validNoteId,
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Valid title");
      formData.set("content", "Valid content");

      const result = await createNoteAction(null, formData);

      expect(result).toEqual({
        success: true,
        newNoteId: validNoteId,
      });

      // Note Chat의 검색에 사용하는 note-retrieval 설정과 동일한
      // Embedding Runtime Configuration을 사용해야 Note와 질의의 vector 공간이 일치한다.
      expect(resolveAiRuntimeEmbeddingConfigurationMock).toHaveBeenCalledWith({
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
      });

      expect(generateNoteEmbeddingMock).toHaveBeenCalledWith({
        embeddingConfiguration,
        ownerUserId: "user-123",
        noteId: validNoteId,
        title: "Valid title",
        content: "Valid content",
      });
    });

    it("Note 생성에 실패하면 embedding을 생성하지 않는다", async () => {
      const { supabase } = createSupabaseMock({
        rpcError: { message: "rpc failed" },
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Valid title");
      formData.set("content", "Valid content");

      const result = await createNoteAction(null, formData);

      expect(result).toEqual({
        error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });

      expect(resolveAiRuntimeEmbeddingConfigurationMock).not.toHaveBeenCalled();
      expect(generateNoteEmbeddingMock).not.toHaveBeenCalled();
    });

    it("Note 생성 후 embedding 생성에 실패해도 Note 생성 성공을 반환한다", async () => {
      const { supabase } = createSupabaseMock({
        rpcResult: validNoteId,
      });
      createClientMock.mockResolvedValue(supabase);

      generateNoteEmbeddingMock.mockRejectedValueOnce(
        new Error("embedding generation failed"),
      );

      const formData = new FormData();
      formData.set("title", "Valid title");
      formData.set("content", "Valid content");

      const result = await createNoteAction(null, formData);

      expect(result).toEqual({
        success: true,
        newNoteId: validNoteId,
      });

      expect(generateNoteEmbeddingMock).toHaveBeenCalledWith({
        embeddingConfiguration,
        ownerUserId: "user-123",
        noteId: validNoteId,
        title: "Valid title",
        content: "Valid content",
      });
    });
  });

  describe("updateNoteAction", () => {
    it("Note 수정 후 note-retrieval Runtime Configuration으로 embedding을 생성한다", async () => {
      const { supabase } = createSupabaseMock({
        updatedNote: { id: validNoteId },
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Updated title");
      formData.set("content", "Updated content");

      const result = await updateNoteAction(validNoteId, null, formData);

      expect(result).toEqual({ success: true });

      // 수정된 Note도 생성 시와 동일한 note-retrieval 설정을 사용하여
      // Note embedding과 Note Chat 질의 embedding의 모델을 일치시킨다.
      expect(resolveAiRuntimeEmbeddingConfigurationMock).toHaveBeenCalledWith({
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
      });

      expect(generateNoteEmbeddingMock).toHaveBeenCalledWith({
        embeddingConfiguration,
        ownerUserId: "user-123",
        noteId: validNoteId,
        title: "Updated title",
        content: "Updated content",
      });
    });

    it("Note 수정에 실패하면 embedding을 생성하지 않는다", async () => {
      const { supabase } = createSupabaseMock({
        updatedNote: null,
      });
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("title", "Updated title");
      formData.set("content", "Updated content");

      const result = await updateNoteAction(validNoteId, null, formData);

      expect(result).toEqual({
        error: "수정할 노트를 찾을 수 없습니다.",
      });

      expect(resolveAiRuntimeEmbeddingConfigurationMock).not.toHaveBeenCalled();
      expect(generateNoteEmbeddingMock).not.toHaveBeenCalled();
    });

    it("Note 수정 후 embedding 생성에 실패해도 Note 수정 성공을 반환한다", async () => {
      const { supabase } = createSupabaseMock({
        updatedNote: { id: validNoteId },
      });
      createClientMock.mockResolvedValue(supabase);

      generateNoteEmbeddingMock.mockRejectedValueOnce(
        new Error("embedding generation failed"),
      );

      const formData = new FormData();
      formData.set("title", "Updated title");
      formData.set("content", "Updated content");

      const result = await updateNoteAction(validNoteId, null, formData);

      expect(result).toEqual({ success: true });

      expect(generateNoteEmbeddingMock).toHaveBeenCalledWith({
        embeddingConfiguration,
        ownerUserId: "user-123",
        noteId: validNoteId,
        title: "Updated title",
        content: "Updated content",
      });
    });
  });
});
