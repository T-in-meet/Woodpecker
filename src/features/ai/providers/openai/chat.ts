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
 * @throws OpenAI 요청, 응답 파싱 또는 응답 검증에 실패한 경우
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
 *
 * @param params OpenAI JSON Chat Completion 요청에 필요한 값입니다.
 * @returns Provider 공통 Chat Completion 결과입니다.
 * @throws OpenAI 요청, 응답 파싱 또는 응답 검증에 실패한 경우
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
 * OpenAI Chat Completion 요청부터 Provider 공통 응답 변환까지의 공통 경로를 처리합니다.
 *
 * OpenAI 호출이 최종적으로 정상적인 Chat Completion 결과를 생성하지 못한 경우
 * 동일한 운영 오류로 기록하여 요청 방식에 따라 오류 기록이 누락되지 않도록 합니다.
 *
 * @param params OpenAI Chat Completion 요청에 필요한 값입니다.
 * @returns Provider 공통 Chat Completion 결과입니다.
 * @throws OpenAI 요청, 응답 파싱 또는 응답 검증에 실패한 경우
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

  // HTTP 응답을 받은 이후 발생하는 파싱/검증 실패에서도 status를
  // 운영 오류 context에 포함할 수 있도록 요청 범위 밖에서 유지합니다.
  let responseStatus: number | null = null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    responseStatus = response.status;

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(`OpenAI chat failed: ${response.status} ${errorBody}`);
    }

    // HTTP 성공 이후라도 응답 구조가 Provider 계약과 다르면 정상적인
    // Chat Completion으로 사용할 수 없으므로 동일한 Provider 실패로 처리합니다.
    const parsedResponse = openAiChatCompletionResponseSchema.parse(
      (await response.json()) as unknown,
    );

    const content = parsedResponse.choices[0]?.message.content;

    // 정상 HTTP 응답이라도 사용할 수 있는 content가 없으면
    // Chat Completion이 완료되지 않은 것으로 처리합니다.
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
  } catch (error) {
    // 네트워크 요청, HTTP 오류, JSON/schema 파싱, 빈 응답까지
    // OpenAI Chat 실행이 실패하는 Provider 경로를 한 번만 기록합니다.
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      message: "OpenAI Chat 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      context: {
        model: params.model,
        ...(responseStatus === null
          ? {}
          : {
              status: responseStatus,
            }),
      },
    });

    throw error;
  }
}

/**
 * Provider 공통 응답 형식을 OpenAI Chat Completions API의
 * `response_format` 형식으로 변환합니다.
 *
 * response format이 없으면 일반 텍스트 응답을 사용하고,
 * JSON Object 또는 JSON Schema 형식이 지정되면 OpenAI 형식으로 변환합니다.
 *
 * @param responseFormat Provider 공통 Chat 응답 형식
 * @returns OpenAI Chat Completions API response_format 또는 undefined
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
 *
 * 스트림 생성뿐 아니라 스트림 소비와 최종 응답 검증까지 하나의 Provider 실행으로
 * 처리하여 실행 도중 발생한 오류가 운영 오류 기록에서 누락되지 않도록 합니다.
 *
 * @param params OpenAI 스트리밍 Chat 요청에 필요한 값입니다.
 * @yields 텍스트 delta와 최종 Provider 공통 스트림 결과
 * @throws OpenAI 스트림 생성, 소비 또는 응답 검증에 실패한 경우
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

  try {
    const stream = await client.chat.completions.create({
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

    // 스트림 생성 성공 이후에도 네트워크 또는 Provider 오류가
    // async iteration 중 발생할 수 있으므로 동일한 오류 경계에서 소비합니다.
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

    // 스트림이 정상 종료되었더라도 실제 content가 없다면 호출자가
    // 정상 Chat 응답으로 사용할 수 없으므로 Provider 실패로 처리합니다.
    if (!content) {
      throw new Error("OpenAI chat stream returned empty content.");
    }
  } catch (error) {
    // 최초 요청뿐 아니라 스트림 소비 및 최종 응답 검증 실패도
    // 동일한 OpenAI Chat 운영 오류로 한 번만 기록합니다.
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
