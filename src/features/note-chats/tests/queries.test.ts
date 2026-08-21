import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import {
  getNoteChatConversationDetail,
  getNoteChatConversationList,
} from "../queries";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

vi.mock("../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MESSAGE_ID_1 = "550e8400-e29b-41d4-a716-446655440002";
const MESSAGE_ID_2 = "550e8400-e29b-41d4-a716-446655440003";
const NOTE_ID = "550e8400-e29b-41d4-a716-446655440004";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440005";

const conversation = {
  created_at: "2026-08-11T00:00:00.000Z",
  id: CONVERSATION_ID,
  title: "노트 챗봇 대화",
  updated_at: "2026-08-11T01:00:00.000Z",
  user_id: "550e8400-e29b-41d4-a716-446655440000",
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
    ilike: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    then: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.in.mockReturnValue(query);

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

function mockCreateClient(queries: Array<ReturnType<typeof createQueryMock>>) {
  let index = 0;

  const from = vi.fn(() => {
    const query = queries[index];

    if (!query) {
      throw new Error(`Unexpected Supabase query index: ${index}`);
    }

    index += 1;

    return query;
  });

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "550e8400-e29b-41d4-a716-446655440000",
          },
        },
        error: null,
      }),
    },
    from,
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
      "550e8400-e29b-41d4-a716-446655440000",
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
      messagesQuery,
      runsQuery,
    ]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(messagesQuery.eq).toHaveBeenCalledWith(
      "conversation_id",
      CONVERSATION_ID,
    );
    expect(messagesQuery.order).toHaveBeenCalledWith("sequence_number", {
      ascending: true,
    });

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
    });

    expect(from).toHaveBeenCalledTimes(3);
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

    const messagesQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([conversationQuery, messagesQuery]);

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

    const messagesQuery = createQueryMock({
      data: [
        {
          ...messages[0],
        },
      ],
      error: null,
    });

    const from = mockCreateClient([conversationQuery, messagesQuery]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      conversation,
      messages: [
        {
          ...messages[0],
        },
      ],
      assistantSources: [],
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

    const messagesQuery = createQueryMock({
      data: messages,
      error: null,
    });

    const runsQuery = createQueryMock({
      data: null,
      error,
    });

    mockCreateClient([conversationQuery, messagesQuery, runsQuery]);

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

    mockCreateClient([conversationQuery, messagesQuery, runsQuery]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result?.assistantSources).toEqual([]);
  });

  it("Assistant Message ID가 없는 Run은 Source 결과에서 제외한다", async () => {
    const conversationQuery = createQueryMock({
      data: conversation,
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

    mockCreateClient([conversationQuery, messagesQuery, runsQuery]);

    const result = await getNoteChatConversationDetail(CONVERSATION_ID);

    expect(result?.assistantSources).toEqual([]);
  });
});
