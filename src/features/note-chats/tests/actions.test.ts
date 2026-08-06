import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  createNoteChatConversationAction,
  deleteNoteChatConversationAction,
  updateNoteChatConversationTitleAction,
} from "../actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: USER_ID,
  title: "테스트 대화",
  created_at: "2026-08-06T10:00:00.000Z",
  updated_at: "2026-08-06T10:00:00.000Z",
};

type SupabaseQueryResult<T> = {
  data: T;
  error: {
    message: string;
  } | null;
};

/**
 * 현재 사용자 조회 결과를 생성합니다.
 */
function createUserResult({
  userId = USER_ID,
  emailConfirmed = true,
}: {
  userId?: string;
  emailConfirmed?: boolean;
} = {}) {
  return {
    data: {
      user: {
        id: userId,
        email_confirmed_at: emailConfirmed ? "2026-08-06T09:00:00.000Z" : null,
      },
    },
    error: null,
  };
}

/**
 * 인증되지 않은 사용자 조회 결과를 생성합니다.
 */
function createUnauthenticatedUserResult() {
  return {
    data: {
      user: null,
    },
    error: {
      message: "Not authenticated",
    },
  };
}

/**
 * 대화 생성 쿼리 Mock을 생성합니다.
 */
function createInsertQueryMock<T>(result: SupabaseQueryResult<T>) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return {
    query: {
      insert,
    },
    insert,
    select,
    single,
  };
}

/**
 * 대화 제목 변경 쿼리 Mock을 생성합니다.
 */
function createUpdateQueryMock<T>(result: SupabaseQueryResult<T>) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });

  const secondEq = vi.fn().mockReturnValue({ select });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });

  const update = vi.fn().mockReturnValue({
    eq: firstEq,
  });

  return {
    query: {
      update,
    },
    update,
    firstEq,
    secondEq,
    select,
    maybeSingle,
  };
}

/**
 * 대화 삭제 쿼리 Mock을 생성합니다.
 */
function createDeleteQueryMock<T>(result: SupabaseQueryResult<T>) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });

  const secondEq = vi.fn().mockReturnValue({ select });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });

  const deleteQuery = vi.fn().mockReturnValue({
    eq: firstEq,
  });

  return {
    query: {
      delete: deleteQuery,
    },
    deleteQuery,
    firstEq,
    secondEq,
    select,
    maybeSingle,
  };
}

/**
 * Server Action에서 사용하는 Supabase Client Mock을 설정합니다.
 */
