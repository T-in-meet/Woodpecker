import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT } from "../constants/execution";
import {
  getNoteChatConversationDetail,
  getNoteChatConversationList,
  getNoteChatDailyUsage,
} from "../queries";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

vi.mock("../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MESSAGE_ID_1 = "550e8400-e29b-41d4-a716-446655440002";
const MESSAGE_ID_2 = "550e8400-e29b-41d4-a716-446655440003";
const NOTE_ID = "550e8400-e29b-41d4-a716-446655440004";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440005";
const CLAIM_ID = "550e8400-e29b-41d4-a716-446655440006";

const conversation = {
  created_at: "2026-08-11T00:00:00.000Z",
  id: CONVERSATION_ID,
  title: "노트 챗봇 대화",
  updated_at: "2026-08-11T01:00:00.000Z",
  user_id: USER_ID,
};

const messages = [
  {
    content: {
      text: "첫 번째 질문",
    },
    conversation_id: CONVERSATION_ID,
    created_at: "2026-08-11T00:00:00.000Z",
    id: MESSAGE_ID_1,
    role: "user",
    sequence_number: 1,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
  {
    content: {
      referencedNoteIds: [NOTE_ID],
      text: "첫 번째 답변",
    },
    conversation_id: CONVERSATION_ID,
    created_at: "2026-08-11T00:01:00.000Z",
    id: MESSAGE_ID_2,
    role: "assistant",
    sequence_number: 2,
    updated_at: "2026-08-11T00:01:00.000Z",
  },
];

const source = {
  contextIndex: 1,
  content: "노트 내용",
  distance: 0.1,
  embeddingId: RUN_ID,
  noteId: NOTE_ID,
  similarity: 0.9,
  title: "테스트 노트",
  type: "note",
};

function createQueryMock<T>(result: {
  data: T;
  count?: number | null;
  error: { message: string } | null;
}) {
  const query = {
    eq: vi.fn(),
    gte: vi.fn(),
    ilike: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    then: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  query.range.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);

  // Supabase query builder 자체를 await하는 조회를 지원합니다.
  query.then.mockImplementation(
    (
      resolve: (value: {
        data: T;
        count?: number | null;
        error: { message: string } | null;
      }) => unknown,
    ) => Promise.resolve(result).then(resolve),
  );

  return query;
}

function mockCreateClient(
  queries: Array<ReturnType<typeof createQueryMock>>,
  options?: {
    rpcResult?: {
      data: unknown;
      error: { message: string } | null;
    };
    onRpc?: (rpc: ReturnType<typeof vi.fn>) => void;
  },
) {
  let index = 0;

  const from = vi.fn(() => {
    const query = queries[index];

    if (!query) {
      throw new Error(`Unexpected Supabase query index: ${index}`);
    }

    index += 1;

    return query;
  });

  const rpc = vi.fn().mockResolvedValue(
    options?.rpcResult ?? {
      data: null,
      error: null,
    },
  );

  options?.onRpc?.(rpc);

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: USER_ID,
          },
        },
        error: null,
      }),
    },
    from,
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return from;
}

