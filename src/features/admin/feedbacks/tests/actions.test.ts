import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  requireAdminMock,
  safeParseMock,
  validateFeedbackReplyImageFilesMock,
  validateFeedbackReplyImageFileSignaturesMock,
  createFeedbackReplyImagePathMock,
  createUserNotificationMock,
  buildFeedbackReplyNotificationDefinitionMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  requireAdminMock: vi.fn(),
  safeParseMock: vi.fn(),
  validateFeedbackReplyImageFilesMock: vi.fn(),
  validateFeedbackReplyImageFileSignaturesMock: vi.fn(),
  createFeedbackReplyImagePathMock: vi.fn(),
  createUserNotificationMock: vi.fn(),
  buildFeedbackReplyNotificationDefinitionMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/features/admin/feedbacks/schema", () => ({
  feedbackReplyFormSchema: {
    safeParse: safeParseMock,
  },
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-reply-image", () => ({
  validateFeedbackReplyImageFiles: validateFeedbackReplyImageFilesMock,
  validateFeedbackReplyImageFileSignatures:
    validateFeedbackReplyImageFileSignaturesMock,
  createFeedbackReplyImagePath: createFeedbackReplyImagePathMock,
}));

vi.mock("@/features/notifications/create-user-notification", () => ({
  createUserNotification: createUserNotificationMock,
}));

vi.mock("@/features/notifications/definitions", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/notifications/definitions")
    >();

  return {
    ...actual,
    buildFeedbackReplyNotificationDefinition:
      buildFeedbackReplyNotificationDefinitionMock,
  };
});

import { deleteFeedbackReply, saveFeedbackReply } from "../actions";

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type SupabaseMockOptions = {
  feedbackResult?: QueryResult<{
    id: string;
    title: string;
    user_id: string;
  } | null>;
  existingReplyResult?: QueryResult<{ image_paths: string[] } | null>;
  replyLoadResult?: QueryResult<{
    id: string;
    image_paths: string[];
  } | null>;
  uploadErrors?: Array<{ message: string } | null>;
  upsertError?: { message: string } | null;
  resolvedStatusError?: { message: string } | null;
  deleteError?: { message: string } | null;
  openStatusError?: { message: string } | null;
  removeErrors?: Array<{ message: string } | null>;
};

/**
 * actions에서 사용하는 Supabase 체이닝만 최소한으로 구현합니다.
 */
