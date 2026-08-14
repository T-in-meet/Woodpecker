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
 * Provider 요청부터 응답 파싱 및 embedding 검증까지 하나의 실행 경로로 처리하여
 * 정상적인 Embedding 결과를 생성하지 못한 경우 운영 오류로 기록합니다.
 *
 * @param params Google Gemini Embedding 요청에 필요한 값
 * @returns Provider 공통 Embedding 응답
 * @throws Google Gemini 요청, 응답 파싱 또는 Embedding 검증에 실패한 경우
 */
export async function createGoogleEmbedding(params: {
  apiKey: string;
  model: string;
  input: string;
  dimensions: number;
}): Promise<AiEmbeddingResult> {
  // HTTP 응답 이후 발생하는 파싱/검증 실패에서도 status를
  // 운영 오류 context에 포함할 수 있도록 요청 범위 밖에서 유지합니다.
  let responseStatus: number | null = null;

  try {
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

    responseStatus = response.status;

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `Google embedding failed: ${response.status} ${errorBody}`,
      );
    }

    // HTTP 요청이 성공했더라도 응답 구조가 Provider 계약과 다르면
    // 정상적인 Embedding 결과로 사용할 수 없으므로 실패로 처리합니다.
    const parsedResponse = googleEmbeddingResponseSchema.parse(
      (await response.json()) as unknown,
    );

    const embedding = parsedResponse.embedding.values;

    if (embedding.length === 0) {
      throw new Error("Google embedding returned empty values.");
    }

    /*
     * DB vector 차원은 설정된 Embedding 모델 차원을 기준으로 고정되므로,
     * Provider 응답 차원이 요청한 차원과 다르면 저장 전에 즉시 실패시킵니다.
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
  } catch (error) {
    // 네트워크 요청, HTTP 오류, 응답 파싱, 빈 Embedding 및 차원 불일치까지
    // 정상적인 Google Embedding 결과를 생성하지 못한 경로를 한 번만 기록합니다.
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.GOOGLE_EMBEDDING_FAILED,
      message: "Google embedding 요청에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
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