describe("getNoteChatConversationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최신 법적 동의가 없으면 대화 목록을 조회하지 않는다", async () => {
    const legalRedirect = new Error("NEXT_REDIRECT");

    const query = createQueryMock({
      data: [],
      count: 0,
      error: null,
    });

    const from = mockCreateClient([query]);

    vi.mocked(requireCurrentLegalAcceptance).mockRejectedValueOnce(
      legalRedirect,
    );

    await expect(getNoteChatConversationList()).rejects.toBe(legalRedirect);

    expect(from).not.toHaveBeenCalled();
  });

  it("대화 목록을 최근 수정 순으로 조회하고 페이지네이션 정보를 반환한다", async () => {
    const query = createQueryMock({
      data: [
        {
          id: CONVERSATION_ID,
          title: "노트 챗봇 대화",
          updated_at: "2026-08-11T01:00:00.000Z",
          last_message_content: "첫 번째 답변",
          last_message_role: "assistant",
        },
      ],
      count: 21,
      error: null,
    });

    const from = mockCreateClient([query]);

    const result = await getNoteChatConversationList({
      page: 2,
    });

    expect(from).toHaveBeenCalledWith("note_chat_conversation_list");
    expect(requireCurrentLegalAcceptance).toHaveBeenCalledWith(
      USER_ID,
      ROUTES.NOTE_CHATS,
    );
    expect(query.select).toHaveBeenCalledWith("*", {
      count: "exact",
    });
    expect(query.order).toHaveBeenNthCalledWith(1, "updated_at", {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: false,
    });
    expect(query.range).toHaveBeenCalledWith(20, 39);

    expect(result).toEqual({
      items: [
        {
          id: CONVERSATION_ID,
          title: "노트 챗봇 대화",
          updated_at: "2026-08-11T01:00:00.000Z",
          last_message_content: "첫 번째 답변",
          last_message_role: "assistant",
        },
      ],
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
  });

  it("검색어를 trim하고 LIKE 특수문자를 escape한다", async () => {
    const query = createQueryMock({
      data: [],
      count: 0,
      error: null,
    });

    mockCreateClient([query]);

    await getNoteChatConversationList({
      search: `  100%_test"  `,
    });

    expect(query.ilike).toHaveBeenCalledWith("title", `%100\\%\\_test\\"%`);
  });

  it("page가 1보다 작으면 첫 페이지로 보정한다", async () => {
    const query = createQueryMock({
      data: [],
      count: 0,
      error: null,
    });

    mockCreateClient([query]);

    const result = await getNoteChatConversationList({
      page: 0,
    });

    expect(query.range).toHaveBeenCalledWith(0, 19);
    expect(result.page).toBe(1);
  });

  it("대화 목록 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = {
      message: "conversation list failed",
    };

    const query = createQueryMock({
      data: null,
      count: null,
      error,
    });

    mockCreateClient([query]);

    await expect(
      getNoteChatConversationList({
        page: 2,
        search: "노트",
      }),
    ).rejects.toThrow(
      "노트 챗봇 대화 목록 조회에 실패했습니다: conversation list failed",
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {
        page: 2,
        pageSize: 20,
        searchApplied: true,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_LIST_LOAD_FAILED,
      message: "노트 챗봇 대화 목록 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_CONVERSATION_LIST,
    });
  });
});