function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const feedbackResult = options.feedbackResult ?? {
    data: {
      id: "feedback-1",
      title: "테스트 피드백",
      user_id: "user-1",
    },
    error: null,
  };

  const existingReplyResult = options.existingReplyResult ?? {
    data: null,
    error: null,
  };

  const replyLoadResult = options.replyLoadResult ?? {
    data: {
      id: "reply-1",
      image_paths: [],
    },
    error: null,
  };

  let uploadIndex = 0;
  let removeIndex = 0;

  const feedbackSingleMock = vi.fn().mockResolvedValue(feedbackResult);
  const feedbackSelectEqMock = vi.fn(() => ({
    single: feedbackSingleMock,
  }));
  const feedbackSelectMock = vi.fn(() => ({
    eq: feedbackSelectEqMock,
  }));

  const existingReplyMaybeSingleMock = vi
    .fn()
    .mockResolvedValue(existingReplyResult);
  const existingReplySelectEqMock = vi.fn(() => ({
    maybeSingle: existingReplyMaybeSingleMock,
  }));

  const replyLoadMaybeSingleMock = vi.fn().mockResolvedValue(replyLoadResult);
  const replyLoadSelectEqMock = vi.fn(() => ({
    maybeSingle: replyLoadMaybeSingleMock,
  }));

  const upsertMock = vi.fn().mockResolvedValue({
    error: options.upsertError ?? null,
  });

  const deleteEqMock = vi.fn().mockResolvedValue({
    error: options.deleteError ?? null,
  });
  const deleteMock = vi.fn(() => ({
    eq: deleteEqMock,
  }));

  const resolvedStatusEqMock = vi.fn().mockResolvedValue({
    error: options.resolvedStatusError ?? null,
  });
  const openStatusEqMock = vi.fn().mockResolvedValue({
    error: options.openStatusError ?? null,
  });

  const updateMock = vi.fn(
    (values: {
      status: "RESOLVED" | "OPEN";
    }): { eq: typeof resolvedStatusEqMock | typeof openStatusEqMock } => {
      if (values.status === "RESOLVED") {
        return { eq: resolvedStatusEqMock };
      }

      return { eq: openStatusEqMock };
    },
  );

  const feedbackRepliesSelectMock = vi.fn(
    (
      columns: string,
    ): {
      eq: typeof existingReplySelectEqMock | typeof replyLoadSelectEqMock;
    } => {
      if (columns === "image_paths") {
        return { eq: existingReplySelectEqMock };
      }

      return { eq: replyLoadSelectEqMock };
    },
  );

  const uploadMock = vi.fn().mockImplementation(async () => {
    const error = options.uploadErrors?.[uploadIndex] ?? null;
    uploadIndex += 1;

    return { error };
  });

  const removeMock = vi.fn().mockImplementation(async () => {
    const error = options.removeErrors?.[removeIndex] ?? null;
    removeIndex += 1;

    return { error };
  });

  const storageFromMock = vi.fn(() => ({
    upload: uploadMock,
    remove: removeMock,
  }));

  const fromMock = vi.fn((table: string) => {
    if (table === "feedbacks") {
      return {
        select: feedbackSelectMock,
        update: updateMock,
      };
    }

    if (table === "feedback_replies") {
      return {
        select: feedbackRepliesSelectMock,
        upsert: upsertMock,
        delete: deleteMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: {
      from: fromMock,
      storage: {
        from: storageFromMock,
      },
    },
    mocks: {
      fromMock,
      feedbackSingleMock,
      existingReplyMaybeSingleMock,
      replyLoadMaybeSingleMock,
      upsertMock,
      updateMock,
      resolvedStatusEqMock,
      openStatusEqMock,
      deleteMock,
      deleteEqMock,
      storageFromMock,
      uploadMock,
      removeMock,
    },
  };
}

function createValidFormData() {
  const formData = new FormData();

  formData.set("title", "관리자 답변 제목");
  formData.set("content", "관리자 답변 내용");

  return formData;
}

describe("saveFeedbackReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue("admin-1");
    safeParseMock.mockReturnValue({
      success: true,
      data: {
        title: "관리자 답변 제목",
        content: "관리자 답변 내용",
      },
    });
    validateFeedbackReplyImageFilesMock.mockReturnValue(null);
    validateFeedbackReplyImageFileSignaturesMock.mockResolvedValue(null);
    createFeedbackReplyImagePathMock.mockImplementation(
      (feedbackId: string, file: File) => `${feedbackId}/${file.name}`,
    );
    buildFeedbackReplyNotificationDefinitionMock.mockReturnValue({
      clickPath: "/feedbacks/feedback-1",
    });

    createUserNotificationMock.mockResolvedValue({
      ok: true,
    });
  });

  it("입력값 검증에 실패하면 필드 오류를 반환하고 DB에 접근하지 않는다", async () => {
    safeParseMock.mockReturnValue({
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: {
            title: ["제목을 입력해 주세요."],
          },
        }),
      },
    });

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({
      ok: false,
      message: "입력값을 확인해 주세요.",
      fieldErrors: {
        title: ["제목을 입력해 주세요."],
      },
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("이미지 검증에 실패하면 검증 메시지를 반환하고 DB에 접근하지 않는다", async () => {
    validateFeedbackReplyImageFilesMock.mockReturnValue(
      "이미지는 최대 5개까지 등록할 수 있습니다.",
    );

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({
      ok: false,
      message: "이미지는 최대 5개까지 등록할 수 있습니다.",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("이미지 시그니처 검증에 실패하면 검증 메시지를 반환하고 DB에 접근하지 않는다", async () => {
    validateFeedbackReplyImageFileSignaturesMock.mockResolvedValue(
      "이미지 파일 형식이 올바르지 않습니다.",
    );

    const formData = createValidFormData();

    formData.append(
      "images",
      new File(["text"], "image.png", {
        type: "image/png",
      }),
    );

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({
      ok: false,
      message: "이미지 파일 형식이 올바르지 않습니다.",
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("피드백을 찾지 못하면 저장을 중단한다", async () => {
    const supabase = createSupabaseMock({
      feedbackResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({
      ok: false,
      message: "피드백을 찾을 수 없습니다.",
    });
    expect(supabase.mocks.upsertMock).not.toHaveBeenCalled();
    expect(supabase.mocks.uploadMock).not.toHaveBeenCalled();
  });

  it("답변을 저장하고 피드백 상태를 RESOLVED로 변경한다", async () => {
    const supabase = createSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({ ok: true });
    expect(requireAdminMock).toHaveBeenCalledOnce();

    expect(supabase.mocks.upsertMock).toHaveBeenCalledWith(
      {
        feedback_id: "feedback-1",
        title: "관리자 답변 제목",
        content: "관리자 답변 내용",
        image_paths: [],
        created_by: "admin-1",
      },
      { onConflict: "feedback_id" },
    );

    expect(supabase.mocks.updateMock).toHaveBeenCalledWith({
      status: "RESOLVED",
    });
    expect(supabase.mocks.resolvedStatusEqMock).toHaveBeenCalledWith(
      "id",
      "feedback-1",
    );
  });

  it("최초 답변 저장 시 사용자 알림을 생성한다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({ ok: true });

    expect(buildFeedbackReplyNotificationDefinitionMock).toHaveBeenCalledWith({
      feedbackId: "feedback-1",
    });

    expect(createUserNotificationMock).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      body: '"테스트 피드백" 피드백에 관리자 답변이 등록되었습니다.',
      clickPath: "/feedbacks/feedback-1",
      metadata: {
        feedbackId: "feedback-1",
      },
      operation: "feedback_reply_notification",
      pushEnabled: expect.any(Boolean),
      title: "피드백에 답변이 등록되었습니다.",
      type: expect.any(String),
      userId: "user-1",
    });
  });

  it("기존 답변 수정 시 알림을 선택하지 않으면 사용자 알림을 생성하지 않는다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: {
          image_paths: [],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({ ok: true });
    expect(buildFeedbackReplyNotificationDefinitionMock).not.toHaveBeenCalled();
    expect(createUserNotificationMock).not.toHaveBeenCalled();
  });

  it("기존 답변 수정 시 알림을 선택하면 수정 알림을 생성한다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: {
          image_paths: [],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.set("notifyUser", "true");

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({ ok: true });

    expect(createUserNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        body: '"테스트 피드백" 피드백의 관리자 답변이 수정되었습니다.',
        clickPath: "/feedbacks/feedback-1",
        metadata: {
          feedbackId: "feedback-1",
        },
        title: "피드백 답변이 수정되었습니다.",
        userId: "user-1",
      }),
    );
  });

  it("사용자 알림 생성이 예외를 던져도 답변 저장 성공을 유지한다", async () => {
    const supabase = createSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    createUserNotificationMock.mockRejectedValue(
      new Error("notification failed"),
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({ ok: true });
    expect(createUserNotificationMock).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[saveFeedbackReply] notification failed:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it("기존 이미지와 새 이미지를 함께 저장한다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: {
          image_paths: ["feedback-1/old-a.png"],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    const imageFile = new File(["image"], "new.png", {
      type: "image/png",
    });

    formData.append("existingImagePaths", "feedback-1/old-a.png");
    formData.append("images", imageFile);

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({ ok: true });
    expect(createFeedbackReplyImagePathMock).toHaveBeenCalledWith(
      "feedback-1",
      imageFile,
    );

    expect(supabase.mocks.uploadMock).toHaveBeenCalledWith(
      "feedback-1/new.png",
      imageFile,
      {
        contentType: "image/png",
        upsert: true,
      },
    );

    expect(supabase.mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image_paths: ["feedback-1/old-a.png", "feedback-1/new.png"],
      }),
      { onConflict: "feedback_id" },
    );
  });

  it("수정 시 제외된 기존 이미지를 Storage에서 제거한다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: {
          image_paths: ["feedback-1/keep.png", "feedback-1/remove.png"],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.append("existingImagePaths", "feedback-1/keep.png");

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({ ok: true });
    expect(supabase.mocks.removeMock).toHaveBeenCalledWith([
      "feedback-1/remove.png",
    ]);
  });

  it("제거된 기존 이미지가 없으면 Storage remove를 호출하지 않는다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: {
          image_paths: ["feedback-1/keep.png"],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.append("existingImagePaths", "feedback-1/keep.png");

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({ ok: true });
    expect(supabase.mocks.removeMock).not.toHaveBeenCalled();
  });

  it("이미지 업로드 중 실패하면 먼저 업로드된 신규 이미지를 제거한다", async () => {
    const supabase = createSupabaseMock({
      uploadErrors: [null, { message: "second upload failed" }],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.append(
      "images",
      new File(["first"], "first.png", {
        type: "image/png",
      }),
    );
    formData.append(
      "images",
      new File(["second"], "second.png", {
        type: "image/png",
      }),
    );

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({
      ok: false,
      message: "답변 저장에 실패했습니다.",
    });
    expect(supabase.mocks.removeMock).toHaveBeenCalledWith([
      "feedback-1/first.png",
    ]);
    expect(supabase.mocks.upsertMock).not.toHaveBeenCalled();
  });

  it("답변 row 저장에 실패하면 업로드한 신규 이미지를 제거한다", async () => {
    const supabase = createSupabaseMock({
      upsertError: {
        message: "reply upsert failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.append(
      "images",
      new File(["image"], "new.png", {
        type: "image/png",
      }),
    );

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({
      ok: false,
      message: "답변 저장에 실패했습니다.",
    });
    expect(supabase.mocks.removeMock).toHaveBeenCalledWith([
      "feedback-1/new.png",
    ]);
  });

  it("피드백 상태 변경에 실패하면 업로드한 신규 이미지를 제거한다", async () => {
    const supabase = createSupabaseMock({
      resolvedStatusError: {
        message: "status update failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const formData = createValidFormData();
    formData.append(
      "images",
      new File(["image"], "new.png", {
        type: "image/png",
      }),
    );

    const result = await saveFeedbackReply("feedback-1", formData);

    expect(result).toEqual({
      ok: false,
      message: "답변 저장에 실패했습니다.",
    });
    expect(supabase.mocks.removeMock).toHaveBeenCalledWith([
      "feedback-1/new.png",
    ]);
  });

  it("기존 답변 조회에 실패하면 저장 실패를 반환한다", async () => {
    const supabase = createSupabaseMock({
      existingReplyResult: {
        data: null,
        error: {
          message: "reply load failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await saveFeedbackReply("feedback-1", createValidFormData());

    expect(result).toEqual({
      ok: false,
      message: "답변 저장에 실패했습니다.",
    });
    expect(supabase.mocks.upsertMock).not.toHaveBeenCalled();
  });
});

describe("deleteFeedbackReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue("admin-1");
  });

  it("답변 조회에 실패하면 삭제를 중단한다", async () => {
    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: null,
        error: {
          message: "reply load failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({
      ok: false,
      message: "답변 정보를 불러오지 못했습니다.",
    });
    expect(supabase.mocks.deleteMock).not.toHaveBeenCalled();
  });

  it("삭제할 답변이 없으면 안내 메시지를 반환한다", async () => {
    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({
      ok: false,
      message: "삭제할 답변이 없습니다.",
    });
    expect(supabase.mocks.deleteMock).not.toHaveBeenCalled();
  });

  it("답변을 삭제하고 피드백 상태를 OPEN으로 변경한다", async () => {
    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: {
          id: "reply-1",
          image_paths: [],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({ ok: true });
    expect(supabase.mocks.deleteMock).toHaveBeenCalledOnce();
    expect(supabase.mocks.deleteEqMock).toHaveBeenCalledWith("id", "reply-1");
    expect(supabase.mocks.updateMock).toHaveBeenCalledWith({
      status: "OPEN",
    });
    expect(supabase.mocks.openStatusEqMock).toHaveBeenCalledWith(
      "id",
      "feedback-1",
    );
  });

  it("답변 삭제에 실패하면 피드백 상태를 변경하지 않는다", async () => {
    const supabase = createSupabaseMock({
      deleteError: {
        message: "delete failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({
      ok: false,
      message: "답변 삭제에 실패했습니다.",
    });
    expect(supabase.mocks.updateMock).not.toHaveBeenCalled();
  });

  it("피드백 상태 변경에 실패하면 실패 결과를 반환한다", async () => {
    const supabase = createSupabaseMock({
      openStatusError: {
        message: "status update failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({
      ok: false,
      message: "피드백 상태 변경에 실패했습니다.",
    });
  });

  it("연결된 답변 이미지를 Storage에서 제거한다", async () => {
    const imagePaths = ["feedback-1/a.png", "feedback-1/b.png"];

    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: {
          id: "reply-1",
          image_paths: imagePaths,
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({ ok: true });
    expect(supabase.mocks.removeMock).toHaveBeenCalledWith(imagePaths);
  });

  it("Storage 이미지 제거에 실패해도 DB 삭제 성공을 유지한다", async () => {
    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: {
          id: "reply-1",
          image_paths: ["feedback-1/a.png"],
        },
        error: null,
      },
      removeErrors: [
        {
          message: "storage remove failed",
        },
      ],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({ ok: true });
  });

  it("연결된 이미지가 없으면 Storage remove를 호출하지 않는다", async () => {
    const supabase = createSupabaseMock({
      replyLoadResult: {
        data: {
          id: "reply-1",
          image_paths: [],
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await deleteFeedbackReply("feedback-1");

    expect(result).toEqual({ ok: true });
    expect(supabase.mocks.removeMock).not.toHaveBeenCalled();
  });
});
