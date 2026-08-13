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
 * Google Gemini Chat 요청과 응답 파싱의 공통 경로를 처리합니다.
 *
 * @param params Google Gemini Chat 요청에 필요한 값
 * @returns Provider 공통 Chat 응답
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

  if (!response.ok) {
    const errorBody = await response.text();

    await reportAiOperationalError({
      error: new Error(errorBody),
      errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_CHAT_FAILED,
      message: "Google Chat 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      context: {
        model: params.model,
        status: response.status,
      },
    });

    throw new Error(`Google chat failed: ${response.status} ${errorBody}`);
  }

  const parsedResponse = googleChatCompletionResponseSchema.parse(
    (await response.json()) as unknown,
  );

  const candidate = parsedResponse.candidates?.[0];
  const content = candidate?.content?.parts
    .flatMap((part) => (part.text === undefined ? [] : [part.text]))
    .join("");

  if (!content) {
    const blockReason = parsedResponse.promptFeedback?.blockReason ?? null;

    if (blockReason) {
      throw new Error(`Google chat response was blocked: ${blockReason}`);
    }

    throw new Error("Google chat returned empty content.");
  }

  const inputTokens = parsedResponse.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = parsedResponse.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens =
    parsedResponse.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

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
}

/**
 * Provider 공통 응답 형식을 Google Gemini generationConfig 형식으로 변환합니다.
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

  let stream;

  try {
    stream = await client.models.generateContentStream({
      model: params.model,
      contents,
      config,
    });
  } catch (error) {
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

  if (!content) {
    if (blockReason) {
      throw new Error(
        `Google chat stream response was blocked: ${blockReason}`,
      );
    }

    throw new Error("Google chat stream returned empty content.");
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
