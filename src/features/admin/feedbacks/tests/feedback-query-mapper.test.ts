import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedbackListRow } from "../utils/feedback-query-mapper";

const { createAdminClientMock, createFeedbackContentPreviewMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    createFeedbackContentPreviewMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-query", () => ({
  createFeedbackContentPreview: createFeedbackContentPreviewMock,
}));

import { mapFeedbackRows } from "../utils/feedback-query-mapper";

function createRows(): FeedbackListRow[] {
  return [
    {
      id: "feedback-1",
      user_id: "user-12345678",
      note_id: "note-1",
      category: "BUG",
      title: "피드백 제목",
      content: "피드백 본문",
      image_urls: ["image-1", "image-2"],
      status: "OPEN",
      created_at: "2026-07-25T10:00:00.000Z",
      updated_at: "2026-07-25T11:00:00.000Z",
    },
  ];
}

function createSupabaseMock({
  replies = [],
  repliesError = null,
  notes = [],
  notesError = null,
  profiles = [],
  profilesError = null,
}: {
  replies?: unknown[];
  repliesError?: { message: string } | null;
  notes?: unknown[];
  notesError?: { message: string } | null;
  profiles?: unknown[];
  profilesError?: { message: string } | null;
} = {}) {
  const repliesIn = vi.fn().mockResolvedValue({
    data: replies,
    error: repliesError,
  });
  const notesIn = vi.fn().mockResolvedValue({
    data: notes,
    error: notesError,
  });
  const profilesIn = vi.fn().mockResolvedValue({
    data: profiles,
    error: profilesError,
  });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "feedback_replies":
        return {
          select: vi.fn(() => ({
            in: repliesIn,
          })),
        };

      case "notes":
        return {
          select: vi.fn(() => ({
            in: notesIn,
          })),
        };

      case "profiles":
        return {
          select: vi.fn(() => ({
            in: profilesIn,
          })),
        };

      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });

  return {
    client: { from },
    from,
    repliesIn,
    notesIn,
    profilesIn,
  };
}

describe("mapFeedbackRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createFeedbackContentPreviewMock.mockReturnValue("본문 미리보기");
  });

  it("빈 row 목록이면 추가 조회 없이 빈 배열을 반환한다", async () => {
    const result = await mapFeedbackRows([]);

    expect(result).toEqual([]);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("피드백 row에 사용자, 답변자, 노트 정보를 병합한다", async () => {
    const supabase = createSupabaseMock({
      replies: [
        {
          feedback_id: "feedback-1",
          created_by: "admin-12345678",
        },
      ],
      notes: [
        {
          id: "note-1",
          title: "연결된 노트",
        },
      ],
      profiles: [
        {
          id: "user-12345678",
          nickname: "사용자",
          canonical_email: "user@example.com",
        },
        {
          id: "admin-12345678",
          nickname: "관리자",
          canonical_email: "admin@example.com",
        },
      ],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await mapFeedbackRows(createRows());

    expect(supabase.repliesIn).toHaveBeenCalledWith("feedback_id", [
      "feedback-1",
    ]);
    expect(supabase.notesIn).toHaveBeenCalledWith("id", ["note-1"]);
    expect(supabase.profilesIn).toHaveBeenCalledWith("id", [
      "user-12345678",
      "admin-12345678",
    ]);

    expect(createFeedbackContentPreviewMock).toHaveBeenCalledWith(
      "피드백 본문",
    );

    expect(result).toEqual([
      {
        id: "feedback-1",
        userId: "user-12345678",
        userLabel: "사용자",
        userEmail: "user@example.com",
        replyAuthorId: "admin-12345678",
        replyAuthorLabel: "관리자",
        noteId: "note-1",
        noteTitle: "연결된 노트",
        category: "BUG",
        status: "OPEN",
        title: "피드백 제목",
        contentPreview: "본문 미리보기",
        imageCount: 2,
        createdAt: "2026-07-25T10:00:00.000Z",
        updatedAt: "2026-07-25T11:00:00.000Z",
      },
    ]);
  });

  it("프로필이나 답변자 프로필이 없으면 짧은 ID를 표시한다", async () => {
    const supabase = createSupabaseMock({
      replies: [
        {
          feedback_id: "feedback-1",
          created_by: "admin-87654321",
        },
      ],
      notes: [],
      profiles: [],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await mapFeedbackRows(createRows());

    expect(result[0]).toMatchObject({
      userLabel: "user-123",
      userEmail: null,
      replyAuthorId: "admin-87654321",
      replyAuthorLabel: "admin-87",
      noteTitle: null,
    });
  });

  it("노트 ID가 없으면 notes 테이블을 조회하지 않는다", async () => {
    const rows = createRows().map((row) => ({
      ...row,
      note_id: null,
    }));

    const supabase = createSupabaseMock({
      replies: [],
      profiles: [
        {
          id: "user-12345678",
          nickname: "사용자",
          canonical_email: null,
        },
      ],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await mapFeedbackRows(rows);

    expect(supabase.from).not.toHaveBeenCalledWith("notes");
    expect(result[0]).toMatchObject({
      noteId: null,
      noteTitle: null,
      replyAuthorId: null,
      replyAuthorLabel: null,
    });
  });

  it("답변 조회에 실패하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      repliesError: {
        message: "reply query failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(mapFeedbackRows(createRows())).rejects.toThrow(
      "Failed to load feedback replies: reply query failed",
    );
  });

  it("프로필 조회에 실패하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      profilesError: {
        message: "profile query failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(mapFeedbackRows(createRows())).rejects.toThrow(
      "Failed to load feedback users: profile query failed",
    );
  });

  it("노트 조회에 실패하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      notesError: {
        message: "note query failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(mapFeedbackRows(createRows())).rejects.toThrow(
      "Failed to load feedback notes: note query failed",
    );
  });
});
