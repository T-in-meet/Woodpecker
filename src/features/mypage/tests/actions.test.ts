import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { deleteAvatarAction, uploadAvatarAction } from "../actions";
import { AVATAR_ALLOWED_TYPES, AVATAR_MAX_SIZE } from "../schema";

function makeFile(name: string, type: string, size: number): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function makeSupabaseMock({
  userId = "user-123",
  uploadError = null,
  removeError = null,
  updateError = null,
}: {
  userId?: string | null;
  uploadError?: { message: string } | null;
  removeError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const selectMock = vi.fn().mockResolvedValue({
    data: updateError
      ? null
      : { id: userId, avatar_url: "https://example.com/avatar" },
    error: updateError,
  });
  const singleMock = vi.fn(() => ({ data: null, error: updateError }));

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi
      .fn()
      .mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({
            data: updateError ? null : { id: userId },
            error: updateError,
          }),
      }),
  };

  const uploadMock = vi.fn().mockResolvedValue({ error: uploadError });
  const getPublicUrlMock = vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.com/avatars/user-123/avatar" },
  });
  const removeMock = vi.fn().mockResolvedValue({ error: removeError });

  return {
    uploadMock,
    removeMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
          remove: removeMock,
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue(updateChain),
      }),
    },
  };
}

describe("uploadAvatarAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("파일이 없으면 에러 반환", async () => {
    const formData = new FormData();
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({ error: "파일을 선택해주세요" });
  });

  it("빈 파일이면 에러 반환", async () => {
    const formData = new FormData();
    formData.set("avatar", new File([], "empty.jpg", { type: "image/jpeg" }));
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({ error: "파일을 선택해주세요" });
  });

  it("허용되지 않은 MIME 타입이면 에러 반환", async () => {
    const formData = new FormData();
    formData.set("avatar", makeFile("doc.pdf", "application/pdf", 1024));
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({
      error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다",
    });
  });

  it("5MB 초과 파일이면 에러 반환", async () => {
    const formData = new FormData();
    formData.set(
      "avatar",
      makeFile("big.jpg", "image/jpeg", AVATAR_MAX_SIZE + 1),
    );
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({ error: "파일 크기는 5MB 이하여야 합니다" });
  });

  it("정확히 5MB 파일은 통과한다", async () => {
    const { supabase } = makeSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("avatar", makeFile("ok.jpg", "image/jpeg", AVATAR_MAX_SIZE));
    const result = await uploadAvatarAction(null, formData);
    expect(result).not.toEqual(
      expect.objectContaining({ error: "파일 크기는 5MB 이하여야 합니다" }),
    );
  });

  it("모든 허용 MIME 타입을 통과시킨다", async () => {
    for (const mime of AVATAR_ALLOWED_TYPES) {
      const { supabase } = makeSupabaseMock();
      createClientMock.mockResolvedValue(supabase);

      const formData = new FormData();
      formData.set("avatar", makeFile("img", mime, 1024));
      const result = await uploadAvatarAction(null, formData);
      expect(result).not.toEqual(
        expect.objectContaining({
          error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다",
        }),
      );
    }
  });

  it("인증되지 않은 경우 에러 반환", async () => {
    const { supabase } = makeSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("avatar", makeFile("img.jpg", "image/jpeg", 1024));
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({ error: "인증이 필요합니다" });
  });

  it("storage 업로드 실패 시 에러 반환", async () => {
    const { supabase } = makeSupabaseMock({
      uploadError: { message: "upload failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const formData = new FormData();
    formData.set("avatar", makeFile("img.jpg", "image/jpeg", 1024));
    const result = await uploadAvatarAction(null, formData);
    expect(result).toEqual({ error: "이미지 업로드에 실패했습니다" });
  });
});

describe("deleteAvatarAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증되지 않은 경우 에러 반환", async () => {
    const { supabase } = makeSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteAvatarAction();
    expect(result).toEqual({ error: "인증이 필요합니다" });
  });

  it("storage 삭제 실패 시 에러 반환하고 DB 업데이트 안 함", async () => {
    const { supabase } = makeSupabaseMock({
      removeError: { message: "remove failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteAvatarAction();
    expect(result).toEqual({ error: "아바타 삭제에 실패했습니다" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
