import { AI_MODEL_PROVIDER, type AiModelProvider } from "../constants/models";
import {
  createGoogleChatCompletion,
  createGoogleJsonChatCompletion,
} from "./google/chat";
import { streamGoogleChatCompletion } from "./google/chat";
import { createGoogleEmbedding } from "./google/embeddings";
import {
  createOpenAiChatCompletion,
  createOpenAiJsonChatCompletion,
} from "./openai/chat";
import { streamOpenAiChatCompletion } from "./openai/chat";
import { createOpenAiEmbedding } from "./openai/embeddings";
import type {
  AiChatCompletionResult,
  AiChatResponseFormat,
  AiChatStreamEvent,
  AiChatStreamParams,
  AiEmbeddingResult,
} from "./types";

/**
 * Model Config의 Provider에 따라 embedding 생성을 위임합니다.
 *
 * Provider별 embedding 응답은 각 구현에서 공통 `AiEmbeddingResult` 형식으로
 * 정규화된 뒤 호출자에게 반환됩니다.
 *
 * @param params Provider 식별자와 embedding 생성에 필요한 요청 값입니다.
 * @returns 정규화된 embedding 생성 결과입니다.
 */
export async function createAiEmbeddingWithProvider(params: {
  /** 사용할 AI Provider입니다. */
  provider: AiModelProvider;

  /** Provider API 인증에 사용할 API key입니다. */
  apiKey: string;

  /** Provider에 전달할 실제 Model 식별자입니다. */
  model: string;

  /** embedding을 생성할 입력 텍스트입니다. */
  input: string;

  /** 요청할 embedding 차원입니다. */
  dimensions: number;
}): Promise<AiEmbeddingResult> {
  switch (params.provider) {
    case AI_MODEL_PROVIDER.OPENAI:
      return createOpenAiEmbedding(params);

    case AI_MODEL_PROVIDER.GOOGLE:
      return createGoogleEmbedding(params);
  }
}

/**
 * Model Config의 Provider에 따라 일반 Chat Completion 생성을 위임합니다.
 *
 * Provider별 응답은 공통 `AiChatCompletionResult` 형식으로 정규화되어 반환됩니다.
 *
 * @param params Provider 식별자와 Chat Completion 요청 값입니다.
 * @returns 정규화된 Chat Completion 결과입니다.
 */
export async function createAiChatCompletionWithProvider(params: {
  /** 사용할 AI Provider입니다. */
  provider: AiModelProvider;

  /** Provider API 인증에 사용할 API key입니다. */
  apiKey: string;

  /** Provider에 전달할 실제 Model 식별자입니다. */
  model: string;

  /** Chat Completion temperature입니다. */
  temperature: number;

  /** Provider에 전달할 system prompt입니다. */
  systemPrompt: string;

  /** Provider에 전달할 user prompt입니다. */
  userPrompt: string;

  /** Provider에 요청할 응답 형식입니다. */
  responseFormat?: AiChatResponseFormat | undefined;
}): Promise<AiChatCompletionResult> {
  switch (params.provider) {
    case AI_MODEL_PROVIDER.OPENAI:
      return createOpenAiChatCompletion(params);

    case AI_MODEL_PROVIDER.GOOGLE:
      return createGoogleChatCompletion(params);
  }
}

/**
 * Model Config의 Provider에 따라 JSON Chat Completion 생성을 위임합니다.
 *
 * JSON 응답이 필요한 실행 경로에서 사용하며, Provider별 구현의 응답을
 * 공통 `AiChatCompletionResult` 형식으로 정규화합니다.
 *
 * @param params Provider 식별자와 JSON Chat Completion 요청 값입니다.
 * @returns 정규화된 Chat Completion 결과입니다.
 */
export async function createAiJsonChatCompletionWithProvider(params: {
  /** 사용할 AI Provider입니다. */
  provider: AiModelProvider;

  /** Provider API 인증에 사용할 API key입니다. */
  apiKey: string;

  /** Provider에 전달할 실제 Model 식별자입니다. */
  model: string;

  /** Chat Completion temperature입니다. */
  temperature: number;

  /** Provider에 전달할 system prompt입니다. */
  systemPrompt: string;

  /** Provider에 전달할 user prompt입니다. */
  userPrompt: string;
}): Promise<AiChatCompletionResult> {
  switch (params.provider) {
    case AI_MODEL_PROVIDER.OPENAI:
      return createOpenAiJsonChatCompletion(params);

    case AI_MODEL_PROVIDER.GOOGLE:
      return createGoogleJsonChatCompletion(params);
  }
}

/**
 * Model Config의 Provider에 따라 Chat 스트림 생성을 위임합니다.
 *
 * Provider별 스트림 이벤트는 각 구현에서 공통 `AiChatStreamEvent` 형식으로
 * 정규화되어 반환됩니다.
 *
 * @param params Provider 식별자와 Chat 스트리밍 요청 값입니다.
 * @returns Provider 공통 Chat 스트림입니다.
 */
export function streamAiChatCompletionWithProvider(
  params: AiChatStreamParams,
): AsyncGenerator<AiChatStreamEvent> {
  const { provider, ...providerParams } = params;

  switch (provider) {
    case AI_MODEL_PROVIDER.OPENAI:
      return streamOpenAiChatCompletion(providerParams);

    case AI_MODEL_PROVIDER.GOOGLE:
      return streamGoogleChatCompletion(providerParams);
  }
}
