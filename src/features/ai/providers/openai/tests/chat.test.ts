import OpenAI from "openai";
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
  createOpenAiChatCompletion,
  createOpenAiJsonChatCompletion,
  streamOpenAiChatCompletion,
} from "../chat";

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("openai", () => ({
  default: vi.fn(),
}));

const originalFetch = globalThis.fetch;

const API_KEY = "test-openai-api-key";
const MODEL = "gpt-test";
const TEMPERATURE = 0.2;

const baseParams = {
  apiKey: "test-api-key",
  model: "gpt-4o-mini",
  systemPrompt: "시스템 프롬프트",
  temperature: 0.2,
  userPrompt: "사용자 프롬프트",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/**
 * 테스트용 fetch 응답을 생성합니다.
 *
 * @param body JSON 응답 본문
 * @param options 응답 상태 설정
 * @returns fetch Response mock
 */
function createJsonResponse(
  body: unknown,
  options: {
    ok?: boolean;
    status?: number;
    text?: string;
  } = {},
) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: vi.fn().mockResolvedValue(options.text ?? ""),
  } as unknown as Response;
}

/**
 * AsyncGenerator가 반환한 모든 스트림 이벤트를 배열로 수집합니다.
 *
 * @param stream 수집할 AI Chat 스트림
 * @returns 스트림에서 순서대로 반환된 이벤트 목록
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

/**
 * OpenAI SDK 스트림 응답으로 사용할 비동기 반복 객체를 생성합니다.
 *
 * @param chunks 스트림에서 순차적으로 반환할 OpenAI 응답 청크
 * @returns 비동기 반복이 가능한 스트림 객체
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
 * 일부 청크를 반환한 뒤 오류가 발생하는 비동기 반복 객체를 생성합니다.
 *
 * 스트림 객체 생성 이후 실제 소비 단계에서 발생한 오류가
 * 운영 오류로 기록되는지 검증할 때 사용합니다.
 *
 * @param chunks 오류 발생 전에 반환할 스트림 청크
 * @param error 스트림 소비 중 발생시킬 오류
 * @returns 마지막에 오류를 발생시키는 비동기 반복 객체
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
 * OpenAI SDK Client Mock을 구성합니다.
 *
 * @param chunks Chat Completions 스트림에서 반환할 청크
 * @returns 요청 검증에 사용할 create Mock
 */
function mockOpenAiStream(chunks: unknown[]) {
  const create = vi.fn().mockResolvedValue(createAsyncIterable(chunks));

  vi.mocked(OpenAI).mockImplementation(function MockOpenAI() {
    return {
      chat: {
        completions: {
          create,
        },
      },
    };
  } as never);

  return {
    create,
  };
}

