import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";

import { generateRelatedNoteRecommendations } from "./generate-related-note-recommendations";

vi.mock("@/features/ai/prompts/render", () => ({
  renderPromptTemplate: vi.fn(),
}));

vi.mock("@/features/ai/providers", () => ({
  createAiChatCompletionWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

const configuration = {
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
  },
  prompt: {
    version: {
      response_schema: {
        type: "object",
      },
      system_template: "system {{question}}",
      user_template: "user {{context}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

const notes: MatchedNote[] = [
  {
    chunkText: "첫 번째 내용",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.9,
    title: "첫 번째 노트",
  },
  {
    chunkText: "두 번째 내용",
    distance: 0.2,
    embeddingId: "embedding-2",
    id: "22222222-2222-4222-8222-222222222222",
    similarity: 0.8,
    title: "두 번째 노트",
  },
];

describe("generateRelatedNoteRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(renderPromptTemplate)
      .mockReturnValueOnce("rendered system")
      .mockReturnValueOnce("rendered user");
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({ usedContextIndexes: [1] }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });
  });

  it("LLM이 선택한 Context index를 제목 snapshot이 포함된 추천 항목으로 변환한다", async () => {
    const result = await generateRelatedNoteRecommendations({
      configuration,
      context: "context",
      expandedQuery: "expanded query",
      notes,
    });

    expect(result).toEqual([
      {
        noteId: "22222222-2222-4222-8222-222222222222",
        title: "두 번째 노트",
      },
    ]);
  });
});
