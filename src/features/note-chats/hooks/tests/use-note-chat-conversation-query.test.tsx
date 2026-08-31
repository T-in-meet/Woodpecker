import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { noteChatQueryKeys } from "../../constants/query-keys";
import {
  getNoteChatConversationDetail,
  getNoteChatConversationMessagePage,
} from "../../queries";
import {
  useNoteChatConversationDetailQuery,
  useNoteChatConversationMessagesQuery,
} from "../use-note-chat-conversation-query";

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("../../queries", () => ({
  getNoteChatConversationDetail: vi.fn(),
  getNoteChatConversationMessagePage: vi.fn(),
}));

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("useNoteChatConversationDetailQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useInfiniteQuery).mockReturnValue(
      {} as ReturnType<typeof useInfiniteQuery>,
    );
    vi.mocked(useQuery).mockReturnValue({} as ReturnType<typeof useQuery>);
  });

  it("Conversation 상세 Query를 올바른 queryKey와 queryFn으로 생성한다", async () => {
    useNoteChatConversationDetailQuery(CONVERSATION_ID);

    expect(useQuery).toHaveBeenCalledTimes(1);

    const options = vi.mocked(useQuery).mock.calls[0]?.[0];

    expect(options?.queryKey).toEqual(
      noteChatQueryKeys.conversationDetail(CONVERSATION_ID),
    );
    expect(options?.enabled).toBe(true);

    const queryFn = options?.queryFn;

    expect(queryFn).toBeTypeOf("function");

    if (typeof queryFn !== "function") {
      throw new Error("queryFn이 함수가 아닙니다.");
    }

    await queryFn({
      queryKey: noteChatQueryKeys.conversationDetail(CONVERSATION_ID),
    } as never);

    expect(getNoteChatConversationDetail).toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it("conversationId가 비어 있으면 Query를 비활성화한다", () => {
    useNoteChatConversationDetailQuery("");

    const options = vi.mocked(useQuery).mock.calls[0]?.[0];

    expect(options?.enabled).toBe(false);
  });

  it("running Claim이 있으면 5초 polling을 유지한다", () => {
    useNoteChatConversationDetailQuery(CONVERSATION_ID);

    const options = vi.mocked(useQuery).mock.calls[0]?.[0];

    expect(options?.refetchInterval).toBeTypeOf("function");

    const refetchInterval = options?.refetchInterval;

    if (typeof refetchInterval !== "function") {
      throw new Error("refetchInterval이 함수가 아닙니다.");
    }

    const interval = refetchInterval({
      state: {
        data: {
          hasRunningExecution: true,
        },
      },
    } as never);

    expect(interval).toBe(5_000);
  });

  it("running Claim이 없으면 polling을 중단한다", () => {
    useNoteChatConversationDetailQuery(CONVERSATION_ID);

    const options = vi.mocked(useQuery).mock.calls[0]?.[0];

    const refetchInterval = options?.refetchInterval;

    expect(refetchInterval).toBeTypeOf("function");

    if (typeof refetchInterval !== "function") {
      throw new Error("refetchInterval이 함수가 아닙니다.");
    }

    const interval = refetchInterval({
      state: {
        data: {
          hasRunningExecution: false,
        },
      },
    } as never);

    expect(interval).toBe(false);
  });

  it("아직 상세 데이터가 없으면 polling하지 않는다", () => {
    useNoteChatConversationDetailQuery(CONVERSATION_ID);

    const options = vi.mocked(useQuery).mock.calls[0]?.[0];

    const refetchInterval = options?.refetchInterval;

    expect(refetchInterval).toBeTypeOf("function");

    if (typeof refetchInterval !== "function") {
      throw new Error("refetchInterval이 함수가 아닙니다.");
    }

    const interval = refetchInterval({
      state: {
        data: undefined,
      },
    } as never);

    expect(interval).toBe(false);
  });
});

describe("useNoteChatConversationMessagesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useInfiniteQuery).mockReturnValue(
      {} as ReturnType<typeof useInfiniteQuery>,
    );
  });

  it("Conversation 메시지 무한 Query를 올바른 queryKey와 queryFn으로 생성한다", async () => {
    useNoteChatConversationMessagesQuery(CONVERSATION_ID);

    expect(useInfiniteQuery).toHaveBeenCalledTimes(1);

    const options = vi.mocked(useInfiniteQuery).mock.calls[0]?.[0];

    expect(options?.queryKey).toEqual(
      noteChatQueryKeys.conversationMessages(CONVERSATION_ID),
    );
    expect(options?.enabled).toBe(true);
    expect(options?.initialPageParam).toBeNull();

    const queryFn = options?.queryFn;

    expect(queryFn).toBeTypeOf("function");

    if (typeof queryFn !== "function") {
      throw new Error("queryFn이 함수가 아닙니다.");
    }

    await queryFn({
      pageParam: 10,
      queryKey: noteChatQueryKeys.conversationMessages(CONVERSATION_ID),
    } as never);

    expect(getNoteChatConversationMessagePage).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      cursor: 10,
    });
  });

  it("다음 페이지 cursor는 마지막 페이지의 nextCursor를 사용한다", () => {
    useNoteChatConversationMessagesQuery(CONVERSATION_ID);

    const options = vi.mocked(useInfiniteQuery).mock.calls[0]?.[0];
    const getNextPageParam = options?.getNextPageParam;

    expect(getNextPageParam).toBeTypeOf("function");

    if (typeof getNextPageParam !== "function") {
      throw new Error("getNextPageParam이 함수가 아닙니다.");
    }

    expect(
      getNextPageParam(
        {
          assistantSources: [],
          messages: [],
          nextCursor: 3,
        },
        [],
        null,
        [],
      ),
    ).toBe(3);

    expect(
      getNextPageParam(
        {
          assistantSources: [],
          messages: [],
          nextCursor: null,
        },
        [],
        null,
        [],
      ),
    ).toBeUndefined();
  });

  it("conversationId가 비어 있으면 메시지 Query를 비활성화한다", () => {
    useNoteChatConversationMessagesQuery("");

    const options = vi.mocked(useInfiniteQuery).mock.calls[0]?.[0];

    expect(options?.enabled).toBe(false);
  });
});
