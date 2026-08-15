import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import type { AiEmbeddingResult } from "../types";
import { openAiEmbeddingResponseSchema } from "./schema";

/**
 * OpenAI Embeddings API를 호출하여 입력 텍스트의 임베딩을 생성합니다.
 *
 * OpenAI 응답을 공통 AI Provider 형식으로 정규화하고,
 * 반환된 임베딩이 요청한 차원과 일치하는지 검증합니다.
 *
 * @param params OpenAI 임베딩 생성에 필요한 매개변수입니다.
 * @param params.apiKey OpenAI API 인증에 사용할 API 키입니다.
 * @param params.model 임베딩 생성에 사용할 OpenAI 모델명입니다.
 * @param params.input 임베딩을 생성할 입력 텍스트입니다.
 * @param params.dimensions 요청할 임베딩 벡터 차원입니다.
 * @returns 정규화된 임베딩 벡터와 Provider 메타데이터 및 사용량입니다.
 * @throws OpenAI 요청, 응답 파싱 또는 임베딩 검증에 실패한 경우
 */
export async function createOpenAiEmbedding(params: {
  apiKey: string;
  model: string;
  input: string;
  dimensions: number;
}): Promise<AiEmbeddingResult> {
  // HTTP 응답 이후 발생하는 파싱/검증 실패에서도 status를
  // 운영 오류 context에 포함할 수 있도록 요청 범위 밖에서 유지합니다.
  let responseStatus: number | null = null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dimensions: params.dimensions,
        input: params.input,
        model: params.model,
      }),
    });

    responseStatus = response.status;

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `OpenAI embedding failed: ${response.status} ${errorBody}`,
      );
    }

    // 외부 API 응답을 그대로 신뢰하지 않고 Provider 전용 스키마에서
    // 검증한 뒤 공통 Provider 결과로 변환합니다.
    const parsedResponse = openAiEmbeddingResponseSchema.parse(
      (await response.json()) as unknown,
    );

    const embedding = parsedResponse.data[0]?.embedding ?? [];

    // 빈 벡터가 캐시 저장이나 유사도 검색 단계까지 전달되지 않도록
    // Provider 경계에서 즉시 차단합니다.
    if (embedding.length === 0) {
      throw new Error("OpenAI embedding returned empty values.");
    }

    // 모델 설정과 실제 반환 벡터의 불일치를 DB 저장 이전에 감지하여
    // vector 차원 오류를 조기에 노출합니다.
    if (embedding.length !== params.dimensions) {
      throw new Error(
        `OpenAI embedding dimension mismatch: expected ${params.dimensions}, received ${embedding.length}.`,
      );
    }

    // OpenAI Embeddings API에는 출력 토큰이 없으므로 입력 토큰만
    // Provider 공통 usage 형식으로 정규화합니다.
    const inputTokens = parsedResponse.usage?.prompt_tokens ?? 0;
    const totalTokens = parsedResponse.usage?.total_tokens ?? inputTokens;

    const usage = {
      inputTokens,
      outputTokens: 0,
      totalTokens,
    };

    return {
      embedding,
      metadata: {
        provider: "openai",
        requestedModel: params.model,
        responseModel: parsedResponse.model ?? null,
        usage,
      },
      usage,
    };
  } catch (error) {
    // 네트워크 요청, HTTP 오류, 응답 파싱, 빈 Embedding 및 차원 불일치까지
    // 정상적인 OpenAI Embedding 결과를 생성하지 못한 경로를 한 번만 기록합니다.
    await reportAiOperationalError({
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_EMBEDDING_FAILED,
      message: "OpenAI Embedding 요청에 실패했습니다.",
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
