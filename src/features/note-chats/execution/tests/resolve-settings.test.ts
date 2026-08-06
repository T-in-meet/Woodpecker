import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { AI_MODEL_CAPABILITY } from "@/features/ai/constants/models";
import { getActiveAiModelConfigById } from "@/features/ai/models/queries";
import { getPublishedAiPromptVersionForAgent } from "@/features/ai/prompts/queries";

import type { NoteChatRunSettings } from "../../schema";
import { resolveNoteChatExecutionSettings } from "../resolve-settings";

vi.mock("@/features/ai/models/queries", () => ({
  getActiveAiModelConfigById: vi.fn(),
}));

vi.mock("@/features/ai/prompts/queries", () => ({
  getPublishedAiPromptVersionForAgent: vi.fn(),
}));

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const PROMPT_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_MODEL_CONFIG_ID = "33333333-3333-4333-8333-333333333333";
const EMBEDDING_MODEL_CONFIG_ID = "44444444-4444-4444-8444-444444444444";

const SETTINGS: NoteChatRunSettings = {
  agentId: AGENT_ID,
  promptVersionId: PROMPT_VERSION_ID,
  chatModelConfigId: CHAT_MODEL_CONFIG_ID,
  embeddingModelConfigId: EMBEDDING_MODEL_CONFIG_ID,
};

const PROMPT = {
  agent: {
    id: AGENT_ID,
  },
  family: {
    id: "55555555-5555-4555-8555-555555555555",
  },
  version: {
    id: PROMPT_VERSION_ID,
  },
};

const CHAT_MODEL = {
  id: CHAT_MODEL_CONFIG_ID,
  capability: AI_MODEL_CAPABILITY.CHAT,
  dimensions: null,
  is_active: true,
};

const EMBEDDING_MODEL = {
  id: EMBEDDING_MODEL_CONFIG_ID,
  capability: AI_MODEL_CAPABILITY.EMBEDDING,
  dimensions: AI_EMBEDDING_DIMENSIONS,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveNoteChatExecutionSettings", () => {
  it("Prompt와 Chat·Embedding Model Config를 ID로 조회해 반환한다", async () => {
    vi.mocked(getPublishedAiPromptVersionForAgent).mockResolvedValue(
      PROMPT as never,
    );

    /*
     * 동일한 조회 함수가 Chat과 Embedding Model 순서로 호출되므로
     * 각 호출에 대응하는 결과를 순서대로 반환합니다.
     */
    vi.mocked(getActiveAiModelConfigById)
      .mockResolvedValueOnce(CHAT_MODEL as never)
      .mockResolvedValueOnce(EMBEDDING_MODEL as never);

    const result = await resolveNoteChatExecutionSettings(SETTINGS);

    expect(getPublishedAiPromptVersionForAgent).toHaveBeenCalledWith({
      agentId: AGENT_ID,
      promptVersionId: PROMPT_VERSION_ID,
    });

    expect(getActiveAiModelConfigById).toHaveBeenNthCalledWith(1, {
      expectedCapability: AI_MODEL_CAPABILITY.CHAT,
      modelConfigId: CHAT_MODEL_CONFIG_ID,
    });

    expect(getActiveAiModelConfigById).toHaveBeenNthCalledWith(2, {
      expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
      expectedDimensions: AI_EMBEDDING_DIMENSIONS,
      modelConfigId: EMBEDDING_MODEL_CONFIG_ID,
    });

    expect(result).toEqual({
      prompt: PROMPT,
      chatModel: CHAT_MODEL,
      embeddingModel: EMBEDDING_MODEL,
    });
  });

  it("Prompt 조회가 실패하면 오류를 호출자에게 전달한다", async () => {
    vi.mocked(getPublishedAiPromptVersionForAgent).mockRejectedValue(
      new Error("Prompt resolution failed"),
    );

    vi.mocked(getActiveAiModelConfigById)
      .mockResolvedValueOnce(CHAT_MODEL as never)
      .mockResolvedValueOnce(EMBEDDING_MODEL as never);

    await expect(resolveNoteChatExecutionSettings(SETTINGS)).rejects.toThrow(
      "Prompt resolution failed",
    );
  });

  it("Chat Model 조회가 실패하면 오류를 호출자에게 전달한다", async () => {
    vi.mocked(getPublishedAiPromptVersionForAgent).mockResolvedValue(
      PROMPT as never,
    );

    vi.mocked(getActiveAiModelConfigById)
      .mockRejectedValueOnce(new Error("Chat model resolution failed"))
      .mockResolvedValueOnce(EMBEDDING_MODEL as never);

    await expect(resolveNoteChatExecutionSettings(SETTINGS)).rejects.toThrow(
      "Chat model resolution failed",
    );
  });

  it("Embedding Model 조회가 실패하면 오류를 호출자에게 전달한다", async () => {
    vi.mocked(getPublishedAiPromptVersionForAgent).mockResolvedValue(
      PROMPT as never,
    );

    vi.mocked(getActiveAiModelConfigById)
      .mockResolvedValueOnce(CHAT_MODEL as never)
      .mockRejectedValueOnce(new Error("Embedding model resolution failed"));

    await expect(resolveNoteChatExecutionSettings(SETTINGS)).rejects.toThrow(
      "Embedding model resolution failed",
    );
  });
});
