import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import type { AiEmbeddingResult } from "../types";
import { googleEmbeddingResponseSchema } from "./schema";

/**
 * Google Gemini Embeddings API를 호출하고 공통 Embedding 응답으로 변환합니다.
 *
 * @param params Google Gemini Embedding 요청에 필요한 값
 * @returns Provider 공통 Embedding 응답
 */
export async function createGoogleEmbedding(params: {
  apiKey: string;
  model: string;
  input: string;
  dimensions: number;
}): Promise<AiEmbeddingResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [
            {
              text: params.input,
            },
          ],
        },
        embedContentConfig: {
          outputDimensionality: params.dimensions,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();

    await reportAiOperationalError({
      error: new Error(errorBody),
      errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
      message: "Google embedding 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      context: {
        status: response.status,
        model: params.model,
      },
    });

    throw new Error(`Google embedding failed: ${response.status} ${errorBody}`);
  }

  const parsedResponse = googleEmbeddingResponseSchema.parse(
    (await response.json()) as unknown,
  );

  const embedding = parsedResponse.embedding.values;

  if (embedding.length === 0) {
    throw new Error("Google embedding returned empty values.");
  }

  /*
   * DB의 vector 차원과 실제 Provider 응답 차원이 다르면 저장 단계에서
   * 오류가 발생하므로, Provider 결과를 공통 결과로 반환하기 전에 차원을 검증한다.
   */
  if (embedding.length !== params.dimensions) {
    throw new Error(
      `Google embedding dimension mismatch: expected ${params.dimensions}, received ${embedding.length}.`,
    );
  }

  const inputTokens = parsedResponse.usageMetadata?.promptTokenCount ?? 0;

  const usage = {
    inputTokens,
    outputTokens: 0,
    totalTokens: inputTokens,
  };

  return {
    embedding,
    metadata: {
      provider: "google",
      requestedModel: params.model,
      responseModel: params.model,
      usage,
    },
    usage,
  };
}
