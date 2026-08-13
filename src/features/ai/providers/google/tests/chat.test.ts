import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { reportAiOperationalError } from "../../../utils/report-ai-operational-error";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "../../constants";
import type { AiChatStreamEvent } from "../../types";
import {
  createGoogleChatCompletion,
  createGoogleJsonChatCompletion,
  streamGoogleChatCompletion,
} from "../chat";

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn().mockResolvedValue(undefined),
}));

const API_KEY = "google-api-key";
const MODEL = "gemini-2.5-flash";
const TEMPERATURE = 0.2;
const SYSTEM_PROMPT = "당신은 유용한 AI 도우미입니다.";
const USER_PROMPT = "테스트 질문입니다.";

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGoogleChatCompletion", () => {
  it("Google Chat API를 호출하고 공통 응답 형식으로 변환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "테스트 응답입니다.",
                  },
                ],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
          modelVersion: "gemini-2.5-flash-001",
          responseId: "response-id",
          usageMetadata: {
            candidatesTokenCount: 5,
            promptTokenCount: 10,
            totalTokenCount: 15,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleChatCompletion({
      apiKey: API_KEY,
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      temperature: TEMPERATURE,
      userPrompt: USER_PROMPT,
    });

    expect(result.content).toBe("테스트 응답입니다.");
    expect(result.metadata).toEqual(
      expect.objectContaining({
        provider: "google",
      }),
    );
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("API 응답이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("invalid api key", {
        status: 401,
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGoogleChatCompletion({
        apiKey: API_KEY,
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        userPrompt: USER_PROMPT,
      }),
    ).rejects.toThrow("Google chat failed: 401 invalid api key");

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      }),
    );
  });
});

describe("createGoogleJsonChatCompletion", () => {
  it("JSON Object 응답 형식으로 요청한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"answer":"응답"}',
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        }),
        {
          status: 200,
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleJsonChatCompletion({
      apiKey: API_KEY,
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      temperature: TEMPERATURE,
      userPrompt: USER_PROMPT,
    });

    expect(result.content).toBe('{"answer":"응답"}');
  });
});

const { generateContentStreamMock } = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return {
      models: {
        generateContentStream: generateContentStreamMock,
      },
    };
  }),
}));

function createAsyncIterable<T>(chunks: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function mockGoogleStream(chunks: unknown[]): void {
  generateContentStreamMock.mockResolvedValue(createAsyncIterable(chunks));
}

async function collectStreamEvents(
  stream: AsyncGenerator<AiChatStreamEvent>,
): Promise<AiChatStreamEvent[]> {
  const events: AiChatStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("streamGoogleChatCompletion", () => {
  it("Google SDK 요청 오류를 전달한다", async () => {
    generateContentStreamMock.mockRejectedValue(
      new Error("Google request failed"),
    );

    await expect(
      collectStreamEvents(
        streamGoogleChatCompletion({
          apiKey: API_KEY,
          messages: [
            {
              role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
              content: "질문",
            },
          ],
          model: MODEL,
          temperature: TEMPERATURE,
        }),
      ),
    ).rejects.toThrow("Google request failed");
  });

  it("텍스트 delta와 finish 이벤트를 반환한다", async () => {
    mockGoogleStream([
      {
        text: "응답",
        candidates: [
          {
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    ]);

    const events = await collectStreamEvents(
      streamGoogleChatCompletion({
        apiKey: API_KEY,
        messages: [
          {
            role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
            content: "질문",
          },
        ],
        model: MODEL,
        temperature: TEMPERATURE,
      }),
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "text-delta",
      delta: "응답",
    });
    expect(events[1]).toMatchObject({
      type: "finish",
      result: {
        content: "응답",
        metadata: {
          provider: "google",
        },
      },
    });
  });
});
