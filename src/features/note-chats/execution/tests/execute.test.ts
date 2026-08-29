import { describe, expect, it, vi } from "vitest";

import type { AiChatStreamEvent } from "@/features/ai/providers/types";

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
      expandedQuery: "확장된 검색 질의",
      messages: preparedMessages,
      queryEmbeddingUsage,
      queryExpansionUsage,
      settings,
      sources: preparedSources,
      userMessageId: "message-1",
    };

    const providerStream = {} as AsyncGenerator<AiChatStreamEvent>;

    vi.mocked(prepareNoteChatExecution).mockResolvedValue(prepared);
    vi.mocked(startNoteChatProviderStream).mockReturnValue(providerStream);

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

    expect(startNoteChatProviderStream).toHaveBeenCalledWith(prepared);

    expect(result).toEqual({
      expandedQuery: prepared.expandedQuery,
      prepared,
      providerStream,
      queryEmbeddingUsage,
      queryExpansionUsage,
      sources: prepared.sources,
    });
  });
});