describe("getNoteChatConversationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("대화가 존재하지 않으면 null을 반환하고 메시지를 조회하지 않는다", async () => {
    const conversationQuery = createQueryMock({
      data: null,
      error: null,
    });

    const from = mockCreateClient([conversationQuery]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("note_chat_conversations");
  });

  it("대화와 메시지를 조회하고 Assistant Message의 Source를 반환한다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: messages,
      error: null,
    });

    const runsQuery = createQueryMock({
      data: [
        {
          assistant_message_id: MESSAGE_ID_2,
          sources: [source],
        },
      ],
      error: null,
    });

    const from = mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
      runsQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(from).toHaveBeenNthCalledWith(1, "note_chat_conversations");
    expect(conversationQuery.eq).toHaveBeenNthCalledWith(
      1,
      "id",
      CONVERSATION_ID,
    );
    expect(conversationQuery.eq).toHaveBeenNthCalledWith(2, "user_id", USER_ID);

    expect(from).toHaveBeenNthCalledWith(2, "note_chat_execution_claims");
    expect(runningExecutionQuery.select).toHaveBeenCalledWith("id");
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      1,
      "user_id",
      USER_ID,
    );
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      2,
      "conversation_id",
      CONVERSATION_ID,
    );
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      3,
      "status",
      "running",
    );
    expect(runningExecutionQuery.limit).toHaveBeenCalledWith(1);

    expect(from).toHaveBeenNthCalledWith(3, "note_chat_messages");
    expect(messagesQuery.eq).toHaveBeenCalledWith(
      "conversation_id",
      CONVERSATION_ID,
    );
    expect(messagesQuery.order).toHaveBeenCalledWith("sequence_number", {
      ascending: true,
    });

    expect(from).toHaveBeenNthCalledWith(4, "note_chat_runs");
    expect(runsQuery.in).toHaveBeenCalledWith("assistant_message_id", [
      MESSAGE_ID_2,
    ]);

    expect(result).toEqual({
      conversation,
      messages,
      assistantSources: [
        {
          assistantMessageId: MESSAGE_ID_2,
          sources: [
            {
              noteId: NOTE_ID,
              title: "테스트 노트",
            },
          ],
        },
      ],
      hasRunningExecution: false,
    });

    expect(from).toHaveBeenCalledTimes(4);
  });

  it("유효한 running Claim이 있으면 실행 중 상태를 반환한다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: {
        id: CLAIM_ID,
      },
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: [messages[0]],
      error: null,
    });

    const from = mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(from).toHaveBeenNthCalledWith(2, "note_chat_execution_claims");
    expect(from).toHaveBeenNthCalledWith(3, "note_chat_messages");

    expect(runningExecutionQuery.select).toHaveBeenCalledWith("id");
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      1,
      "user_id",
      USER_ID,
    );
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      2,
      "conversation_id",
      CONVERSATION_ID,
    );
    expect(runningExecutionQuery.eq).toHaveBeenNthCalledWith(
      3,
      "status",
      "running",
    );
    expect(runningExecutionQuery.limit).toHaveBeenCalledWith(1);

    expect(result).toEqual({
      conversation,
      messages: [messages[0]],
      assistantSources: [],
      hasRunningExecution: true,
    });
  });

  it("running Claim 조회 시 stale 기준보다 최근 실행만 조회한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00.000Z"));

    try {
      const conversationQuery = createQueryMock({
        data: conversation,
        error: null,
      });

      const runningExecutionQuery = createQueryMock({
        data: null,
        error: null,
      });

      const messagesQuery = createQueryMock({
        data: [messages[0]],
        error: null,
      });

      mockCreateClient([
        conversationQuery,
        runningExecutionQuery,
        messagesQuery,
      ]);

      const result = await getNoteChatConversationDetail(CONVERSATION_ID);

      expect(runningExecutionQuery.gte).toHaveBeenCalledWith(
        "claimed_at",
        "2026-08-30T11:57:00.000Z",
      );

      expect(result?.hasRunningExecution).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("running Claim 조회에 실패해도 대화 상세는 반환하고 운영 오류를 보고한다", async () => {
    const error = {
      message: "running execution load failed",
    };

    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error,
    });

    const messagesQuery = createQueryMock({
      data: [messages[0]],
      error: null,
    });

    mockCreateClient([conversationQuery, runningExecutionQuery, messagesQuery]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result).toEqual({
      conversation,
      messages: [messages[0]],
      assistantSources: [],
      hasRunningExecution: false,
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUNNING_EXECUTION_LOAD_FAILED,
      message: "노트 챗봇 실행 상태 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_RUNNING_EXECUTION,
    });
  });

  it("대화 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = {
      message: "conversation load failed",
    };

    const conversationQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([conversationQuery]);

    await expect(
      getNoteChatConversationDetail(CONVERSATION_ID),
    ).rejects.toThrow(
      "노트 챗봇 대화 조회에 실패했습니다: conversation load failed",
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_LOAD_FAILED,
      message: "노트 챗봇 대화 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_CONVERSATION,
    });
  });

  it("메시지 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = {
      message: "messages load failed",
    };

    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([conversationQuery, runningExecutionQuery, messagesQuery]);

    await expect(
      getNoteChatConversationDetail(CONVERSATION_ID),
    ).rejects.toThrow(
      "노트 챗봇 메시지 조회에 실패했습니다: messages load failed",
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MESSAGES_LOAD_FAILED,
      message: "노트 챗봇 메시지 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_MESSAGES,
    });
  });

  it("Assistant Message가 없으면 Run Source를 조회하지 않는다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: [messages[0]],
      error: null,
    });

    const from = mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(from).toHaveBeenCalledTimes(3);
    expect(from).toHaveBeenNthCalledWith(1, "note_chat_conversations");
    expect(from).toHaveBeenNthCalledWith(2, "note_chat_execution_claims");
    expect(from).toHaveBeenNthCalledWith(3, "note_chat_messages");
    expect(from).not.toHaveBeenCalledWith("note_chat_runs");

    expect(result).toEqual({
      conversation,
      messages: [messages[0]],
      assistantSources: [],
      hasRunningExecution: false,
    });
  });

  it("Run Source 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = {
      message: "sources load failed",
    };

    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: messages,
      error: null,
    });

    const runsQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
      runsQuery,
    ]);

    await expect(
      getNoteChatConversationDetail(CONVERSATION_ID),
    ).rejects.toThrow(
      "노트 챗봇 참고 노트 조회에 실패했습니다: sources load failed",
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {
        conversationId: CONVERSATION_ID,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.SOURCES_LOAD_FAILED,
      message: "노트 챗봇 참고 노트 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_SOURCES,
    });
  });

  it("Run Source 배열이 스키마를 만족하지 않으면 해당 Run의 Source를 제외한다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: messages,
      error: null,
    });

    const runsQuery = createQueryMock({
      data: [
        {
          assistant_message_id: MESSAGE_ID_2,
          sources: [
            source,
            {
              invalid: true,
            },
          ],
        },
      ],
      error: null,
    });

    mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
      runsQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result?.assistantSources).toEqual([]);
    expect(result?.hasRunningExecution).toBe(false);
  });

  it("Assistant Message ID가 없는 Run은 Source 결과에서 제외한다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
      error: null,
    });

    const runningExecutionQuery = createQueryMock({
      data: null,
      error: null,
    });

    const messagesQuery = createQueryMock({
      data: messages,
      error: null,
    });

    const runsQuery = createQueryMock({
      data: [
        {
          assistant_message_id: null,
          sources: [source],
        },
      ],
      error: null,
    });

    mockCreateClient([
      conversationQuery,
      runningExecutionQuery,
      messagesQuery,
      runsQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result?.assistantSources).toEqual([]);
    expect(result?.hasRunningExecution).toBe(false);
  });
});

