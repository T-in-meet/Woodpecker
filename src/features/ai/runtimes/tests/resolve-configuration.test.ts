import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_MODEL_CAPABILITY } from "@/features/ai/constants/models";
import { getActiveAiModelConfigById } from "@/features/ai/models/queries";
import { getPublishedAiPromptVersionForAgent } from "@/features/ai/prompts/queries";

import { getAiRuntimeConfigurationRow } from "../queries";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "../resolve-configuration";

vi.mock("server-only", () => ({}));

vi.mock("../queries", () => ({
  getAiRuntimeConfigurationRow: vi.fn(),
}));

vi.mock("@/features/ai/models/queries", () => ({
  getActiveAiModelConfigById: vi.fn(),
}));

vi.mock("@/features/ai/prompts/queries", () => ({
  getPublishedAiPromptVersionForAgent: vi.fn(),
}));

type RuntimeConfigurationRow = Awaited<
  ReturnType<typeof getAiRuntimeConfigurationRow>
>;

type ActiveAiModelConfig = Awaited<
  ReturnType<typeof getActiveAiModelConfigById>
>;

type PublishedAiPrompt = Awaited<
  ReturnType<typeof getPublishedAiPromptVersionForAgent>
>;

const chatModel = {
  id: "chat-model-id",
  capability: AI_MODEL_CAPABILITY.CHAT,
  model: "chat-model",
  provider: "openai",
} as unknown as ActiveAiModelConfig;

const embeddingModel = {
  id: "embedding-model-id",
  capability: AI_MODEL_CAPABILITY.EMBEDDING,
  model: "embedding-model",
  provider: "openai",
} as unknown as ActiveAiModelConfig;

const publishedPrompt = {
  agent: {
    id: "agent-id",
  },
  family: {
    id: "prompt-family-id",
  },
  version: {
    id: "prompt-version-id",
    system_template: "system",
    user_template: "user",
  },
} as unknown as PublishedAiPrompt;

function createChatRow(
  overrides: Partial<RuntimeConfigurationRow> = {},
): RuntimeConfigurationRow {
  return {
    id: "chat-configuration-id",
    kind: "chat",
    role_key: "answer-generation",
    model_config_id: "chat-model-id",
    prompt_version_id: "prompt-version-id",
    temperature: 0.2,
    ai_settings: {
      id: "setting-id",
      key: "note-chat",
    },
    ai_prompt_versions: {
      id: "prompt-version-id",
      family_id: "prompt-family-id",
      ai_prompt_families: {
        id: "prompt-family-id",
        agent_id: "agent-id",
      },
    },
    ...overrides,
  } as RuntimeConfigurationRow;
}

function createEmbeddingRow(
  overrides: Partial<RuntimeConfigurationRow> = {},
): RuntimeConfigurationRow {
  return {
    id: "embedding-configuration-id",
    kind: "embedding",
    role_key: "note-retrieval",
    model_config_id: "embedding-model-id",
    prompt_version_id: null,
    temperature: null,
    ai_settings: {
      id: "setting-id",
      key: "note-chat",
    },
    ai_prompt_versions: null,
    ...overrides,
  } as RuntimeConfigurationRow;
}

