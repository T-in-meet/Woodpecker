import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  notFoundMock,
  createAdminClientMock,
  requireAdminMock,
  escapePostgrestLikePatternMock,
  createFeedbackListQueryMock,
  applyFeedbackFiltersMock,
  mapFeedbackRowsMock,
  createFeedbackSignedImagesMock,
  applyFeedbackSortMock,
  getUserIdsForSearchMock,
} = vi.hoisted(() => ({
  notFoundMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  requireAdminMock: vi.fn(),
  escapePostgrestLikePatternMock: vi.fn(),
  createFeedbackListQueryMock: vi.fn(),
  applyFeedbackFiltersMock: vi.fn(),
  mapFeedbackRowsMock: vi.fn(),
  createFeedbackSignedImagesMock: vi.fn(),
  applyFeedbackSortMock: vi.fn(),
  getUserIdsForSearchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/features/admin/utils/query", () => ({
  escapePostgrestLikePattern: escapePostgrestLikePatternMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-query-filter", () => ({
  applyFeedbackFilters: applyFeedbackFiltersMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-query-mapper", () => ({
  mapFeedbackRows: mapFeedbackRowsMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-reply-image", () => ({
  createFeedbackSignedImages: createFeedbackSignedImagesMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-sort", () => ({
  applyFeedbackSort: applyFeedbackSortMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-user-search", () => ({
  getUserIdsForSearch: getUserIdsForSearchMock,
}));

import { getFeedbackDetail, getFeedbacks } from "../queries";

type QueryError = {
  message: string;
};

type DetailSupabaseOptions = {
  feedbackResult?: {
    data: unknown;
    error: QueryError | null;
  };
  profileResult?: {
    data: unknown;
    error: QueryError | null;
  };
  noteResult?: {
    data: unknown;
    error: QueryError | null;
  };
  replyResult?: {
    data: unknown;
    error: QueryError | null;
  };
  replyAuthorResult?: {
    data: unknown;
    error: QueryError | null;
  };
};

function createDetailSupabaseMock(options: DetailSupabaseOptions = {}) {
  const feedbackResult = options.feedbackResult ?? {
    data: {
      id: "feedback-1",
      user_id: "user-123456789",
      note_id: "note-1",
      category: "BUG",
      title: "피드백 제목",
      content: "피드백 내용",
      image_urls: ["feedback-1/source.png"],
      status: "OPEN",
      created_at: "2026-07-20T10:00:00.000Z",
      updated_at: "2026-07-21T10:00:00.000Z",
    },
    error: null,
  };

  const profileResult = options.profileResult ?? {
    data: {
      id: "user-123456789",
      nickname: "사용자",
      canonical_email: "user@example.com",
      avatar_url: "https://example.com/user.png",
    },
    error: null,
  };

  const noteResult = options.noteResult ?? {
    data: {
      id: "note-1",
      title: "연결된 노트",
    },
    error: null,
  };

  const replyResult = options.replyResult ?? {
    data: {
      id: "reply-1",
      feedback_id: "feedback-1",
      title: "답변 제목",
      content: "답변 내용",
      image_paths: ["feedback-1/reply.png"],
      created_by: "admin-123456789",
      created_at: "2026-07-22T10:00:00.000Z",
      updated_at: "2026-07-23T10:00:00.000Z",
    },
    error: null,
  };

  const replyAuthorResult = options.replyAuthorResult ?? {
    data: {
      id: "admin-123456789",
      nickname: "관리자",
      avatar_url: "https://example.com/admin.png",
    },
    error: null,
  };

  const createSingleQuery = (result: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(result),
      })),
    })),
  });

  const createMaybeSingleQuery = (result: unknown) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(result),
      })),
    })),
  });

  const feedbackTable = createSingleQuery(feedbackResult);
  const noteTable = createSingleQuery(noteResult);

  const profileSelectMock = vi.fn((columns: string) => {
    if (columns === "id, nickname, canonical_email, avatar_url") {
      return {
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(profileResult),
        })),
      };
    }

    if (columns === "id, nickname, avatar_url") {
      return {
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(replyAuthorResult),
        })),
      };
    }

    throw new Error(`Unexpected profile select: ${columns}`);
  });

  const replyTable = createMaybeSingleQuery(replyResult);

  const fromMock = vi.fn((table: string) => {
    if (table === "feedbacks") {
      return feedbackTable;
    }

    if (table === "profiles") {
      return {
        select: profileSelectMock,
      };
    }

    if (table === "notes") {
      return noteTable;
    }

    if (table === "feedback_replies") {
      return replyTable;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: {
      from: fromMock,
    },
    mocks: {
      fromMock,
      profileSelectMock,
      feedbackTable,
      noteTable,
      replyTable,
    },
  };
}

type ListSupabaseOptions = {
  result?: {
    data: unknown[] | null;
    error: QueryError | null;
    count: number | null;
  };
};

function createListSupabaseMock(options: ListSupabaseOptions = {}) {
  const result = options.result ?? {
    data: [],
    error: null,
    count: 0,
  };

  const rangeMock = vi.fn().mockResolvedValue(result);

  const query = {
    ilike: vi.fn(),
    in: vi.fn(),
    range: rangeMock,
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  query.ilike.mockReturnValue(query);
  query.in.mockReturnValue(query);

  const selectMock = vi.fn(() => query);
  const fromMock = vi.fn(() => ({
    select: selectMock,
  }));

  return {
    client: {
      from: fromMock,
    },
    query,
    mocks: {
      fromMock,
      selectMock,
      rangeMock,
    },
  };
}

function createListQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    pageSize: 10,
    search: {
      field: "title",
      query: "",
    },
    filters: {},
    sort: {
      field: "createdAt",
      direction: "desc",
    },
    ...overrides,
  } as Parameters<typeof getFeedbacks>[0];
}

