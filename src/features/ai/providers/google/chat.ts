import { type Content, GoogleGenAI } from "@google/genai";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "../constants";
import type {
  AiChatCompletionResult,
  AiChatResponseFormat,
  AiChatStreamEvent,
  AiChatStreamParams,
  AiChatStreamResult,
  AiProviderChatMessage,
  AiTokenUsage,
} from "../types";
import { googleChatCompletionResponseSchema } from "./schema";

type GoogleGenerationConfig = {
  responseJsonSchema?: unknown;
  responseMimeType?: "application/json";
  temperature: number;
};

/**
 * Google Gemini GenerateContent API를 호출하고 텍스트 응답을 반환합니다.
 *
 * @param params Google Gemini Chat 요청에 필요한 값
 * @returns Provider 공통 Chat 응답
 * @throws Google Gemini 요청, 응답 파싱 또는 응답 검증에 실패한 경우
 */
export async function createGoogleChatCompletion(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: AiChatResponseFormat | undefined;
}): Promise<AiChatCompletionResult> {
  return createGoogleChatCompletionInternal({
    params,
  });
}

/**
 * Google Gemini GenerateContent API를 호출하고 JSON 문자열 응답을 반환합니다.
 *
 * @param params Google Gemini JSON Chat 요청에 필요한 값
 * @returns Provider 공통 Chat 응답
 * @throws Google Gemini 요청, 응답 파싱 또는 응답 검증에 실패한 경우
 */
export async function createGoogleJsonChatCompletion(params: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
}): Promise<AiChatCompletionResult> {
  return createGoogleChatCompletionInternal({
    params: {
      ...params,
      responseFormat: { type: "json_object" },
    },
  });
}

/**
 * Google Gemini Chat 요청부터 Provider 공통 응답 변환까지의 공통 경로를 처리합니다.
 *
 * Provider 호출이 최종적으로 정상 응답을 생성하지 못한 경우 동일한 Google Chat
 * 운영 오류로 기록하여 호출 방식에 따라 오류 기록이 누락되지 않도록 합니다.
 *
 * @param params Google Gemini Chat 요청에 필요한 값
 * @returns Provider 공통 Chat 응답
 * @throws Google Gemini 요청, 응답 파싱 또는 응답 검증에 실패한 경우
 */
