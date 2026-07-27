import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import {
  createFeedbackAction,
  deleteAvatarAction,
  deleteFeedbackAction,
  uploadAvatarAction,
} from "../actions";
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_SIZE,
  FEEDBACK_DAILY_LIMIT_MESSAGE,
  FEEDBACK_IMAGE_MAX_SIZE,
} from "../schema";

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
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
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

  it("storage 삭제 실패 시 DB 업데이트 후 data 반환", async () => {
    const { supabase } = makeSupabaseMock({
      removeError: { message: "remove failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteAvatarAction();
    expect(result).toEqual({ data: { id: "user-123" } });
    expect(supabase.from).toHaveBeenCalled();
  });

  it("DB 업데이트 실패 시 에러 반환하고 storage 삭제 안 함", async () => {
    const { supabase } = makeSupabaseMock({
      updateError: { message: "update failed" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteAvatarAction();
    expect(result).toEqual({ error: "아바타 삭제에 실패했습니다" });
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
});

// ---- 피드백 (#266) ----

function makeFeedbackSupabaseMock({
  userId = "user-123",
  todayRows = [] as { id: string }[],
  todayError = null as { message: string } | null,
  insertError = null as { message: string; code?: string } | null,
  uploadError = null as { message: string } | null,
  deletedRows = [] as { id: string; image_urls: string[] }[],
  deleteError = null as { message: string } | null,
} = {}) {
  const insertedRow = { id: "feedback-1" };

  const limitMock = vi.fn().mockResolvedValue({
    data: todayError ? null : todayRows,
    error: todayError,
  });
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: limitMock,
  };

  const insertSingle = vi.fn().mockResolvedValue({
    data: insertError ? null : insertedRow,
    error: insertError,
  });
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: insertSingle }),
  });

  const deleteSelect = vi.fn().mockResolvedValue({
    data: deleteError ? null : deletedRows,
    error: deleteError,
  });
  const deleteMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ select: deleteSelect }),
    }),
  });

  const uploadMock = vi.fn().mockResolvedValue({ error: uploadError });
  const removeMock = vi.fn().mockResolvedValue({ error: null });

  return {
    insertMock,
    uploadMock,
    removeMock,
    deleteMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: uploadMock,
          remove: removeMock,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
        insert: insertMock,
        delete: deleteMock,
      }),
    },
  };
}

function makeFeedbackFormData({
  category = "BUG",
  title = "버그 신고",
  content = "버튼이 동작하지 않습니다",
  noteId = "",
  images = [] as File[],
} = {}) {
  const formData = new FormData();
  formData.set("category", category);
  formData.set("title", title);
  formData.set("content", content);
  formData.set("noteId", noteId);
  for (const file of images) {
    formData.append("images", file);
  }
  return formData;
}