describe("AI Runtime Configuration resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveAiRuntimeChatConfiguration", () => {
    it("유효한 Chat Configuration을 실행 가능한 Runtime 설정으로 반환한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow(),
      );

      vi.mocked(getPublishedAiPromptVersionForAgent).mockResolvedValue(
        publishedPrompt,
      );

      vi.mocked(getActiveAiModelConfigById).mockResolvedValue(chatModel);

      const result = await resolveAiRuntimeChatConfiguration({
        featureKey: "note-chat",
        roleKey: "answer-generation",
      });

      expect(result).toEqual({
        kind: "chat",
        featureKey: "note-chat",
        roleKey: "answer-generation",
        model: chatModel,
        prompt: publishedPrompt,
        temperature: 0.2,
      });

      expect(getPublishedAiPromptVersionForAgent).toHaveBeenCalledWith({
        agentId: "agent-id",
        promptVersionId: "prompt-version-id",
      });

      expect(getActiveAiModelConfigById).toHaveBeenCalledWith({
        expectedCapability: AI_MODEL_CAPABILITY.CHAT,
        modelConfigId: "chat-model-id",
      });
    });

    it("Embedding Configuration을 Chat으로 요청하면 kind mismatch로 즉시 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createEmbeddingRow(),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "note-retrieval",
        }),
      ).rejects.toThrow(
        "AI runtime configuration kind mismatch: expected chat, received embedding: note-chat/note-retrieval",
      );

      expect(getPublishedAiPromptVersionForAgent).not.toHaveBeenCalled();

      expect(getActiveAiModelConfigById).not.toHaveBeenCalled();
    });

    it("Prompt Version ID가 없으면 잘못된 Chat Configuration으로 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow({
          prompt_version_id: null,
        }),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow(
        "Invalid chat AI runtime configuration: note-chat/answer-generation",
      );

      expect(getPublishedAiPromptVersionForAgent).not.toHaveBeenCalled();

      expect(getActiveAiModelConfigById).not.toHaveBeenCalled();
    });

    it("Temperature가 없으면 잘못된 Chat Configuration으로 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow({
          temperature: null,
        }),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow(
        "Invalid chat AI runtime configuration: note-chat/answer-generation",
      );
    });

    it("Prompt Version 관계를 찾을 수 없으면 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow({
          ai_prompt_versions: null,
        }),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow(
        "AI runtime prompt version not found: note-chat/answer-generation",
      );
    });

    it("Prompt Family 관계를 찾을 수 없으면 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow({
          ai_prompt_versions: {
            id: "prompt-version-id",
            family_id: "prompt-family-id",
            ai_prompt_families: null,
          },
        } as unknown as Partial<RuntimeConfigurationRow>),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow(
        "AI runtime prompt family not found: note-chat/answer-generation",
      );
    });

    it("Published Prompt 검증 실패를 호출자에게 전달한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow(),
      );

      vi.mocked(getPublishedAiPromptVersionForAgent).mockRejectedValue(
        new Error("Prompt version is not published"),
      );

      vi.mocked(getActiveAiModelConfigById).mockResolvedValue(chatModel);

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow("Prompt version is not published");
    });

    it("Chat Model 실행 가능 상태 검증 실패를 호출자에게 전달한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow(),
      );

      vi.mocked(getPublishedAiPromptVersionForAgent).mockResolvedValue(
        publishedPrompt,
      );

      vi.mocked(getActiveAiModelConfigById).mockRejectedValue(
        new Error("AI model config is not active"),
      );

      await expect(
        resolveAiRuntimeChatConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow("AI model config is not active");
    });
  });

  describe("resolveAiRuntimeEmbeddingConfiguration", () => {
    it("유효한 Embedding Configuration을 실행 가능한 Runtime 설정으로 반환한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createEmbeddingRow(),
      );

      vi.mocked(getActiveAiModelConfigById).mockResolvedValue(embeddingModel);

      const result = await resolveAiRuntimeEmbeddingConfiguration({
        featureKey: "note-chat",
        roleKey: "note-retrieval",
      });

      expect(result).toEqual({
        kind: "embedding",
        featureKey: "note-chat",
        roleKey: "note-retrieval",
        model: embeddingModel,
      });

      expect(result).not.toHaveProperty("prompt");
      expect(result).not.toHaveProperty("temperature");

      expect(getActiveAiModelConfigById).toHaveBeenCalledWith({
        expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
        modelConfigId: "embedding-model-id",
      });

      expect(getPublishedAiPromptVersionForAgent).not.toHaveBeenCalled();
    });

    it("Chat Configuration을 Embedding으로 요청하면 kind mismatch로 즉시 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createChatRow(),
      );

      await expect(
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: "note-chat",
          roleKey: "answer-generation",
        }),
      ).rejects.toThrow(
        "AI runtime configuration kind mismatch: expected embedding, received chat: note-chat/answer-generation",
      );

      expect(getPublishedAiPromptVersionForAgent).not.toHaveBeenCalled();

      expect(getActiveAiModelConfigById).not.toHaveBeenCalled();
    });

    it("Embedding Configuration에 Prompt Version이 있으면 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createEmbeddingRow({
          prompt_version_id: "prompt-version-id",
        }),
      );

      await expect(
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: "note-chat",
          roleKey: "note-retrieval",
        }),
      ).rejects.toThrow(
        "Invalid embedding AI runtime configuration: note-chat/note-retrieval",
      );

      expect(getActiveAiModelConfigById).not.toHaveBeenCalled();
    });

    it("Embedding Configuration에 Temperature가 있으면 실패한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createEmbeddingRow({
          temperature: 0.2,
        }),
      );

      await expect(
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: "note-chat",
          roleKey: "note-retrieval",
        }),
      ).rejects.toThrow(
        "Invalid embedding AI runtime configuration: note-chat/note-retrieval",
      );

      expect(getActiveAiModelConfigById).not.toHaveBeenCalled();
    });

    it("Embedding Model 실행 가능 상태 검증 실패를 호출자에게 전달한다", async () => {
      vi.mocked(getAiRuntimeConfigurationRow).mockResolvedValue(
        createEmbeddingRow(),
      );

      vi.mocked(getActiveAiModelConfigById).mockRejectedValue(
        new Error("AI model capability mismatch"),
      );

      await expect(
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: "note-chat",
          roleKey: "note-retrieval",
        }),
      ).rejects.toThrow("AI model capability mismatch");
    });
  });
});
