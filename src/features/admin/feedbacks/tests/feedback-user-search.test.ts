import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, escapePostgrestLikePatternMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    escapePostgrestLikePatternMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/admin/feedbacks/utils/feedback-query", () => ({
  escapePostgrestLikePattern: escapePostgrestLikePatternMock,
}));

import { getUserIdsForSearch } from "../utils/feedback-user-search";

function createQuery({
  searchField = "user",
  query = "",
}: {
  searchField?: string;
  query?: string;
}) {
  return {
    page: 1,
    pageSize: 20,
    filters: {},
    sort: {
      field: "createdAt",
      direction: "desc",
    },
    search: {
      field: searchField,
      query,
    },
  } as never;
}

function createSupabaseMock({
  nicknameData = [],
  nicknameError = null,
  emailData = [],
  emailError = null,
}: {
  nicknameData?: unknown[];
  nicknameError?: { message: string } | null;
  emailData?: unknown[];
  emailError?: { message: string } | null;
} = {}) {
  const nicknameIlike = vi.fn().mockResolvedValue({
    data: nicknameData,
    error: nicknameError,
  });

  const emailIlike = vi.fn().mockResolvedValue({
    data: emailData,
    error: emailError,
  });

  const ilike = vi.fn((column: string, pattern: string) => {
    if (column === "nickname") {
      return nicknameIlike(column, pattern);
    }

    if (column === "canonical_email") {
      return emailIlike(column, pattern);
    }

    throw new Error(`Unexpected ilike column: ${column}`);
  });

  const select = vi.fn().mockReturnValue({
    ilike,
  });

  const from = vi.fn((table: string) => {
    if (table !== "profiles") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select,
    };
  });

  return {
    client: { from },
    nicknameIlike,
    emailIlike,
    from,
    select,
    ilike,
  };
}

describe("getUserIdsForSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    escapePostgrestLikePatternMock.mockImplementation((value: string) => value);
  });

  it("사용자 검색이 아니면 null을 반환한다", async () => {
    const result = await getUserIdsForSearch(
      createQuery({
        searchField: "title",
        query: "홍길동",
      }),
    );

    expect(result).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("검색어가 비어 있으면 null을 반환한다", async () => {
    const result = await getUserIdsForSearch(
      createQuery({
        query: "   ",
      }),
    );

    expect(result).toBeNull();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("UUID 검색어는 그대로 반환한다", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";

    const result = await getUserIdsForSearch(
      createQuery({
        query: uuid,
      }),
    );

    expect(result).toEqual([uuid]);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("닉네임과 이메일 검색 결과를 합쳐 중복 없이 반환한다", async () => {
    const supabase = createSupabaseMock({
      nicknameData: [{ id: "user-1" }, { id: "user-2" }],
      emailData: [{ id: "user-2" }, { id: "user-3" }],
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    escapePostgrestLikePatternMock.mockReturnValue("홍길동");

    const result = await getUserIdsForSearch(
      createQuery({
        query: "홍길동",
      }),
    );

    expect(escapePostgrestLikePatternMock).toHaveBeenCalledWith("홍길동");

    expect(supabase.nicknameIlike).toHaveBeenCalledWith("nickname", "%홍길동%");

    expect(supabase.emailIlike).toHaveBeenCalledWith(
      "canonical_email",
      "%홍길동%",
    );

    expect(result).toEqual(["user-1", "user-2", "user-3"]);
  });

  it("닉네임 검색 실패 시 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      nicknameError: {
        message: "nickname search failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(
      getUserIdsForSearch(
        createQuery({
          query: "홍길동",
        }),
      ),
    ).rejects.toThrow("Failed to search users: nickname search failed");
  });

  it("이메일 검색 실패 시 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      emailError: {
        message: "email search failed",
      },
    });

    createAdminClientMock.mockReturnValue(supabase.client);

    await expect(
      getUserIdsForSearch(
        createQuery({
          query: "홍길동",
        }),
      ),
    ).rejects.toThrow("Failed to search users: email search failed");
  });
});