describe("createOpenAiChatCompletion", () => {
  it("일반 Chat Completion 요청을 보내고 결과를 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "응답 내용",
            },
          },
        ],
        created: 123,
        id: "chatcmpl-test",
        model: "gpt-4o-mini-2024-07-18",
        system_fingerprint: "fp-test",
        usage: {
          completion_tokens: 20,
          prompt_tokens: 10,
          total_tokens: 30,
        },
      }),
    );

    globalThis.fetch = fetchMock;

    const result = await createOpenAiChatCompletion(baseParams);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      {
        body: JSON.stringify({
          messages: [
            {
              content: "시스템 프롬프트",
              role: "system",
            },
            {
              content: "사용자 프롬프트",
              role: "user",
            },
          ],
          model: "gpt-4o-mini",
          temperature: 0.2,
        }),
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    expect(result).toEqual({
      content: "응답 내용",
      metadata: {
        created: 123,
        finishReason: "stop",
        provider: "openai",
        requestedModel: "gpt-4o-mini",
        responseId: "chatcmpl-test",
        responseModel: "gpt-4o-mini-2024-07-18",
        systemFingerprint: "fp-test",
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("usage가 없으면 토큰 수를 0으로 반환한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content: "응답 내용",
            },
          },
        ],
      }),
    );

    const result = await createOpenAiChatCompletion(baseParams);

    expect(result).toEqual({
      content: "응답 내용",
      metadata: {
        created: null,
        finishReason: null,
        provider: "openai",
        requestedModel: "gpt-4o-mini",
        responseId: null,
        responseModel: null,
        systemFingerprint: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    });
  });

  it("total_tokens가 없으면 입력과 출력 토큰 합계를 사용한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content: "응답 내용",
            },
          },
        ],
        usage: {
          completion_tokens: 7,
          prompt_tokens: 5,
        },
      }),
    );

    const result = await createOpenAiChatCompletion(baseParams);

    expect(result.usage).toEqual({
      inputTokens: 5,
      outputTokens: 7,
      totalTokens: 12,
    });
  });

  it("JSON Schema response format을 OpenAI 요청 형식으로 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content:
                '{"answer":"응답","referencedNoteIds":["11111111-1111-4111-8111-111111111111"]}',
            },
          },
        ],
      }),
    );

    globalThis.fetch = fetchMock;

    await createOpenAiChatCompletion({
      ...baseParams,
      responseFormat: {
        jsonSchema: {
          name: "notes_rag_answer",
          schema: {
            additionalProperties: false,
            properties: {
              answer: { type: "string" },
              referencedNoteIds: {
                items: { type: "string" },
                type: "array",
              },
            },
            required: ["answer", "referencedNoteIds"],
            type: "object",
          },
          strict: true,
        },
        type: "json_schema",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [
            {
              content: "시스템 프롬프트",
              role: "system",
            },
            {
              content: "사용자 프롬프트",
              role: "user",
            },
          ],
          model: "gpt-4o-mini",
          response_format: {
            json_schema: {
              name: "notes_rag_answer",
              schema: {
                additionalProperties: false,
                properties: {
                  answer: { type: "string" },
                  referencedNoteIds: {
                    items: { type: "string" },
                    type: "array",
                  },
                },
                required: ["answer", "referencedNoteIds"],
                type: "object",
              },
              strict: true,
            },
            type: "json_schema",
          },
          temperature: 0.2,
        }),
      }),
    );
  });

  it("OpenAI 응답이 실패하면 운영 오류를 한 번 기록하고 상태와 응답 본문을 포함한 예외를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse(null, {
        ok: false,
        status: 429,
        text: "rate limit exceeded",
      }),
    );

    await expect(createOpenAiChatCompletion(baseParams)).rejects.toThrow(
      "OpenAI chat failed: 429 rate limit exceeded",
    );

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: baseParams.model,
          status: 429,
        },
      }),
    );
  });

  it("네트워크 요청이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("network failed");

    globalThis.fetch = vi.fn().mockRejectedValue(error);

    await expect(createOpenAiChatCompletion(baseParams)).rejects.toThrow(
      "network failed",
    );

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: baseParams.model,
        },
      }),
    );
  });

  it.each([null, ""])(
    "응답 content가 %s이면 운영 오류를 기록하고 예외를 던진다",
    async (content) => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        createJsonResponse({
          choices: [
            {
              message: {
                content,
              },
            },
          ],
        }),
      );

      await expect(createOpenAiChatCompletion(baseParams)).rejects.toThrow(
        "OpenAI chat returned empty content.",
      );

      expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
      expect(reportAiOperationalError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
          operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
          stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
          context: {
            model: baseParams.model,
            status: 200,
          },
        }),
      );
    },
  );

  it("응답 choices가 없으면 운영 오류를 기록하고 schema validation 예외를 던진다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [],
      }),
    );

    await expect(createOpenAiChatCompletion(baseParams)).rejects.toThrow();

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: baseParams.model,
          status: 200,
        },
      }),
    );
  });
});

