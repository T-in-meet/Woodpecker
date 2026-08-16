// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminAiAgentOptions } from "../../agents/hooks/use-admin-ai-agent-queries";
import { useAdminAiModelOptions } from "../../models/hooks/use-admin-ai-model-queries";
import { useAdminAiSettingConfigurationOptions } from "../hooks/use-admin-ai-setting-configuration-options";

vi.mock("../../agents/hooks/use-admin-ai-agent-queries", () => ({
  useAdminAiAgentOptions: vi.fn(),
}));

vi.mock("../../models/hooks/use-admin-ai-model-queries", () => ({
  useAdminAiModelOptions: vi.fn(),
}));

const mockUseAdminAiAgentOptions = vi.mocked(useAdminAiAgentOptions);
const mockUseAdminAiModelOptions = vi.mocked(useAdminAiModelOptions);

describe("useAdminAiSettingConfigurationOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAdminAiAgentOptions.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useAdminAiAgentOptions>);

    mockUseAdminAiModelOptions.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useAdminAiModelOptions>);
  });

  it("Agent, Chat 모델, Embedding 모델 옵션을 조회한다", () => {
    renderHook(() => useAdminAiSettingConfigurationOptions());

    expect(mockUseAdminAiAgentOptions).toHaveBeenCalledTimes(1);

    expect(mockUseAdminAiModelOptions).toHaveBeenCalledTimes(2);
    expect(mockUseAdminAiModelOptions).toHaveBeenCalledWith("chat");
    expect(mockUseAdminAiModelOptions).toHaveBeenCalledWith("embedding");
  });

  it("조회한 Agent를 셀렉트 옵션 형태로 변환한다", () => {
    mockUseAdminAiAgentOptions.mockReturnValue({
      data: [
        {
          id: "agent-1",
          displayName: "노트 답변 Agent",
        },
        {
          id: "agent-2",
          displayName: "Query Expansion Agent",
        },
      ],
    } as unknown as ReturnType<typeof useAdminAiAgentOptions>);

    const { result } = renderHook(() =>
      useAdminAiSettingConfigurationOptions(),
    );

    expect(result.current.agentOptions).toEqual([
      {
        label: "노트 답변 Agent",
        value: "agent-1",
      },
      {
        label: "Query Expansion Agent",
        value: "agent-2",
      },
    ]);
  });

  it("조회한 Chat 모델을 provider와 model이 포함된 옵션 형태로 변환한다", () => {
    mockUseAdminAiModelOptions.mockImplementation((capability) => {
      if (capability === "chat") {
        return {
          data: [
            {
              id: "chat-model-1",
              displayName: "Gemini Chat",
              provider: "google",
              model: "gemini-2.5-flash",
            },
          ],
        } as unknown as ReturnType<typeof useAdminAiModelOptions>;
      }

      return {
        data: [],
      } as unknown as ReturnType<typeof useAdminAiModelOptions>;
    });

    const { result } = renderHook(() =>
      useAdminAiSettingConfigurationOptions(),
    );

    expect(result.current.chatModelOptions).toEqual([
      {
        label: "Gemini Chat · google/gemini-2.5-flash",
        value: "chat-model-1",
      },
    ]);

    expect(result.current.embeddingModelOptions).toEqual([]);
  });

  it("조회한 Embedding 모델을 provider와 model이 포함된 옵션 형태로 변환한다", () => {
    mockUseAdminAiModelOptions.mockImplementation((capability) => {
      if (capability === "embedding") {
        return {
          data: [
            {
              id: "embedding-model-1",
              displayName: "OpenAI Embedding",
              provider: "openai",
              model: "text-embedding-3-small",
            },
          ],
        } as unknown as ReturnType<typeof useAdminAiModelOptions>;
      }

      return {
        data: [],
      } as unknown as ReturnType<typeof useAdminAiModelOptions>;
    });

    const { result } = renderHook(() =>
      useAdminAiSettingConfigurationOptions(),
    );

    expect(result.current.chatModelOptions).toEqual([]);

    expect(result.current.embeddingModelOptions).toEqual([
      {
        label: "OpenAI Embedding · openai/text-embedding-3-small",
        value: "embedding-model-1",
      },
    ]);
  });

  it("Agent, Chat 모델, Embedding 모델을 각각 올바른 옵션 형태로 변환한다", () => {
    mockUseAdminAiAgentOptions.mockReturnValue({
      data: [
        {
          id: "agent-1",
          displayName: "Answer Agent",
        },
      ],
    } as unknown as ReturnType<typeof useAdminAiAgentOptions>);

    mockUseAdminAiModelOptions.mockImplementation((capability) => {
      if (capability === "chat") {
        return {
          data: [
            {
              id: "chat-model-1",
              displayName: "Gemini Chat",
              provider: "google",
              model: "gemini-2.5-flash",
            },
          ],
        } as unknown as ReturnType<typeof useAdminAiModelOptions>;
      }

      return {
        data: [
          {
            id: "embedding-model-1",
            displayName: "OpenAI Embedding",
            provider: "openai",
            model: "text-embedding-3-small",
          },
        ],
      } as unknown as ReturnType<typeof useAdminAiModelOptions>;
    });

    const { result } = renderHook(() =>
      useAdminAiSettingConfigurationOptions(),
    );

    expect(result.current).toEqual({
      agentOptions: [
        {
          label: "Answer Agent",
          value: "agent-1",
        },
      ],
      chatModelOptions: [
        {
          label: "Gemini Chat · google/gemini-2.5-flash",
          value: "chat-model-1",
        },
      ],
      embeddingModelOptions: [
        {
          label: "OpenAI Embedding · openai/text-embedding-3-small",
          value: "embedding-model-1",
        },
      ],
    });
  });

  it("조회 데이터가 없으면 모든 옵션을 빈 배열로 반환한다", () => {
    const { result } = renderHook(() =>
      useAdminAiSettingConfigurationOptions(),
    );

    expect(result.current).toEqual({
      agentOptions: [],
      chatModelOptions: [],
      embeddingModelOptions: [],
    });
  });
});