describe("getFeedbackDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue("admin-1");

    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    createFeedbackSignedImagesMock.mockImplementation(
      async (bucket: string, paths: string[]) =>
        paths.map((path) => ({
          path,
          signedUrl: `https://example.com/${bucket}/${path}`,
        })),
    );
  });

  it("피드백 상세 데이터와 연결 정보를 화면 데이터로 변환한다", async () => {
    const supabase = createDetailSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await getFeedbackDetail("feedback-1");

    expect(requireAdminMock).toHaveBeenCalledOnce();

    expect(createFeedbackSignedImagesMock).toHaveBeenNthCalledWith(
      1,
      "feedbacks",
      ["feedback-1/source.png"],
    );

    expect(createFeedbackSignedImagesMock).toHaveBeenNthCalledWith(
      2,
      "feedback_replies",
      ["feedback-1/reply.png"],
    );

    expect(result).toEqual({
      id: "feedback-1",
      user: {
        id: "user-123456789",
        name: "사용자",
        email: "user@example.com",
        avatarUrl: "https://example.com/user.png",
      },
      note: {
        id: "note-1",
        title: "연결된 노트",
      },
      category: "BUG",
      status: "OPEN",
      title: "피드백 제목",
      content: "피드백 내용",
      images: [
        {
          path: "feedback-1/source.png",
          signedUrl: "https://example.com/feedbacks/feedback-1/source.png",
        },
      ],
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      reply: {
        id: "reply-1",
        title: "답변 제목",
        content: "답변 내용",
        imagePaths: ["feedback-1/reply.png"],
        images: [
          {
            path: "feedback-1/reply.png",
            signedUrl:
              "https://example.com/feedback_replies/feedback-1/reply.png",
          },
        ],
        createdBy: "admin-123456789",
        author: {
          id: "admin-123456789",
          name: "관리자",
          avatarUrl: "https://example.com/admin.png",
        },
        createdAt: "2026-07-22T10:00:00.000Z",
        updatedAt: "2026-07-23T10:00:00.000Z",
      },
    });
  });

  it("연결 노트와 관리자 답변이 없으면 null로 반환한다", async () => {
    const supabase = createDetailSupabaseMock({
      feedbackResult: {
        data: {
          id: "feedback-1",
          user_id: "user-123456789",
          note_id: null,
          category: "ETC",
          title: "피드백 제목",
          content: "피드백 내용",
          image_urls: [],
          status: "OPEN",
          created_at: "2026-07-20T10:00:00.000Z",
          updated_at: "2026-07-21T10:00:00.000Z",
        },
        error: null,
      },
      replyResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await getFeedbackDetail("feedback-1");

    expect(result.note).toBeNull();
    expect(result.reply).toBeNull();

    expect(createFeedbackSignedImagesMock).toHaveBeenCalledTimes(1);

    expect(supabase.mocks.fromMock).not.toHaveBeenCalledWith("notes");
  });

  it("답변 작성자 프로필이 없으면 작성자 ID 앞 8자를 이름으로 사용한다", async () => {
    const supabase = createDetailSupabaseMock({
      replyAuthorResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    const result = await getFeedbackDetail("feedback-1");

    expect(result.reply?.author).toEqual({
      id: "admin-123456789",
      name: "admin-12",
      avatarUrl: null,
    });
  });

  it("피드백을 찾지 못하면 notFound를 호출한다", async () => {
    const supabase = createDetailSupabaseMock({
      feedbackResult: {
        data: null,
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(getFeedbackDetail("feedback-1")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("작성자 프로필 조회에 실패하면 오류를 던진다", async () => {
    const supabase = createDetailSupabaseMock({
      profileResult: {
        data: null,
        error: {
          message: "profile failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(getFeedbackDetail("feedback-1")).rejects.toThrow(
      "Failed to load feedback user.",
    );
  });

  it("연결 노트 조회에 실패하면 오류를 던진다", async () => {
    const supabase = createDetailSupabaseMock({
      noteResult: {
        data: null,
        error: {
          message: "note failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(getFeedbackDetail("feedback-1")).rejects.toThrow(
      "Failed to load feedback note.",
    );
  });

  it("관리자 답변 조회에 실패하면 오류를 던진다", async () => {
    const supabase = createDetailSupabaseMock({
      replyResult: {
        data: null,
        error: {
          message: "reply failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(getFeedbackDetail("feedback-1")).rejects.toThrow(
      "Failed to load feedback reply.",
    );
  });

  it("답변 작성자 조회에 실패하면 오류를 던진다", async () => {
    const supabase = createDetailSupabaseMock({
      replyAuthorResult: {
        data: null,
        error: {
          message: "reply author failed",
        },
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(getFeedbackDetail("feedback-1")).rejects.toThrow(
      "Failed to load feedback reply author.",
    );
  });
});

describe("getFeedbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue("admin-1");
    getUserIdsForSearchMock.mockResolvedValue(null);
    escapePostgrestLikePatternMock.mockImplementation((value: string) => value);

    applyFeedbackFiltersMock.mockImplementation((query) => query);
    applyFeedbackSortMock.mockImplementation((query) => query);
    mapFeedbackRowsMock.mockResolvedValue([]);
  });

  it("사용자 검색 결과가 없으면 feedbacks를 조회하지 않고 빈 결과를 반환한다", async () => {
    const supabase = createListSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    getUserIdsForSearchMock.mockResolvedValue([]);

    const result = await getFeedbacks(
      createListQuery({
        page: 2,
        pageSize: 20,
        search: {
          field: "user",
          query: "없는 사용자",
        },
      }),
    );

    expect(result).toEqual({
      items: [],
      pagination: {
        page: 2,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });

    expect(createFeedbackListQueryMock).not.toHaveBeenCalled();
  });

  it("페이지가 1보다 작으면 1로 보정하고 범위 조회한다", async () => {
    const supabase = createListSupabaseMock({
      result: {
        data: [],
        error: null,
        count: 0,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);

    const result = await getFeedbacks(
      createListQuery({
        page: 0,
        pageSize: 10,
      }),
    );

    expect(supabase.mocks.rangeMock).toHaveBeenCalledWith(0, 9);
    expect(result.pagination.page).toBe(1);
  });

  it("제목 검색어를 escape한 ilike 조건으로 적용한다", async () => {
    const supabase = createListSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);
    escapePostgrestLikePatternMock.mockReturnValue("제목\\_검색");

    await getFeedbacks(
      createListQuery({
        search: {
          field: "title",
          query: " 제목_검색 ",
        },
      }),
    );

    expect(escapePostgrestLikePatternMock).toHaveBeenCalledWith("제목_검색");
    expect(supabase.query.ilike).toHaveBeenCalledWith("title", "%제목\\_검색%");
  });

  it("내용 검색어를 content ilike 조건으로 적용한다", async () => {
    const supabase = createListSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);

    await getFeedbacks(
      createListQuery({
        search: {
          field: "content",
          query: "검색 내용",
        },
      }),
    );

    expect(supabase.query.ilike).toHaveBeenCalledWith("content", "%검색 내용%");
  });

  it("사용자 검색 결과 ID를 user_id 조건으로 적용한다", async () => {
    const supabase = createListSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);
    getUserIdsForSearchMock.mockResolvedValue(["user-1", "user-2"]);

    await getFeedbacks(
      createListQuery({
        search: {
          field: "user",
          query: "사용자",
        },
      }),
    );

    expect(supabase.query.in).toHaveBeenCalledWith("user_id", [
      "user-1",
      "user-2",
    ]);
  });

  it("필터와 정렬 조건을 query에 적용한다", async () => {
    const supabase = createListSupabaseMock();

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);

    const filters = {
      status: {
        field: "status",
        type: "multi-select",
        value: ["OPEN"],
      },
    };

    const sort = {
      field: "createdAt",
      direction: "desc",
    };

    await getFeedbacks(
      createListQuery({
        filters,
        sort,
      }),
    );

    expect(applyFeedbackFiltersMock).toHaveBeenCalledWith(
      supabase.query,
      filters,
    );

    expect(applyFeedbackSortMock).toHaveBeenCalledWith(supabase.query, sort);
  });

  it("정렬 조건과 함께 현재 페이지 범위만 조회한다", async () => {
    const rows = [
      {
        id: "feedback-11",
      },
      {
        id: "feedback-12",
      },
    ];

    const mappedItems = [
      {
        id: "feedback-11",
      },
      {
        id: "feedback-12",
      },
    ];

    const supabase = createListSupabaseMock({
      result: {
        data: rows,
        error: null,
        count: 25,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);
    mapFeedbackRowsMock.mockResolvedValue(mappedItems);

    const result = await getFeedbacks(
      createListQuery({
        page: 2,
        pageSize: 10,
      }),
    );

    expect(supabase.mocks.rangeMock).toHaveBeenCalledWith(10, 19);

    expect(mapFeedbackRowsMock).toHaveBeenCalledWith(rows);

    expect(result).toEqual({
      items: mappedItems,
      pagination: {
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });

  it("count가 null이면 조회된 row 개수를 total로 사용한다", async () => {
    const rows = [
      {
        id: "feedback-1",
      },
      {
        id: "feedback-2",
      },
    ];

    const supabase = createListSupabaseMock({
      result: {
        data: rows,
        error: null,
        count: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);
    mapFeedbackRowsMock.mockResolvedValue(rows);

    const result = await getFeedbacks(
      createListQuery({
        pageSize: 10,
      }),
    );

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it("목록 조회에 실패하면 원본 오류 메시지를 포함해 예외를 던진다", async () => {
    const supabase = createListSupabaseMock({
      result: {
        data: null,
        error: {
          message: "database failed",
        },
        count: null,
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);
    createFeedbackListQueryMock.mockReturnValue(supabase.query);

    await expect(getFeedbacks(createListQuery())).rejects.toThrow(
      "Failed to load feedbacks: database failed",
    );

    expect(mapFeedbackRowsMock).not.toHaveBeenCalled();
  });
});