async function createGoogleChatCompletionInternal({
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
  const generationConfig = createGoogleGenerationConfig({
    responseFormat: params.responseFormat,
    temperature: params.temperature,
  });

  // HTTP 응답을 받은 뒤의 실패도 동일한 Provider 오류로 기록할 수 있도록
  // status를 요청 실행 범위 밖에서 유지합니다.
  let responseStatus: number | null = null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: params.userPrompt,
                },
              ],
              role: "user",
            },
          ],
          generationConfig,
          systemInstruction: {
            parts: [
              {
                text: params.systemPrompt,
              },
            ],
          },
        }),
      },
    );

    responseStatus = response.status;

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(`Google chat failed: ${response.status} ${errorBody}`);
    }

    // HTTP 요청 성공 이후에도 Provider 응답 형식이 예상과 다르면
    // 정상적인 Chat 완료로 볼 수 없으므로 Google Chat 실패로 처리합니다.
    const parsedResponse = googleChatCompletionResponseSchema.parse(
      (await response.json()) as unknown,
    );

    const candidate = parsedResponse.candidates?.[0];
    const content = candidate?.content?.parts
      .flatMap((part) => (part.text === undefined ? [] : [part.text]))
      .join("");

    // 요청 자체가 성공했더라도 차단되거나 텍스트 응답이 없으면
    // 호출자가 정상 응답으로 사용할 수 없으므로 Provider 실패로 처리합니다.
    if (!content) {
      const blockReason = parsedResponse.promptFeedback?.blockReason ?? null;

      if (blockReason) {
        throw new Error(`Google chat response was blocked: ${blockReason}`);
      }

      throw new Error("Google chat returned empty content.");
    }

    const inputTokens = parsedResponse.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens =
      parsedResponse.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens =
      parsedResponse.usageMetadata?.totalTokenCount ??
      inputTokens + outputTokens;

    const usage = {
      inputTokens,
      outputTokens,
      totalTokens,
    };

    return {
      content,
      metadata: {
        created: null,
        finishReason: candidate?.finishReason ?? null,
        provider: "google",
        requestedModel: params.model,
        responseId: parsedResponse.responseId ?? null,
        responseModel: parsedResponse.modelVersion ?? params.model,
        systemFingerprint: null,
        usage,
      },
      usage,
    };
  } catch (error) {
    // 네트워크 요청, HTTP 오류, JSON/schema 파싱, 응답 차단/누락까지
    // Google Chat 실행이 실패하는 모든 Provider 경로를 한 번만 기록합니다.
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
      message: "Google Chat 요청에 실패했습니다.",
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
 * Provider 공통 응답 형식을 Google Gemini generationConfig 형식으로 변환합니다.
 *
 * @param params Provider 공통 응답 형식과 temperature
 * @returns Google Gemini generationConfig
 */
function createGoogleGenerationConfig(params: {
  responseFormat: AiChatResponseFormat | undefined;
  temperature: number;
}): GoogleGenerationConfig {
  if (!params.responseFormat) {
    return {
      temperature: params.temperature,
    };
  }

  if (params.responseFormat.type === "json_object") {
    return {
      responseMimeType: "application/json",
      temperature: params.temperature,
    };
  }

  return {
    responseJsonSchema: params.responseFormat.jsonSchema.schema,
    responseMimeType: "application/json",
    temperature: params.temperature,
  };
}

/**
 * Google Gemini GenerateContent API를 messages 기반 스트림으로 호출합니다.
 *
 * 스트림 생성뿐 아니라 스트림 소비와 최종 응답 검증까지 하나의 Provider 실행으로
 * 처리하여 실행 중 발생하는 오류가 운영 오류 기록에서 누락되지 않도록 합니다.
 *
 * @param params Google Gemini 스트리밍 Chat 요청에 필요한 값
 * @yields 텍스트 delta와 최종 Provider 공통 스트림 결과
 * @throws Google Gemini 스트림 생성, 소비 또는 응답 검증에 실패한 경우
 */
export async function* streamGoogleChatCompletion(
  params: Omit<AiChatStreamParams, "provider">,
): AsyncGenerator<AiChatStreamEvent> {
  const client = new GoogleGenAI({
    apiKey: params.apiKey,
  });

  const { contents, systemInstruction } = createGoogleStreamMessages(
    params.messages,
  );

  let content = "";
  let finishReason: string | null = null;
  let responseId: string | null = null;
  let responseModel: string | null = null;
  let created: string | null = null;
  let blockReason: string | null = null;
  let usage: AiTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  const generationConfig = createGoogleGenerationConfig({
    responseFormat: params.responseFormat,
    temperature: params.temperature,
  });

  const config =
    systemInstruction === undefined
      ? generationConfig
      : {
          ...generationConfig,
          systemInstruction,
        };

  try {
    const stream = await client.models.generateContentStream({
      model: params.model,
      contents,
      config,
    });

    // 스트림 생성 성공 이후에도 네트워크 또는 Provider 오류가 발생할 수 있으므로
    // async iteration까지 동일한 오류 처리 경계 안에서 수행합니다.
    for await (const chunk of stream) {
      responseId = chunk.responseId ?? responseId;
      responseModel = chunk.modelVersion ?? responseModel;
      created = chunk.createTime ?? created;
      blockReason = chunk.promptFeedback?.blockReason ?? blockReason;

      const candidate = chunk.candidates?.[0];

      if (candidate?.finishReason != null) {
        finishReason = candidate.finishReason;
      }

      const delta = chunk.text;

      if (delta) {
        content += delta;

        yield {
          type: "text-delta",
          delta,
        };
      }

      if (chunk.usageMetadata) {
        const inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        const outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;

        usage = {
          inputTokens,
          outputTokens,
          totalTokens:
            chunk.usageMetadata.totalTokenCount ?? inputTokens + outputTokens,
        };
      }
    }

    // 스트림 자체가 종료되었더라도 유효한 텍스트가 없으면 정상적인
    // Chat 완료가 아니므로 Provider 실패로 기록합니다.
    if (!content) {
      if (blockReason) {
        throw new Error(
          `Google chat stream response was blocked: ${blockReason}`,
        );
      }

      throw new Error("Google chat stream returned empty content.");
    }
  } catch (error) {
    // 최초 스트림 요청뿐 아니라 스트림 소비 및 최종 응답 검증 실패도
    // 동일한 Google Chat 운영 오류로 한 번만 기록합니다.
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
      message: "Google Chat streaming 요청에 실패했습니다.",
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
      provider: "google",
      requestedModel: params.model,
      responseId,
      responseModel: responseModel ?? params.model,
      systemFingerprint: null,
      usage,
    },
    usage,
  };

  yield {
    type: "finish",
    result,
  };
}

/**
 * Provider 공통 메시지를 Google Gemini Content 형식으로 변환합니다.
 *
 * Google Gemini는 system message를 contents에 포함하지 않고 별도의
 * systemInstruction으로 전달하므로 system message와 대화 message를 분리합니다.
 *
 * @param messages Provider 공통 Chat 메시지
 * @returns Google Gemini contents와 systemInstruction
 */
function createGoogleStreamMessages(messages: AiProviderChatMessage[]): {
  contents: Content[];
  systemInstruction: string | undefined;
} {
  const systemMessages = messages
    .filter((message) => message.role === AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM)
    .map((message) => message.content);

  const contents = messages.flatMap<Content>((message) => {
    if (message.role === AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM) {
      return [];
    }

    return [
      {
        role:
          message.role === AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT
            ? "model"
            : "user",
        parts: [
          {
            text: message.content,
          },
        ],
      },
    ];
  });

  return {
    contents,
    systemInstruction:
      systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
  };
}
