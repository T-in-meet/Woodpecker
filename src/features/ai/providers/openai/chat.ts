import OpenAI from "openai";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import type {
  AiChatCompletionResult,
  AiChatResponseFormat,
  AiChatStreamEvent,
  AiChatStreamParams,
  AiChatStreamResult,
  AiTokenUsage,
} from "../types";
import { openAiChatCompletionResponseSchema } from "./schema";

/**
 * OpenAI Chat Completions API를 호출하고 공통 Chat Completion 결과로 변환합니다.
 *
 * @param params OpenAI Chat Completion 요청에 필요한 값입니다.
 * @returns Provider 공통 Chat Completion 결과입니다.
 */
export async function createOpenAiChatCompletion(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: AiChatResponseFormat | undefined;
}): Promise<AiChatCompletionResult> {
  return createOpenAiChatCompletionInternal({
    params,
  });
}

/**
 * OpenAI Chat Completions API를 JSON Object 응답 형식으로 호출합니다.
 */
export async function createOpenAiJsonChatCompletion(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
}): Promise<AiChatCompletionResult> {
  return createOpenAiChatCompletionInternal({
    params: {
      ...params,
      responseFormat: { type: "json_object" },
    },
  });
}

/**
 * OpenAI Chat Completion의 공통 요청 및 응답 처리 경로입니다.
 */
async function createOpenAiChatCompletionInternal({
  params,
}: {
  params: {
    apiKey: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    userPrompt: string;
    responseFormat?: AiChatResponseFormat | undefined;
  };
}): Promise<AiChatCompletionResult> {
  const responseFormat = createOpenAiResponseFormat(params.responseFormat);

  const body =
    responseFormat === undefined
      ? {
          messages: [
            { content: params.systemPrompt, role: "system" },
            { content: params.userPrompt, role: "user" },
          ],
          model: params.model,
          temperature: params.temperature,
        }
      : {
          messages: [
            { content: params.systemPrompt, role: "system" },
            { content: params.userPrompt, role: "user" },
          ],
          model: params.model,
          response_format: responseFormat,
          temperature: params.temperature,
        };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    await reportAiOperationalError({
      error: new Error(errorBody),
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      message: "OpenAI Chat 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      context: {
        model: params.model,
        status: response.status,
      },
    });

    throw new Error(`OpenAI chat failed: ${response.status} ${errorBody}`);
  }

  const parsedResponse = openAiChatCompletionResponseSchema.parse(
    (await response.json()) as unknown,
  );

  const content = parsedResponse.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenAI chat returned empty content.");
  }

  const inputTokens = parsedResponse.usage?.prompt_tokens ?? 0;
  const outputTokens = parsedResponse.usage?.completion_tokens ?? 0;
  const totalTokens =
    parsedResponse.usage?.total_tokens ?? inputTokens + outputTokens;

  const usage = {
    inputTokens,
    outputTokens,
    totalTokens,
  };

  return {
    content,
    metadata: {
      created: parsedResponse.created ?? null,
      finishReason: parsedResponse.choices[0]?.finish_reason ?? null,
      provider: "openai",
      requestedModel: params.model,
      responseId: parsedResponse.id ?? null,
      responseModel: parsedResponse.model ?? null,
      systemFingerprint: parsedResponse.system_fingerprint ?? null,
      usage,
    },
    usage,
  };
}

/**
 * Provider 공통 응답 형식을 OpenAI Chat Completions API의
 * `response_format` 형식으로 변환합니다.
 */
function createOpenAiResponseFormat(
  responseFormat: AiChatResponseFormat | undefined,
):
  | {
      type: "json_object";
    }
  | {
      json_schema: {
        name: string;
        schema: { [key: string]: unknown };
        strict: boolean;
      };
      type: "json_schema";
    }
  | undefined {
  if (!responseFormat) {
    return undefined;
  }

  if (responseFormat.type === "json_object") {
    return { type: "json_object" };
  }

  return {
    json_schema: {
      name: responseFormat.jsonSchema.name,
      schema: responseFormat.jsonSchema.schema as {
        [key: string]: unknown;
      },
      strict: responseFormat.jsonSchema.strict,
    },
    type: "json_schema",
  };
}

/**
 * OpenAI Chat Completions API를 스트리밍 방식으로 호출합니다.
 */
export async function* streamOpenAiChatCompletion(
  params: Omit<AiChatStreamParams, "provider">,
): AsyncGenerator<AiChatStreamEvent> {
  const client = new OpenAI({
    apiKey: params.apiKey,
  });

  let content = "";
  let finishReason: string | null = null;
  let responseId: string | null = null;
  let responseModel: string | null = null;
  let created: number | null = null;
  let systemFingerprint: string | null = null;

  let usage: AiTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  const responseFormat = createOpenAiResponseFormat(params.responseFormat);

  let stream;

  try {
    stream = await client.chat.completions.create({
      messages: params.messages,
      model: params.model,
      ...(responseFormat === undefined
        ? {}
        : {
            response_format: responseFormat,
          }),
      stream: true,
      stream_options: {
        include_usage: true,
      },
      temperature: params.temperature,
    });
  } catch (error) {
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      message: "OpenAI Chat streaming 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      context: {
        model: params.model,
      },
    });

    throw error;
  }

  for await (const chunk of stream) {
    responseId = chunk.id ?? responseId;
    responseModel = chunk.model ?? responseModel;
    created = chunk.created ?? created;
    systemFingerprint = chunk.system_fingerprint ?? systemFingerprint;

    const choice = chunk.choices[0];

    if (choice?.finish_reason != null) {
      finishReason = choice.finish_reason;
    }

    const delta = choice?.delta.content;

    if (delta) {
      content += delta;

      yield {
        type: "text-delta",
        delta,
      };
    }

    if (chunk.usage) {
      const inputTokens = chunk.usage.prompt_tokens ?? 0;
      const outputTokens = chunk.usage.completion_tokens ?? 0;

      usage = {
        inputTokens,
        outputTokens,
        totalTokens: chunk.usage.total_tokens ?? inputTokens + outputTokens,
      };
    }
  }

  if (!content) {
    throw new Error("OpenAI chat stream returned empty content.");
  }

  const result: AiChatStreamResult = {
    content,
    metadata: {
      created,
      finishReason,
      provider: "openai",
      requestedModel: params.model,
      responseId,
      responseModel,
      systemFingerprint,
      usage,
    },
    usage,
  };

  yield {
    type: "finish",
    result,
  };
}
