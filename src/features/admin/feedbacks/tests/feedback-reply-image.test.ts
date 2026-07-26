import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FEEDBACK_REPLY_MAX_IMAGE_COUNT,
  FEEDBACK_REPLY_MAX_IMAGE_SIZE,
} from "../constants/feedback-reply";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import {
  createFeedbackReplyImagePath,
  createFeedbackSignedImages,
  validateFeedbackReplyImageFiles,
} from "../utils/feedback-reply-image";

function createFile({
  name = "image.png",
  type = "image/png",
  size = 1024,
}: {
  name?: string;
  type?: string;
  size?: number;
} = {}) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFeedbackReplyImageFiles", () => {
  it("기존 이미지와 새 이미지의 합이 최대 개수를 초과하면 오류를 반환한다", () => {
    const files = [
      createFile({ name: "image-1.png" }),
      createFile({ name: "image-2.png" }),
    ];

    const result = validateFeedbackReplyImageFiles(
      FEEDBACK_REPLY_MAX_IMAGE_COUNT - 1,
      files,
    );

    expect(result).toBe(
      `이미지는 최대 ${FEEDBACK_REPLY_MAX_IMAGE_COUNT}개까지 첨부할 수 있습니다.`,
    );
  });

  it("허용되지 않은 MIME 타입이면 오류를 반환한다", () => {
    const file = createFile({
      name: "image.svg",
      type: "image/svg+xml",
    });

    const result = validateFeedbackReplyImageFiles(0, [file]);

    expect(result).toBe("JPG, PNG, GIF, WebP 형식만 업로드할 수 있습니다.");
  });

  it("최대 크기를 초과한 파일이면 오류를 반환한다", () => {
    const file = createFile({
      size: FEEDBACK_REPLY_MAX_IMAGE_SIZE + 1,
    });

    const result = validateFeedbackReplyImageFiles(0, [file]);

    expect(result).toBe("이미지 파일은 5MB 이하만 업로드할 수 있습니다.");
  });

  it("개수, MIME 타입, 크기 조건을 충족하면 null을 반환한다", () => {
    const files = [
      createFile({
        name: "image.jpg",
        type: "image/jpeg",
        size: FEEDBACK_REPLY_MAX_IMAGE_SIZE,
      }),
      createFile({
        name: "image.webp",
        type: "image/webp",
      }),
    ];

    const result = validateFeedbackReplyImageFiles(1, files);

    expect(result).toBeNull();
  });
});

describe("createFeedbackReplyImagePath", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      type: "image/jpeg",
      extension: "jpg",
    },
    {
      type: "image/png",
      extension: "png",
    },
    {
      type: "image/gif",
      extension: "gif",
    },
    {
      type: "image/webp",
      extension: "webp",
    },
  ])("$type 파일에 알맞은 확장자를 사용한다", ({ type, extension }) => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "12345678-1234-1234-1234-123456789abc",
    );

    const file = createFile({ type });

    const result = createFeedbackReplyImagePath("feedback-1", file);

    expect(result).toBe(
      `feedback-1/12345678-1234-1234-1234-123456789abc.${extension}`,
    );
  });

  it("알 수 없는 MIME 타입이면 png 확장자를 사용한다", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "12345678-1234-1234-1234-123456789abc",
    );

    const file = createFile({
      name: "image.unknown",
      type: "application/octet-stream",
    });

    const result = createFeedbackReplyImagePath("feedback-1", file);

    expect(result).toBe("feedback-1/12345678-1234-1234-1234-123456789abc.png");
  });

  it("randomUUID를 사용할 수 없으면 시간과 난수로 파일명을 생성한다", () => {
    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockImplementation(undefined as never);
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1234567890);
    const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });

    const file = createFile({
      type: "image/png",
    });

    const result = createFeedbackReplyImagePath("feedback-1", file);

    expect(result).toBe(
      `feedback-1/1234567890-${(0.5).toString(36).slice(2)}.png`,
    );

    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: randomUuidSpy,
    });

    dateNowSpy.mockRestore();
    mathRandomSpy.mockRestore();
  });
});

describe("createFeedbackSignedImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("object path 목록을 signed URL 목록으로 변환한다", async () => {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          signedUrl: "https://example.com/signed/image-1",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          signedUrl: "https://example.com/signed/image-2",
        },
        error: null,
      });

    const storageFrom = vi.fn().mockReturnValue({
      createSignedUrl,
    });

    createAdminClientMock.mockReturnValue({
      storage: {
        from: storageFrom,
      },
    });

    const result = await createFeedbackSignedImages("feedback_replies", [
      "feedback-1/image-1.png",
      "feedback-1/image-2.webp",
    ]);

    expect(storageFrom).toHaveBeenCalledWith("feedback_replies");
    expect(createSignedUrl).toHaveBeenNthCalledWith(
      1,
      "feedback-1/image-1.png",
      60 * 60,
    );
    expect(createSignedUrl).toHaveBeenNthCalledWith(
      2,
      "feedback-1/image-2.webp",
      60 * 60,
    );

    expect(result).toEqual([
      {
        path: "feedback-1/image-1.png",
        signedUrl: "https://example.com/signed/image-1",
      },
      {
        path: "feedback-1/image-2.webp",
        signedUrl: "https://example.com/signed/image-2",
      },
    ]);
  });

  it("signed URL 생성에 실패하면 오류를 발생시킨다", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "storage query failed",
      },
    });

    createAdminClientMock.mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl,
        }),
      },
    });

    await expect(
      createFeedbackSignedImages("feedbacks", ["feedback-1/image-1.png"]),
    ).rejects.toThrow(
      "Failed to create signed image URL: storage query failed",
    );
  });
});
