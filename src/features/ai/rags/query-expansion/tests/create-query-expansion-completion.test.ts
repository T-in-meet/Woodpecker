import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";

import {
  createQueryExpansionCompletion,
  type QueryExpansionCompletionResult,
} from "../create-query-expansion-completion";

vi.mock("@/features/ai/prompts/render", () => ({
  renderPromptTemplate: vi.fn(),
}));

vi.mock("@/features/ai/providers", () => ({
  createAiChatCompletionWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

const responseSchema = {
  type: "object",
  properties: {
    expandedQuery: {
      type: "string",
    },
  },
  required: ["expandedQuery"],
  additionalProperties: false,
};

const configuration = {
  model: {
    model: "test-model",
    provider: "openai",
  },
  prompt: {
    version: {
      response_schema: null,
      system_template: "system {{question}}",
      user_template: "user {{question}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

const configurationWithSchema = {
  model: {
    model: "test-model",
    provider: "openai",
  },
  prompt: {
    version: {
      response_schema: responseSchema,
      system_template: "system {{question}}",
      user_template: "user {{question}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

/**
 * 질의 확장 Chat Completion에서 사용한 token 사용량입니다.
 */
const usage = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

const createCompletionResult = (
  content: string,
): Awaited<ReturnType<typeof createAiChatCompletionWithProvider>> =>
  ({
    content,
    usage,
  }) as Awaited<ReturnType<typeof createAiChatCompletionWithProvider>>;

describe("createQueryExpansionCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");

    vi.mocked(renderPromptTemplate)
      .mockReturnValueOnce("렌더링된 System Prompt")
      .mockReturnValueOnce("렌더링된 User Prompt");

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue(
      createCompletionResult(
        JSON.stringify({
          expandedQuery: "확장된 검색 질의",
        }),
      ),
    );
  });

  it("System Prompt와 User Prompt를 변수와 함께 렌더링하고 Provider Completion을 실행한다", async () => {
    const variables = {
      messages: "user: 이전 질문",
      question: "현재 질문",
    };

    const result = await createQueryExpansionCompletion({
      configuration,
      responseSchemaName: "test_query_expansion_response",
      variables,
    });

    expect(result).toEqual<QueryExpansionCompletionResult>({
      content: JSON.stringify({
        expandedQuery: "확장된 검색 질의",
      }),
      usage,
    });

    expect(renderPromptTemplate).toHaveBeenNthCalledWith(
      1,
      "system {{question}}",
      variables,
    );

    expect(renderPromptTemplate).toHaveBeenNthCalledWith(
      2,
      "user {{question}}",
      variables,
    );

    expect(getProviderApiKey).toHaveBeenCalledWith("openai");

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      model: "test-model",
      provider: "openai",
      responseFormat: undefined,
      systemPrompt: "렌더링된 System Prompt",
      temperature: 0.2,
      userPrompt: "렌더링된 User Prompt",
    });
  });

  it("Response Schema가 없으면 Provider에 JSON Schema 응답 형식을 전달하지 않는다", async () => {
    await createQueryExpansionCompletion({
      configuration,
      responseSchemaName: "test_query_expansion_response",
      variables: {
        question: "현재 질문",
      },
    });

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: undefined,
      }),
    );
  });

  it("Response Schema가 있으면 지정한 이름과 함께 Provider JSON Schema 응답 형식을 전달한다", async () => {
    await createQueryExpansionCompletion({
      configuration: configurationWithSchema,
      responseSchemaName: "test_query_expansion_response",
      variables: {
        question: "현재 질문",
      },
    });

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "test_query_expansion_response",
            schema: responseSchema,
            strict: true,
          },
        },
      }),
    );
  });

  it("Provider가 반환한 content와 usage를 그대로 반환한다", async () => {
    const content = JSON.stringify({
      expandedQuery: "원본 Provider 응답",
    });

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue(
      createCompletionResult(content),
    );

    const result = await createQueryExpansionCompletion({
      configuration,
      responseSchemaName: "test_query_expansion_response",
      variables: {
        question: "현재 질문",
      },
    });

    expect(result).toEqual({
      content,
      usage,
    });
  });

  it("Provider 오류를 변환하지 않고 그대로 전파한다", async () => {
    const error = new Error("Provider 호출 실패");

    vi.mocked(createAiChatCompletionWithProvider).mockRejectedValue(error);

    await expect(
      createQueryExpansionCompletion({
        configuration,
        responseSchemaName: "test_query_expansion_response",
        variables: {
          question: "현재 질문",
        },
      }),
    ).rejects.toThrow("Provider 호출 실패");
  });

  it("렌더링된 입력과 Provider 완료 결과를 실행 순서대로 관측한다", async () => {
    const onObservation = vi.fn();
    const variables = { question: "현재 질문" };

    await createQueryExpansionCompletion({
      configuration,
      onObservation,
      responseSchemaName: "test_query_expansion_response",
      variables,
    });

    expect(onObservation.mock.calls.map(([event]) => event.type)).toEqual([
      "prepared",
      "completed",
    ]);
    expect(onObservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        configuration,
        responseFormat: undefined,
        systemPrompt: "렌더링된 System Prompt",
        userPrompt: "렌더링된 User Prompt",
        variables,
      }),
    );
    expect(onObservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        result: expect.objectContaining({ usage }),
      }),
    );
  });

  it("Provider 실패 시 직전 preparation과 원래 오류를 관측한다", async () => {
    const error = new Error("Provider 호출 실패");
    const onObservation = vi.fn();
    vi.mocked(createAiChatCompletionWithProvider).mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createQueryExpansionCompletion({
        configuration,
        onObservation,
        responseSchemaName: "test_query_expansion_response",
        variables: { question: "현재 질문" },
      }),
    ).rejects.toBe(error);

    expect(onObservation.mock.calls.map(([event]) => event.type)).toEqual([
      "prepared",
      "failed",
    ]);
    expect(onObservation).toHaveBeenLastCalledWith({ error, type: "failed" });
  });

  it("관측 callback 실패가 기존 반환값이나 Provider 호출 횟수를 바꾸지 않는다", async () => {
    const observerErrorMessage = "application log에 남지 않을 관측 원문";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onObservation = vi
      .fn()
      .mockRejectedValue(new Error(observerErrorMessage));

    await expect(
      createQueryExpansionCompletion({
        configuration,
        onObservation,
        responseSchemaName: "test_query_expansion_response",
        variables: { question: "현재 질문" },
      }),
    ).resolves.toEqual({
      content: JSON.stringify({ expandedQuery: "확장된 검색 질의" }),
      usage,
    });

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledOnce();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      observerErrorMessage,
    );
  });
});
