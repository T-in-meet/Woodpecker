import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";

import { generateRelatedNoteRecommendations } from "../generate-related-note-recommendations";

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

/**
 * Related Notes 검색 결과 fixture입니다.
 *
 * 첫 번째와 두 번째 Context는 서로 다른 Note를 가리키며,
 * 세 번째 Context는 첫 번째 Note의 다른 chunk를 가리킵니다.
 *
 * 이를 통해:
 * - 1-based Context index 매핑
 * - 동일 Note의 여러 chunk 선택 시 Note 단위 중복 제거
 * 를 함께 검증합니다.
 */
const notes: MatchedNote[] = [
  {
    chunkText: "첫 번째 노트의 첫 번째 관련 내용",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.9,
    title: "첫 번째 노트",
  },
  {
    chunkText: "두 번째 노트의 관련 내용",
    distance: 0.2,
    embeddingId: "embedding-2",
    id: "22222222-2222-4222-8222-222222222222",
    similarity: 0.8,
    title: "두 번째 노트",
  },
  {
    chunkText: "첫 번째 노트의 두 번째 관련 내용",
    distance: 0.3,
    embeddingId: "embedding-3",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.7,
    title: "첫 번째 노트",
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

  it("1-based Context index를 실제 Note 추천 항목으로 변환한다", async () => {
    const result = await generateRelatedNoteRecommendations({
      configuration,
      context: "context",
      expandedQuery: "expanded query",
      notes,
    });

    expect(result).toEqual([
      {
        noteId: "11111111-1111-4111-8111-111111111111",
        title: "첫 번째 노트",
      },
    ]);
  });

  it("같은 Note의 여러 chunk가 선택되어도 Note 추천은 한 번만 반환한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        usedContextIndexes: [1, 3, 2],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    const result = await generateRelatedNoteRecommendations({
      configuration,
      context: "context",
      expandedQuery: "expanded query",
      notes,
    });

    expect(result).toEqual([
      {
        noteId: "11111111-1111-4111-8111-111111111111",
        title: "첫 번째 노트",
      },
      {
        noteId: "22222222-2222-4222-8222-222222222222",
        title: "두 번째 노트",
      },
    ]);
  });

  it("Context index가 0이면 응답 계약 오류를 발생시킨다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        usedContextIndexes: [0],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow(
      "Related note recommendation response does not match the expected schema.",
    );
  });

  it("존재하지 않는 Context index가 반환되면 오류를 발생시킨다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        usedContextIndexes: [4],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow("Related note recommendation context index not found: 4");
  });
});
