import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { noteChatQueryKeys } from "../../constants/query-keys";
import { getNoteChatConversationDetail } from "../../queries";
import { useNoteChatConversationDetailQuery } from "../use-note-chat-conversation-query";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../queries", () => ({
  getNoteChatConversationDetail: vi.fn(),
}));

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("useNoteChatConversationDetailQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