function mockSupabaseClient({
  userResult = createUserResult(),
  query,
}: {
  userResult?: ReturnType<
    typeof createUserResult | typeof createUnauthenticatedUserResult
  >;
  query?: Record<string, unknown>;
} = {}) {
  const getUser = vi.fn().mockResolvedValue(userResult);
  const from = vi.fn().mockReturnValue(query ?? {});

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser,
    },
    from,
  } as never);

  return {
    getUser,
    from,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(redirect).mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("createNoteChatConversationAction", () => {
  it("입력이 올바르지 않으면 DB에 접근하지 않고 오류를 반환한다", async () => {
    const result = await createNoteChatConversationAction({
      title: "   ",
    });

    expect(result).toEqual({
      success: false,
      error: "대화 제목을 입력해 주세요.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 사용자는 대화를 생성할 수 없다", async () => {
    mockSupabaseClient({
      userResult: createUnauthenticatedUserResult(),
    });

    const result = await createNoteChatConversationAction({
      title: "새로운 대화",
    });

    expect(result).toEqual({
      success: false,
      error: "로그인이 필요합니다.",
    });
  });

  it("이메일 미인증 사용자는 이메일 재전송 페이지로 이동한다", async () => {
    mockSupabaseClient({
      userResult: createUserResult({
        emailConfirmed: false,
      }),
    });

    await expect(
      createNoteChatConversationAction({
        title: "새로운 대화",
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("현재 사용자의 새 대화를 생성한다", async () => {
    const insertQuery = createInsertQueryMock({
      data: CONVERSATION,
      error: null,
    });

    const { from } = mockSupabaseClient({
      query: insertQuery.query,
    });

    const result = await createNoteChatConversationAction({
      title: "  테스트 대화  ",
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");
    expect(insertQuery.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      title: "테스트 대화",
    });
    expect(insertQuery.select).toHaveBeenCalledWith("*");
    expect(result).toEqual({
      success: true,
      conversation: CONVERSATION,
    });
  });

  it("대화 생성 쿼리가 실패하면 사용자 표시용 오류를 반환한다", async () => {
    const insertQuery = createInsertQueryMock({
      data: null,
      error: {
        message: "Insert failed",
      },
    });

    mockSupabaseClient({
      query: insertQuery.query,
    });

    const result = await createNoteChatConversationAction({
      title: "새로운 대화",
    });

    expect(result).toEqual({
      success: false,
      error: "노트 챗봇 대화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });
});

describe("updateNoteChatConversationTitleAction", () => {
  it("입력이 올바르지 않으면 DB에 접근하지 않고 오류를 반환한다", async () => {
    const result = await updateNoteChatConversationTitleAction({
      conversationId: "invalid-id",
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error: "올바른 대화 ID가 아닙니다.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("현재 사용자가 소유한 대화 제목을 변경한다", async () => {
    const updatedConversation = {
      ...CONVERSATION,
      title: "수정된 제목",
      updated_at: "2026-08-06T11:00:00.000Z",
    };

    const updateQuery = createUpdateQueryMock({
      data: updatedConversation,
      error: null,
    });

    const { from } = mockSupabaseClient({
      query: updateQuery.query,
    });

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "  수정된 제목  ",
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");

    expect(updateQuery.update).toHaveBeenCalledWith({
      title: "수정된 제목",
      updated_at: expect.any(String),
    });

    expect(updateQuery.firstEq).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(updateQuery.secondEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(updateQuery.select).toHaveBeenCalledWith("*");

    expect(result).toEqual({
      success: true,
      conversation: updatedConversation,
    });
  });

  it("변경할 대화가 없거나 소유하지 않은 경우 찾을 수 없다는 오류를 반환한다", async () => {
    const updateQuery = createUpdateQueryMock({
      data: null,
      error: null,
    });

    mockSupabaseClient({
      query: updateQuery.query,
    });

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error: "변경할 노트 챗봇 대화를 찾을 수 없습니다.",
    });
  });

  it("대화 제목 변경 쿼리가 실패하면 사용자 표시용 오류를 반환한다", async () => {
    const updateQuery = createUpdateQueryMock({
      data: null,
      error: {
        message: "Update failed",
      },
    });

    mockSupabaseClient({
      query: updateQuery.query,
    });

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error:
        "노트 챗봇 대화 제목 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });
});

describe("deleteNoteChatConversationAction", () => {
  it("입력이 올바르지 않으면 DB에 접근하지 않고 오류를 반환한다", async () => {
    const result = await deleteNoteChatConversationAction({
      conversationId: "invalid-id",
    });

    expect(result).toEqual({
      success: false,
      error: "올바른 대화 ID가 아닙니다.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("현재 사용자가 소유한 대화를 삭제한다", async () => {
    const deleteQuery = createDeleteQueryMock({
      data: {
        id: CONVERSATION_ID,
      },
      error: null,
    });

    const { from } = mockSupabaseClient({
      query: deleteQuery.query,
    });

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");
    expect(deleteQuery.deleteQuery).toHaveBeenCalledTimes(1);
    expect(deleteQuery.firstEq).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(deleteQuery.secondEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(deleteQuery.select).toHaveBeenCalledWith("id");

    expect(result).toEqual({
      success: true,
      conversationId: CONVERSATION_ID,
    });
  });

  it("삭제할 대화가 없거나 소유하지 않은 경우 찾을 수 없다는 오류를 반환한다", async () => {
    const deleteQuery = createDeleteQueryMock({
      data: null,
      error: null,
    });

    mockSupabaseClient({
      query: deleteQuery.query,
    });

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(result).toEqual({
      success: false,
      error: "삭제할 노트 챗봇 대화를 찾을 수 없습니다.",
    });
  });

  it("대화 삭제 쿼리가 실패하면 사용자 표시용 오류를 반환한다", async () => {
    const deleteQuery = createDeleteQueryMock({
      data: null,
      error: {
        message: "Delete failed",
      },
    });

    mockSupabaseClient({
      query: deleteQuery.query,
    });

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(result).toEqual({
      success: false,
      error: "노트 챗봇 대화 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });
});