describe("getNoteChatDailyUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("일반 사용자의 오늘 Note Chat 사용량과 일일 제한을 반환한다", async () => {
    const profileQuery = createQueryMock({
      data: {
        role: "USER",
      },
      error: null,
    });

    let rpc: ReturnType<typeof vi.fn> | undefined;

    mockCreateClient([profileQuery], {
      rpcResult: {
        data: 3,
        error: null,
      },
      onRpc: (mock) => {
        rpc = mock;
      },
    });

    const result = await getNoteChatDailyUsage();

    expect(profileQuery.eq).toHaveBeenCalledWith("id", USER_ID);
    expect(rpc).toHaveBeenCalledWith("get_note_chat_daily_usage");

    expect(result).toEqual({
      used: 3,
      limit: NOTE_CHAT_DAILY_EXECUTION_LIMIT,
    });
  });

  it("ADMIN은 일일 사용량 RPC를 호출하지 않고 null을 반환한다", async () => {
    const profileQuery = createQueryMock({
      data: {
        role: "ADMIN",
      },
      error: null,
    });

    let rpc: ReturnType<typeof vi.fn> | undefined;

    mockCreateClient([profileQuery], {
      onRpc: (mock) => {
        rpc = mock;
      },
    });

    const result = await getNoteChatDailyUsage();

    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("사용자 역할 조회에 실패하면 운영 오류를 보고하고 null을 반환한다", async () => {
    const error = {
      message: "profile load failed",
    };

    const profileQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([profileQuery]);

    const result = await getNoteChatDailyUsage();

    expect(result).toBeNull();

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {},
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message:
        "노트 챗봇 일일 사용량 조회를 위한 사용자 역할 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
    });
  });

  it("일일 사용량 RPC 조회에 실패하면 운영 오류를 보고하고 null을 반환한다", async () => {
    const profileQuery = createQueryMock({
      data: {
        role: "USER",
      },
      error: null,
    });

    const error = {
      message: "daily usage load failed",
    };

    mockCreateClient([profileQuery], {
      rpcResult: {
        data: null,
        error,
      },
    });

    const result = await getNoteChatDailyUsage();

    expect(result).toBeNull();

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith({
      context: {},
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message: "노트 챗봇 일일 사용량 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
    });
  });

  it("일일 사용량 응답이 유효하지 않으면 오류를 기록하고 null을 반환한다", async () => {
    const profileQuery = createQueryMock({
      data: {
        role: "USER",
      },
      error: null,
    });

    mockCreateClient([profileQuery], {
      rpcResult: {
        data: -1,
        error: null,
      },
    });

    const result = await getNoteChatDailyUsage();

    expect(result).toBeNull();

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[getNoteChatDailyUsage] 일일 사용량 응답 검증 실패",
      }),
    );

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });
});
