import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  createNoteChatConversationAction,
  deleteNoteChatConversationAction,
  updateNoteChatConversationTitleAction,
} from "../actions";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: USER_ID,
  title: "테스트 대화",
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: "2026-08-11T00:00:00.000Z",
};

function createAuthenticatedUser(
  overrides: Partial<{
    id: string;
    email_confirmed_at: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? USER_ID,
    email_confirmed_at:
      "email_confirmed_at" in overrides
        ? overrides.email_confirmed_at
        : "2026-08-10T00:00:00.000Z",
  };
}

function createSupabaseClient(
  authUser: ReturnType<typeof createAuthenticatedUser> | null,
  authError: { message: string } | null = null,
) {
  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: authUser,
    },
    error: authError,
  });

  const auth = {
    getUser,
  };

  const from = vi.fn();

  return {
    auth,
    from,
    getUser,
  };
}

function mockCreateClient(client: ReturnType<typeof createSupabaseClient>) {
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

describe("createNoteChatConversationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("입력이 올바르지 않으면 인증 및 DB를 호출하지 않는다", async () => {
    const result = await createNoteChatConversationAction({
      title: "",
    });

    expect(result).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 경우 대화 생성을 수행하지 않는다", async () => {
    const client = createSupabaseClient(null);
    mockCreateClient(client);

    const result = await createNoteChatConversationAction({
      title: "테스트 대화",
    });

    expect(result).toEqual({
      success: false,
      error: "로그인이 필요합니다.",
    });
    expect(client.getUser).toHaveBeenCalledOnce();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("이메일이 확인되지 않은 경우 재전송 페이지로 이동한다", async () => {
    const client = createSupabaseClient(
      createAuthenticatedUser({
        email_confirmed_at: null,
      }),
    );
    mockCreateClient(client);

    await expect(
      createNoteChatConversationAction({
        title: "테스트 대화",
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(client.from).not.toHaveBeenCalled();
  });

  it("Conversation을 생성하고 생성된 대화를 반환한다", async () => {
    const single = vi.fn().mockResolvedValue({
      data: CONVERSATION,
      error: null,
    });
    const select = vi.fn(() => ({
      single,
    }));
    const insert = vi.fn(() => ({
      select,
    }));
    const from = vi.fn(() => ({
      insert,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await createNoteChatConversationAction({
      title: "테스트 대화",
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");
    expect(insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      title: "테스트 대화",
    });
    expect(select).toHaveBeenCalledWith("*");
    expect(single).toHaveBeenCalledOnce();

    expect(result).toEqual({
      success: true,
      conversation: CONVERSATION,
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("Conversation 생성에 실패하면 운영 오류를 보고하고 실패 결과를 반환한다", async () => {
    const error = {
      message: "insert failed",
    };

    const single = vi.fn().mockResolvedValue({
      data: null,
      error,
    });
    const select = vi.fn(() => ({
      single,
    }));
    const insert = vi.fn(() => ({
      select,
    }));
    const from = vi.fn(() => ({
      insert,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await createNoteChatConversationAction({
      title: "테스트 대화",
    });

    expect(result).toEqual({
      success: false,
      error: "노트 챗봇 대화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      error,
      errorCode: "NOTE_CHAT_CONVERSATION_CREATE_FAILED",
      message: "노트 챗봇 대화 생성에 실패했습니다.",
      operation: "create_conversation",
      userId: USER_ID,
    });
  });

  it("DB 오류 없이 생성 결과가 없으면 운영 오류를 보고하지 않는다", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const select = vi.fn(() => ({
      single,
    }));
    const insert = vi.fn(() => ({
      select,
    }));
    const from = vi.fn(() => ({
      insert,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await createNoteChatConversationAction({
      title: "테스트 대화",
    });

    expect(result).toEqual({
      success: false,
      error: "노트 챗봇 대화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });
});

describe("updateNoteChatConversationTitleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("입력이 올바르지 않으면 인증 및 DB를 호출하지 않는다", async () => {
    const result = await updateNoteChatConversationTitleAction({
      conversationId: "invalid-id",
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 경우 제목을 수정하지 않는다", async () => {
    const client = createSupabaseClient(null);
    mockCreateClient(client);

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error: "로그인이 필요합니다.",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("Conversation 제목을 수정하고 수정된 대화를 반환한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...CONVERSATION,
        title: "수정된 제목",
      },
      error: null,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const update = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      update,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");
    expect(update).toHaveBeenCalledWith({
      title: "수정된 제목",
      updated_at: expect.any(String),
    });
    expect(eqId).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(eqUserId).toHaveBeenCalledWith("user_id", USER_ID);
    expect(select).toHaveBeenCalledWith("*");
    expect(maybeSingle).toHaveBeenCalledOnce();

    expect(result).toEqual({
      success: true,
      conversation: {
        ...CONVERSATION,
        title: "수정된 제목",
      },
    });
  });

  it("다른 사용자의 Conversation은 수정하지 않는다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const update = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      update,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(eqId).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(eqUserId).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toEqual({
      success: false,
      error: "변경할 노트 챗봇 대화를 찾을 수 없습니다.",
    });
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("제목 수정에 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "update failed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const update = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      update,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await updateNoteChatConversationTitleAction({
      conversationId: CONVERSATION_ID,
      title: "수정된 제목",
    });

    expect(result).toEqual({
      success: false,
      error:
        "노트 챗봇 대화 제목 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode: "NOTE_CHAT_CONVERSATION_TITLE_UPDATE_FAILED",
      message: "노트 챗봇 대화 제목 변경에 실패했습니다.",
      operation: "update_conversation_title",
      userId: USER_ID,
    });
  });
});

describe("deleteNoteChatConversationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("입력이 올바르지 않으면 인증 및 DB를 호출하지 않는다", async () => {
    const result = await deleteNoteChatConversationAction({
      conversationId: "invalid-id",
    });

    expect(result).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 경우 Conversation을 삭제하지 않는다", async () => {
    const client = createSupabaseClient(null);
    mockCreateClient(client);

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(result).toEqual({
      success: false,
      error: "로그인이 필요합니다.",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("Conversation을 삭제하고 삭제된 Conversation ID를 반환한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: CONVERSATION_ID,
      },
      error: null,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const deleteQuery = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      delete: deleteQuery,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversations");
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(eqId).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(eqUserId).toHaveBeenCalledWith("user_id", USER_ID);
    expect(select).toHaveBeenCalledWith("id");
    expect(maybeSingle).toHaveBeenCalledOnce();

    expect(result).toEqual({
      success: true,
      conversationId: CONVERSATION_ID,
    });
  });

  it("다른 사용자의 Conversation은 삭제하지 않는다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const deleteQuery = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      delete: deleteQuery,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(eqId).toHaveBeenCalledWith("id", CONVERSATION_ID);
    expect(eqUserId).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toEqual({
      success: false,
      error: "삭제할 노트 챗봇 대화를 찾을 수 없습니다.",
    });
    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("Conversation 삭제에 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "delete failed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const eqUserId = vi.fn(() => ({
      select,
    }));
    const eqId = vi.fn(() => ({
      eq: eqUserId,
    }));
    const deleteQuery = vi.fn(() => ({
      eq: eqId,
    }));
    const from = vi.fn(() => ({
      delete: deleteQuery,
    }));

    const client = createSupabaseClient(createAuthenticatedUser());
    client.from.mockImplementation(from);
    mockCreateClient(client);

    const result = await deleteNoteChatConversationAction({
      conversationId: CONVERSATION_ID,
    });

    expect(result).toEqual({
      success: false,
      error: "노트 챗봇 대화 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode: "NOTE_CHAT_CONVERSATION_DELETE_FAILED",
      message: "노트 챗봇 대화 삭제에 실패했습니다.",
      operation: "delete_conversation",
      userId: USER_ID,
    });
  });
});
