import { describe, expect, it, vi } from "vitest";

import { streamAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiChatStreamEvent } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";

import { startNoteChatProviderStream } from "../start-provider-stream";

vi.mock("@/features/ai/providers", () => ({
  streamAiChatCompletionWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

const providerStream = async function* (): AsyncGenerator<AiChatStreamEvent> {
  yield {
    type: "text-delta",
    delta: "답변",
  };
};

const createPrepared = (
  responseSchema: Record<string, unknown> | null = null,
) =>
  ({
    settings: {
      chat: {
        model: {
          provider: "openai",
          model: "gpt-4.1-mini",
        },
        prompt: {
          version: {
            response_schema: responseSchema,
          },
        },
        temperature: 0.7,
      },
    },
    messages: [
      {
        role: "user",
        content: "질문입니다.",
      },
    ],
  }) as Parameters<typeof startNoteChatProviderStream>[0];

describe("startNoteChatProviderStream", () => {
  it("준비된 실행 정보를 Provider 스트림 호출에 전달한다", () => {
    const stream = providerStream();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(streamAiChatCompletionWithProvider).mockReturnValue(stream);

    const prepared = createPrepared();

    const result = startNoteChatProviderStream(prepared);

    expect(getProviderApiKey).toHaveBeenCalledWith("openai");

    expect(streamAiChatCompletionWithProvider).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      messages: prepared.messages,
      model: "gpt-4.1-mini",
      provider: "openai",
      responseFormat: undefined,
      temperature: 0.7,
    });

    expect(result).toBe(stream);
  });

  it("Prompt Version에 Response Schema가 있으면 structured output 설정을 전달한다", () => {
    const stream = providerStream();

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(streamAiChatCompletionWithProvider).mockReturnValue(stream);

    const responseSchema = {
      type: "object",
      properties: {
        answer: {
          type: "string",
        },
      },
      required: ["answer"],
    };

    const prepared = createPrepared(responseSchema);

    startNoteChatProviderStream(prepared);

    expect(streamAiChatCompletionWithProvider).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      messages: prepared.messages,
      model: "gpt-4.1-mini",
      provider: "openai",
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "note_chat_response",
          schema: responseSchema,
          strict: true,
        },
      },
      temperature: 0.7,
    });
  });
});
