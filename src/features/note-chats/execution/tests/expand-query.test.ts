import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import { NOTE_CHAT_OPERATIONAL_ERROR_CODES } from "@/features/operational-errors/constants";

import type { NoteChatMessage } from "../../types";
import { reportNoteChatOperationalError } from "../../utils/report-operational-error";
import { expandNoteChatQuery } from "../expand-query";
import { resolveNoteChatProviderMessages } from "../resolve-messages";

vi.mock("@/features/ai/prompts/render", () => ({
  renderPromptTemplate: vi.fn(),
}));

vi.mock("@/features/ai/providers", () => ({
  createAiChatCompletionWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

vi.mock("../resolve-messages", () => ({
  resolveNoteChatProviderMessages: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
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
      system_template: "system {{messages}} {{question}}",
      user_template: "user {{messages}} {{question}}",
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
      system_template: "system {{messages}} {{question}}",
      user_template: "user {{messages}} {{question}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

const userMessage = {
  content: {
    text: "현재 질문",
  },
  conversation_id: "conversation-1",
  created_at: "2026-08-11T00:00:00.000Z",
  id: "message-3",
  role: AI_CHAT_MESSAGE_ROLE.USER,
  sequence_number: 3,
  updated_at: "2026-08-11T00:00:00.000Z",
};

const previousMessages = [
  {
    content: {
      text: "이전 질문",
    },
    conversation_id: "conversation-1",
    created_at: "2026-08-11T00:00:00.000Z",
    id: "message-1",
    role: AI_CHAT_MESSAGE_ROLE.USER,
    sequence_number: 1,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
  {
    content: {
      text: "이전 답변",
    },
    conversation_id: "conversation-1",
    created_at: "2026-08-11T00:00:00.000Z",
    id: "message-2",
    role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
    sequence_number: 2,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
];

const messages = [
  ...previousMessages,
  userMessage,
] as unknown as NoteChatMessage[];

const providerHistoryMessages = [
  {
    role: AI_CHAT_MESSAGE_ROLE.USER,
    content: "이전 질문",
  },
  {
    role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
    content: "이전 답변",
  },
];

/**
 * 질의 확장 Chat Completion에서 사용한 token 사용량입니다.
 */
const queryExpansionUsage = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

const createCompletionResult = (content: string) =>
  ({
    content,
    usage: queryExpansionUsage,
  }) as Awaited<ReturnType<typeof createAiChatCompletionWithProvider>>;

describe("expandNoteChatQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");

    vi.mocked(renderPromptTemplate)
      .mockReturnValueOnce("렌더링된 System Prompt")
      .mockReturnValueOnce("렌더링된 User Prompt");

    vi.mocked(resolveNoteChatProviderMessages).mockReturnValue(
      providerHistoryMessages,
    );

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue(
      createCompletionResult(
        JSON.stringify({
          expandedQuery: "확장된 검색 질의",
        }),
      ),
    );

    vi.mocked(reportNoteChatOperationalError).mockResolvedValue(undefined);
  });

  it("현재 질문과 이전 대화를 사용해 확장된 검색 질의와 usage를 반환한다", async () => {
    const result = await expandNoteChatQuery({
      configuration,
      messages,
      userMessageId: "message-3",
    });

    expect(result).toEqual({
      expandedQuery: "확장된 검색 질의",
      usage: queryExpansionUsage,
    });

    expect(resolveNoteChatProviderMessages).toHaveBeenCalledWith(
      previousMessages,
    );

    expect(renderPromptTemplate).toHaveBeenNthCalledWith(
      1,
      "system {{messages}} {{question}}",
      {
        messages: "user: 이전 질문\nassistant: 이전 답변",
        question: "현재 질문",
      },
    );

    expect(renderPromptTemplate).toHaveBeenNthCalledWith(
      2,
      "user {{messages}} {{question}}",
      {
        messages: "user: 이전 질문\nassistant: 이전 답변",
        question: "현재 질문",
      },
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

  it("현재 User Message를 찾을 수 없으면 오류를 발생시킨다", async () => {
    await expect(
      expandNoteChatQuery({
        configuration,
        messages,
        userMessageId: "missing-message",
      }),
    ).rejects.toThrow("Note chat user message not found: missing-message");

    expect(resolveNoteChatProviderMessages).not.toHaveBeenCalled();
    expect(createAiChatCompletionWithProvider).not.toHaveBeenCalled();
  });

  it("현재 실행 대상 Message가 User Message가 아니면 오류를 발생시킨다", async () => {
    const assistantMessage = {
      ...userMessage,
      role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
    } as unknown as NoteChatMessage;

    await expect(
      expandNoteChatQuery({
        configuration,
        messages: [assistantMessage],
        userMessageId: "message-3",
      }),
    ).rejects.toThrow(
      "Note chat execution message is not a user message: message-3",
    );

    expect(resolveNoteChatProviderMessages).not.toHaveBeenCalled();
    expect(createAiChatCompletionWithProvider).not.toHaveBeenCalled();
  });

  it("현재 질문 이후의 메시지는 질의 확장 이력에서 제외한다", async () => {
    const laterMessage = {
      content: {
        text: "현재 질문 이후의 메시지",
      },
      conversation_id: "conversation-1",
      created_at: "2026-08-11T00:00:00.000Z",
      id: "message-4",
      role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
      sequence_number: 4,
      updated_at: "2026-08-11T00:00:00.000Z",
    } as unknown as NoteChatMessage;

    await expandNoteChatQuery({
      configuration,
      messages: [...messages, laterMessage],
      userMessageId: "message-3",
    });

    expect(resolveNoteChatProviderMessages).toHaveBeenCalledWith(
      previousMessages,
    );
  });

  it("Response Schema가 있으면 Provider JSON Schema 응답 형식을 전달한다", async () => {
    await expandNoteChatQuery({
      configuration: configurationWithSchema,
      messages,
      userMessageId: "message-3",
    });

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "note_chat_query_expansion_response",
            schema: responseSchema,
            strict: true,
          },
        },
      }),
    );
  });

  it("Provider 응답이 유효한 JSON이 아니면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = new Error(
      "Note chat query expansion response is not valid JSON.",
    );

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue(
      createCompletionResult("invalid json"),
    );

    await expect(
      expandNoteChatQuery({
        configuration,
        messages,
        userMessageId: "message-3",
      }),
    ).rejects.toThrow(error.message);

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          userMessageId: "message-3",
        },
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
        error,
      }),
    );
  });

  it("JSON은 유효하지만 Response Schema를 만족하지 않으면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = new Error(
      "Note chat query expansion response does not match the expected schema.",
    );

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue(
      createCompletionResult(
        JSON.stringify({
          expandedQuery: "",
        }),
      ),
    );

    await expect(
      expandNoteChatQuery({
        configuration,
        messages,
        userMessageId: "message-3",
      }),
    ).rejects.toThrow(error.message);

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          userMessageId: "message-3",
        },
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
        error,
      }),
    );
  });
});