describe("createFeedbackAction", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("스키마 검증 실패 시 fieldErrors 반환", async () => {
    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({ title: "" }),
    );
    expect(result.error).toBeTypeOf("object");
    expect((result.error as { title?: string[] }).title?.[0]).toBe(
      "제목을 입력해주세요",
    );
  });

  it("이미지 3장 초과 시 에러 반환", async () => {
    const images = Array.from({ length: 4 }, (_, i) =>
      makeFile(`img-${i}.png`, "image/png", 1024),
    );
    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({ images }),
    );
    expect(result).toEqual({
      error: "이미지는 최대 3장까지 첨부할 수 있습니다",
    });
  });

  it("허용되지 않은 이미지 형식이면 에러 반환", async () => {
    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({
        images: [makeFile("doc.pdf", "application/pdf", 1024)],
      }),
    );
    expect(result).toEqual({
      error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다",
    });
  });

  it("5MB 초과 이미지면 에러 반환", async () => {
    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({
        images: [makeFile("big.png", "image/png", FEEDBACK_IMAGE_MAX_SIZE + 1)],
      }),
    );
    expect(result).toEqual({ error: "이미지 크기는 장당 5MB 이하여야 합니다" });
  });

  it("인증되지 않은 경우 에러 반환", async () => {
    const { supabase } = makeFeedbackSupabaseMock({ userId: null as never });
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(null, makeFeedbackFormData());
    expect(result).toEqual({ error: "인증이 필요합니다" });
  });

  it("오늘 이미 제출한 경우 일일 제한 에러 반환하고 insert하지 않는다", async () => {
    const { supabase, insertMock } = makeFeedbackSupabaseMock({
      todayRows: [{ id: "feedback-0" }],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(null, makeFeedbackFormData());
    expect(result).toEqual({ error: FEEDBACK_DAILY_LIMIT_MESSAGE });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("업로드 실패 시 이미 업로드된 이미지를 정리하고 에러 반환", async () => {
    const { supabase, uploadMock, removeMock, insertMock } =
      makeFeedbackSupabaseMock();
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "upload failed" } });
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({
        images: [
          makeFile("a.png", "image/png", 1024),
          makeFile("b.png", "image/png", 1024),
        ],
      }),
    );

    expect(result).toEqual({ error: "이미지 업로드에 실패했습니다" });
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock.mock.calls[0]?.[0]).toHaveLength(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("insert가 unique 위반(23505)이면 일일 제한 에러로 변환하고 이미지를 정리한다", async () => {
    const { supabase, removeMock } = makeFeedbackSupabaseMock({
      insertError: { message: "duplicate", code: "23505" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({ images: [makeFile("a.png", "image/png", 1024)] }),
    );

    expect(result).toEqual({ error: FEEDBACK_DAILY_LIMIT_MESSAGE });
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("insert 기타 실패 시 일반 에러 반환", async () => {
    const { supabase } = makeFeedbackSupabaseMock({
      insertError: { message: "boom" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(null, makeFeedbackFormData());
    expect(result).toEqual({ error: "문의사항 제출에 실패했습니다" });
  });

  it("성공 시 data 반환하고 입력값대로 insert한다", async () => {
    const noteId = "550e8400-e29b-41d4-a716-446655440000";
    const { supabase, insertMock, uploadMock } = makeFeedbackSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const result = await createFeedbackAction(
      null,
      makeFeedbackFormData({
        category: "FEATURE",
        title: "제안",
        content: "다크 모드 추가해주세요",
        noteId,
        images: [makeFile("a.png", "image/png", 1024)],
      }),
    );

    expect(result).toEqual({ data: { id: "feedback-1" } });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        note_id: noteId,
        category: "FEATURE",
        title: "제안",
        content: "다크 모드 추가해주세요",
        image_urls: expect.arrayContaining([
          expect.stringMatching(/^user-123\/.+\.png$/),
        ]),
      }),
    );
  });

  it("noteId가 빈 문자열이면 null로 insert한다", async () => {
    const { supabase, insertMock } = makeFeedbackSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    await createFeedbackAction(null, makeFeedbackFormData({ noteId: "" }));

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ note_id: null }),
    );
  });
});

describe("deleteFeedbackAction", () => {
  const feedbackId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    createClientMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uuid가 아니면 에러 반환", async () => {
    const result = await deleteFeedbackAction("not-a-uuid");
    expect(result).toEqual({ error: "잘못된 요청입니다" });
  });

  it("인증되지 않은 경우 에러 반환", async () => {
    const { supabase } = makeFeedbackSupabaseMock({ userId: null as never });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteFeedbackAction(feedbackId);
    expect(result).toEqual({ error: "인증이 필요합니다" });
  });

  it("삭제 쿼리 실패 시 에러 반환", async () => {
    const { supabase } = makeFeedbackSupabaseMock({
      deleteError: { message: "boom" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteFeedbackAction(feedbackId);
    expect(result).toEqual({ error: "문의사항 삭제에 실패했습니다" });
  });

  it("삭제된 행이 없으면(답변 존재 등) 에러 반환하고 storage 정리 안 함", async () => {
    const { supabase, removeMock } = makeFeedbackSupabaseMock({
      deletedRows: [],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteFeedbackAction(feedbackId);
    expect(result).toEqual({
      error:
        "삭제할 수 없습니다. 답변이 등록되었거나 이미 삭제된 문의사항입니다",
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("성공 시 data 반환하고 첨부 이미지를 정리한다", async () => {
    const paths = ["user-123/feedback-1/a.png", "user-123/feedback-1/b.png"];
    const { supabase, removeMock } = makeFeedbackSupabaseMock({
      deletedRows: [{ id: feedbackId, image_urls: paths }],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteFeedbackAction(feedbackId);
    expect(result).toEqual({ data: { success: true } });
    expect(removeMock).toHaveBeenCalledWith(paths);
  });

  it("첨부 이미지가 없으면 storage 정리를 호출하지 않는다", async () => {
    const { supabase, removeMock } = makeFeedbackSupabaseMock({
      deletedRows: [{ id: feedbackId, image_urls: [] }],
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await deleteFeedbackAction(feedbackId);
    expect(result).toEqual({ data: { success: true } });
    expect(removeMock).not.toHaveBeenCalled();
  });
});
