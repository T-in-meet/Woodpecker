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

const API_KEY = "google-api-key";
const MODEL = "gemini-2.5-flash";
const TEMPERATURE = 0.2;
const SYSTEM_PROMPT = "당신은 유용한 AI 도우미입니다.";
const USER_PROMPT = "테스트 질문입니다.";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 테스트용 async iterable을 생성합니다.
 *
 * @param chunks 순서대로 반환할 스트림 chunk
 * @returns 전달된 chunk를 순차적으로 반환하는 async iterable
 */
function createAsyncIterable<T>(chunks: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * 일부 chunk를 반환한 뒤 오류가 발생하는 테스트용 async iterable을 생성합니다.
 *
 * 스트림 생성 이후 소비 단계에서 발생하는 오류가 Provider 운영 오류로
 * 기록되는지 검증하기 위해 사용합니다.
 *
 * @param chunks 오류 발생 전에 반환할 스트림 chunk
 * @param error 스트림 소비 중 발생시킬 오류
 * @returns 마지막에 오류를 발생시키는 async iterable
 */
function createFailingAsyncIterable<T>(
  chunks: T[],
  error: Error,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }

      throw error;
    },
  };
}

/**
 * Google SDK 스트림 mock에 정상 종료 async iterable을 설정합니다.
 *
 * @param chunks 스트림에서 반환할 chunk 목록
 */
function mockGoogleStream(chunks: unknown[]): void {
  generateContentStreamMock.mockResolvedValue(createAsyncIterable(chunks));
}

/**
 * 스트림 Generator가 반환하는 이벤트를 모두 수집합니다.
 *
 * @param stream Google Chat 스트림 Generator
 * @returns 발생한 스트림 이벤트 목록
 */
async function collectStreamEvents(
  stream: AsyncGenerator<AiChatStreamEvent>,
): Promise<AiChatStreamEvent[]> {
  const events: AiChatStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

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
    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("API 응답이 실패하면 운영 오류를 한 번 기록하고 오류를 전달한다", async () => {
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

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 401,
        },
      }),
    );
  });

  it("네트워크 요청이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("network failed");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));

    await expect(
      createGoogleChatCompletion({
        apiKey: API_KEY,
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        userPrompt: USER_PROMPT,
      }),
    ).rejects.toThrow("network failed");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("응답에 content가 없으면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
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

    await expect(
      createGoogleChatCompletion({
        apiKey: API_KEY,
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        userPrompt: USER_PROMPT,
      }),
    ).rejects.toThrow("Google chat returned empty content.");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
          status: 200,
        },
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
          headers: {
            "Content-Type": "application/json",
          },
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

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.any(String),
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(JSON.parse(requestInit.body as string)).toEqual(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          responseMimeType: "application/json",
        }),
      }),
    );

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });
});

describe("streamGoogleChatCompletion", () => {
  it("Google SDK 요청이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("Google request failed");

    generateContentStreamMock.mockRejectedValue(error);

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

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("스트림 소비 중 오류가 발생하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("Google stream failed");

    generateContentStreamMock.mockResolvedValue(
      createFailingAsyncIterable(
        [
          {
            text: "일부 응답",
          },
        ],
        error,
      ),
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
    ).rejects.toThrow("Google stream failed");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("스트림에 content가 없으면 운영 오류를 기록하고 오류를 전달한다", async () => {
    mockGoogleStream([
      {
        candidates: [
          {
            finishReason: "STOP",
          },
        ],
      },
    ]);

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
    ).rejects.toThrow("Google chat stream returned empty content.");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
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
        usage: {
          inputTokens: 5,
          outputTokens: 3,
          totalTokens: 8,
        },
      },
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });
});