describe("createOpenAiJsonChatCompletion", () => {
  it("JSON object 응답 형식을 포함해 요청한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        choices: [
          {
            message: {
              content: '{"answer":"응답"}',
            },
          },
        ],
      }),
    );

    globalThis.fetch = fetchMock;

    const result = await createOpenAiJsonChatCompletion(baseParams);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          messages: [
            {
              content: "시스템 프롬프트",
              role: "system",
            },
            {
              content: "사용자 프롬프트",
              role: "user",
            },
          ],
          model: "gpt-4o-mini",
          response_format: {
            type: "json_object",
          },
          temperature: 0.2,
        }),
      }),
    );

    expect(result).toEqual({
      content: '{"answer":"응답"}',
      metadata: {
        created: null,
        finishReason: null,
        provider: "openai",
        requestedModel: "gpt-4o-mini",
        responseId: null,
        responseModel: null,
        systemFingerprint: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });
});

describe("streamOpenAiChatCompletion", () => {
  it("messages 기반 OpenAI 스트리밍 요청을 생성한다", async () => {
    const { create } = mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              content: "안녕하세요.",
            },
            finish_reason: null,
          },
        ],
        created: 1_754_500_000,
        id: "chatcmpl-test",
        model: MODEL,
        system_fingerprint: "fp-test",
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        created: 1_754_500_000,
        id: "chatcmpl-test",
        model: MODEL,
        system_fingerprint: "fp-test",
        usage: {
          completion_tokens: 3,
          prompt_tokens: 7,
          total_tokens: 10,
        },
      },
    ]);

    const messages = [
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "도움이 되는 AI입니다.",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "인사해 주세요.",
      },
    ];

    await collectStreamEvents(
      streamOpenAiChatCompletion({
        apiKey: API_KEY,
        messages,
        model: MODEL,
        temperature: TEMPERATURE,
      }),
    );

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: API_KEY,
    });

    expect(create).toHaveBeenCalledWith({
      messages,
      model: MODEL,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      temperature: TEMPERATURE,
    });

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("텍스트 조각을 수신 순서대로 반환하고 최종 결과에 전체 내용을 누적한다", async () => {
    mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              content: "첫 번째 ",
            },
            finish_reason: null,
          },
        ],
        created: 1_754_500_000,
        id: "chatcmpl-test",
        model: MODEL,
        system_fingerprint: "fp-test",
      },
      {
        choices: [
          {
            delta: {
              content: "두 번째",
            },
            finish_reason: null,
          },
        ],
        created: 1_754_500_000,
        id: "chatcmpl-test",
        model: MODEL,
        system_fingerprint: "fp-test",
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        created: 1_754_500_000,
        id: "chatcmpl-test",
        model: MODEL,
        system_fingerprint: "fp-test",
        usage: {
          completion_tokens: 4,
          prompt_tokens: 6,
          total_tokens: 10,
        },
      },
    ]);

    const events = await collectStreamEvents(
      streamOpenAiChatCompletion({
        apiKey: API_KEY,
        messages: [
          {
            role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
            content: "응답을 생성해 주세요.",
          },
        ],
        model: MODEL,
        temperature: TEMPERATURE,
      }),
    );

    expect(events).toEqual([
      {
        type: "text-delta",
        delta: "첫 번째 ",
      },
      {
        type: "text-delta",
        delta: "두 번째",
      },
      {
        type: "finish",
        result: {
          content: "첫 번째 두 번째",
          metadata: {
            created: 1_754_500_000,
            finishReason: "stop",
            provider: "openai",
            requestedModel: MODEL,
            responseId: "chatcmpl-test",
            responseModel: MODEL,
            systemFingerprint: "fp-test",
            usage: {
              inputTokens: 6,
              outputTokens: 4,
              totalTokens: 10,
            },
          },
          usage: {
            inputTokens: 6,
            outputTokens: 4,
            totalTokens: 10,
          },
        },
      },
    ]);

    expect(reportAiOperationalError).not.toHaveBeenCalled();
  });

  it("내용이 없는 role 전용 청크는 텍스트 이벤트로 반환하지 않는다", async () => {
    mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              role: "assistant",
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {
              content: "실제 응답",
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
    ]);

    const events = await collectStreamEvents(
      streamOpenAiChatCompletion({
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
      delta: "실제 응답",
    });

    expect(events[1]).toMatchObject({
      type: "finish",
      result: {
        content: "실제 응답",
      },
    });
  });

  it("usage가 없으면 token 수를 0으로 반환한다", async () => {
    mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              content: "응답",
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
    ]);

    const events = await collectStreamEvents(
      streamOpenAiChatCompletion({
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

    expect(events.at(-1)).toMatchObject({
      type: "finish",
      result: {
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      },
    });
  });

  it("total token이 없으면 input과 output token의 합을 사용한다", async () => {
    mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              content: "응답",
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
        usage: {
          completion_tokens: 4,
          prompt_tokens: 6,
        },
      },
    ]);

    const events = await collectStreamEvents(
      streamOpenAiChatCompletion({
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

    expect(events.at(-1)).toMatchObject({
      type: "finish",
      result: {
        usage: {
          inputTokens: 6,
          outputTokens: 4,
          totalTokens: 10,
        },
      },
    });
  });

  it("텍스트 내용이 없는 스트림은 운영 오류를 기록하고 예외를 발생시킨다", async () => {
    mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              role: "assistant",
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
    ]);

    await expect(
      collectStreamEvents(
        streamOpenAiChatCompletion({
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
    ).rejects.toThrow("OpenAI chat stream returned empty content.");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("OpenAI SDK 요청이 실패하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("OpenAI request failed");
    const create = vi.fn().mockRejectedValue(error);

    vi.mocked(OpenAI).mockImplementation(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create,
          },
        },
      };
    } as never);

    await expect(
      collectStreamEvents(
        streamOpenAiChatCompletion({
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
    ).rejects.toThrow("OpenAI request failed");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("OpenAI 스트림 소비 중 오류가 발생하면 운영 오류를 기록하고 오류를 전달한다", async () => {
    const error = new Error("OpenAI stream failed");
    const create = vi.fn().mockResolvedValue(
      createFailingAsyncIterable(
        [
          {
            choices: [
              {
                delta: {
                  content: "일부 응답",
                },
                finish_reason: null,
              },
            ],
            id: "chatcmpl-test",
            model: MODEL,
          },
        ],
        error,
      ),
    );

    vi.mocked(OpenAI).mockImplementation(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create,
          },
        },
      };
    } as never);

    await expect(
      collectStreamEvents(
        streamOpenAiChatCompletion({
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
    ).rejects.toThrow("OpenAI stream failed");

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        context: {
          model: MODEL,
        },
      }),
    );
  });

  it("JSON Schema response format을 OpenAI 스트리밍 요청에 전달한다", async () => {
    const { create } = mockOpenAiStream([
      {
        choices: [
          {
            delta: {
              content: '{"answer":"응답"}',
            },
            finish_reason: null,
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
      },
      {
        choices: [
          {
            delta: {},
            finish_reason: "stop",
          },
        ],
        id: "chatcmpl-test",
        model: MODEL,
        usage: {
          completion_tokens: 3,
          prompt_tokens: 5,
          total_tokens: 8,
        },
      },
    ]);

    await collectStreamEvents(
      streamOpenAiChatCompletion({
        apiKey: API_KEY,
        messages: [
          {
            role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
            content: "질문",
          },
        ],
        model: MODEL,
        responseFormat: {
          jsonSchema: {
            name: "answer_response",
            schema: {
              additionalProperties: false,
              properties: {
                answer: {
                  type: "string",
                },
              },
              required: ["answer"],
              type: "object",
            },
            strict: true,
          },
          type: "json_schema",
        },
        temperature: TEMPERATURE,
      }),
    );

    expect(create).toHaveBeenCalledWith({
      messages: [
        {
          role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
          content: "질문",
        },
      ],
      model: MODEL,
      response_format: {
        json_schema: {
          name: "answer_response",
          schema: {
            additionalProperties: false,
            properties: {
              answer: {
                type: "string",
              },
            },
            required: ["answer"],
            type: "object",
          },
          strict: true,
        },
        type: "json_schema",
      },
      stream: true,
      stream_options: {
        include_usage: true,
      },
      temperature: TEMPERATURE,
    });
  });
});
