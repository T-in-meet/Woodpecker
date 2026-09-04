import { describe, expect, it, vi } from "vitest";

import { executeNoteChat } from "../execute";
import {
  type NoteChatExecutionSettings,
  type PreparedNoteChatExecution,
  prepareNoteChatExecution,
} from "../prepare-execution";
import { startNoteChatProviderStream } from "../start-provider-stream";

vi.mock("../prepare-execution", () => ({
  prepareNoteChatExecution: vi.fn(),
}));

vi.mock("../start-provider-stream", () => ({
  startNoteChatProviderStream: vi.fn(),
}));

describe("executeNoteChat", () => {
  it("실행 정보를 준비하고 Provider 스트림을 시작한 뒤 usage와 실행 결과를 반환한다", async () => {
    const settings = {} as NoteChatExecutionSettings;
    const preparedConversation =
      {} as PreparedNoteChatExecution["conversation"];
    const preparedMessages: PreparedNoteChatExecution["messages"] = [];
    const preparedSources: PreparedNoteChatExecution["sources"] = [];

    /**
     * 질의 확장 Chat Completion에서 사용한 token 사용량입니다.
     */
    const queryExpansionUsage: PreparedNoteChatExecution["queryExpansionUsage"] =
      {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      };
    const queryEmbeddingUsage: PreparedNoteChatExecution["queryEmbeddingUsage"] =
      {
        inputTokens: 5,
        outputTokens: 0,
        totalTokens: 5,
      };
    const onQueryExpansionUsage = vi.fn();
    const onQueryEmbeddingUsage = vi.fn();

    const prepared: PreparedNoteChatExecution = {
      conversation: preparedConversation,
      context: "context",
      expandedQuery: "확장된 검색 질의",
      history: [],
      messages: preparedMessages,
      question: "질문",
      queryEmbeddingUsage,
      queryExpansionUsage,
      settings,
      sources: preparedSources,
      userMessageId: "message-1",
    };

    vi.mocked(prepareNoteChatExecution).mockResolvedValue(prepared);

    const result = await executeNoteChat({
      conversationId: "conversation-1",
      onQueryEmbeddingUsage,
      onQueryExpansionUsage,
      settings,
      userId: "user-1",
      userMessageId: "message-1",
    });

    expect(prepareNoteChatExecution).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      onQueryEmbeddingUsage,
      onQueryExpansionUsage,
      settings,
      userId: "user-1",
      userMessageId: "message-1",
    });

    expect(startNoteChatProviderStream).not.toHaveBeenCalled();

    expect(result).toEqual({
      expandedQuery: prepared.expandedQuery,
      prepared,
      providerStream: null,
      queryEmbeddingUsage,
      queryExpansionUsage,
      sources: prepared.sources,
    });
  });
});
