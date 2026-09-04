import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { matchAiEmbeddings } from "@/features/ai/embeddings/match";
import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import { createAiEmbeddingWithProvider } from "@/features/ai/providers";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { type AiObserver, notifyAiObserver } from "@/lib/ai/notify-observer";

/** Note Embedding 검색 공통 helper가 노출하는 실행 관측 이벤트입니다. */
export type SearchNoteEmbeddingsObservation =
  | {
      /** 실제 query embedding 요청과 Runtime 설정입니다. */
      type: "embedding-requested";
      configuration: AiRuntimeEmbeddingConfiguration;
      input: string;
    }
  | {
      /** vector를 제외한 query embedding 완료 결과입니다. */
      type: "embedding-completed";
      metadata: Awaited<
        ReturnType<typeof createAiEmbeddingWithProvider>
      >["metadata"];
      usage: AiTokenUsage;
    }
  | {
      /** query embedding 생성 실패입니다. */
      type: "embedding-failed";
      error: unknown;
    }
  | {
      /** 실제 match query에 사용한 검색 설정입니다. */
      type: "search-requested";
      excludeSourceIds?: string[];
      limit: number;
      minSimilarity: number;
      modelConfigId: string;
      ownerUserId: string;
    }
  | {
      /** match query가 반환한 원래 순서의 row 목록입니다. */
      type: "search-completed";
      matches: AiEmbeddingMatchRow[];
    }
  | {
      /** embedding 완료 이후 match query에서 발생한 오류입니다. */
      type: "search-failed";
      error: unknown;
    };

/**
 * Note RAG에서 Note chunk Embedding을 검색하는 입력입니다.
 */
export type SearchNoteEmbeddingsParams = {
  /** 검색에 사용할 Embedding Runtime Configuration입니다. */
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;

  /**
   * 검색 결과에서 제외할 Note ID 목록입니다.
   *
   * 지정하지 않으면 기존 Note Chat 검색과 동일하게
   * 모든 활성 Note chunk를 검색 대상으로 사용합니다.
   */
  excludeSourceIds?: string[];

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /** Embedding으로 변환할 검색 질의입니다. */
  question: string;

  /**
   * 검색할 최대 chunk 개수입니다.
   *
   * 청킹 도입 이후 match_ai_embeddings는 Note 단위가 아니라
   * 활성 generation에 속한 chunk 단위 Top-K를 반환합니다.
   */
  limit: number;

  /** 검색 결과에 허용할 최소 유사도입니다. */
  minSimilarity: number;

  /**
   * 검색 질의 embedding Provider usage 저장 callback입니다.
   *
   * Provider 호출 직후 실행하여 이후 DB 검색 실패가 발생하더라도 이미 발생한
   * usage/cost를 호출 계층에서 보존할 수 있게 합니다.
   */
  onUsage?: (usage: AiTokenUsage) => Promise<void>;

  /** AI Runs accumulator가 단계별 실행값을 기록할 best-effort callback입니다. */
  onObservation?: AiObserver<SearchNoteEmbeddingsObservation> | undefined;
};

/**
 * Note RAG Embedding 검색 결과와 query embedding usage입니다.
 */
export type SearchNoteEmbeddingsWithUsageResult = {
  /** 유사도 순으로 검색된 활성 Note chunk Embedding 목록입니다. */
  matches: AiEmbeddingMatchRow[];

  /** 검색 질의 embedding Provider 호출에서 반환된 Token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * 검색 질의를 Embedding으로 변환하고,
 * 현재 사용자의 활성 Note chunk Embedding을 검색합니다.
 *
 * Note Embedding을 새로 생성하거나 저장하지 않으며,
 * 현재 Runtime에서 선택된 Embedding Model과 동일한 모델로 생성된
 * 활성 generation의 chunk만 검색합니다.
 *
 * excludeSourceIds가 지정되면 해당 Note들의 모든 chunk를
 * ranking 및 LIMIT 적용 전에 검색 대상에서 제외합니다.
 *
 * 반환 결과는 Note 단위로 중복 제거하지 않습니다.
 * 따라서 하나의 Note에서 여러 관련 chunk가 검색될 수 있으며,
 * Note 단위 집계가 필요한 기능은 호출 계층에서 별도로 처리해야 합니다.
 *
 * @param params 검색 질의, 사용자, Runtime 설정 및 검색 정책
 * @returns 유사도 순으로 검색된 활성 Note chunk Embedding 목록
 */
export async function searchNoteEmbeddings({
  embeddingConfiguration,
  excludeSourceIds,
  ownerUserId,
  question,
  limit,
  minSimilarity,
  onObservation,
}: SearchNoteEmbeddingsParams): Promise<AiEmbeddingMatchRow[]> {
  const result = await searchNoteEmbeddingsWithUsage({
    embeddingConfiguration,
    ...(excludeSourceIds !== undefined ? { excludeSourceIds } : {}),
    ownerUserId,
    question,
    limit,
    minSimilarity,
    ...(onObservation === undefined ? {} : { onObservation }),
  });

  return result.matches;
}

/**
 * 검색 질의를 Embedding으로 변환하고 검색 결과와 query embedding usage를 함께 반환합니다.
 *
 * 기존 `searchNoteEmbeddings`의 동작은 유지하면서, Related Notes처럼
 * 검색 질의 embedding 호출 비용을 실행 이력에 저장해야 하는 경로에서 사용합니다.
 *
 * @param params 검색 질의, 사용자, Runtime 설정 및 검색 정책
 * @returns Embedding 검색 결과와 query embedding Provider usage
 */
export async function searchNoteEmbeddingsWithUsage({
  embeddingConfiguration,
  excludeSourceIds,
  ownerUserId,
  question,
  limit,
  minSimilarity,
  onUsage,
  onObservation,
}: SearchNoteEmbeddingsParams): Promise<SearchNoteEmbeddingsWithUsageResult> {
  const embeddingModel = embeddingConfiguration.model;

  /*
   * 현재 AI Foundation의 pgvector 저장 계약은 1536 dimensions로 고정되어 있으므로
   * dimensions가 없거나 다른 차원의 Embedding Model은 Provider 호출 전에 거부합니다.
   */
  if (embeddingModel.dimensions === null) {
    const error = new Error(
      `Embedding 모델의 dimensions 설정이 없습니다: ${embeddingModel.id}`,
    );

    await reportAiOperationalError({
      context: {
        model: embeddingModel.model,
        modelConfigId: embeddingModel.id,
        provider: embeddingModel.provider,
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_MISSING,
      message: "AI embedding 모델의 dimensions 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    throw error;
  }

  if (embeddingModel.dimensions !== AI_EMBEDDING_DIMENSIONS) {
    const error = new Error(
      `Unsupported note embedding dimensions: ${embeddingModel.dimensions}`,
    );

    await reportAiOperationalError({
      context: {
        dimensions: embeddingModel.dimensions,
        model: embeddingModel.model,
        modelConfigId: embeddingModel.id,
        provider: embeddingModel.provider,
        supportedDimensions: AI_EMBEDDING_DIMENSIONS,
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_DIMENSIONS_UNSUPPORTED,
      message: "현재 지원하지 않는 AI embedding dimensions입니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    throw error;
  }

  /*
   * 검색 질의 자체는 저장하지 않고 동일 Embedding Model로 vector만 생성합니다.
   * 저장된 Note chunk vector와 같은 vector space에서 비교하기 위한 과정입니다.
   */
  await notifyAiObserver(onObservation, {
    configuration: embeddingConfiguration,
    input: question,
    type: "embedding-requested",
  });

  let apiKey: string;

  try {
    apiKey = getProviderApiKey(embeddingModel.provider);
  } catch (error) {
    await notifyAiObserver(onObservation, {
      error,
      type: "embedding-failed",
    });

    await reportAiOperationalError({
      context: {
        model: embeddingModel.model,
        modelConfigId: embeddingModel.id,
        provider: embeddingModel.provider,
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROVIDER_API_KEY_MISSING,
      message: "AI Provider API key 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    throw error;
  }

  let queryEmbedding: Awaited<ReturnType<typeof createAiEmbeddingWithProvider>>;

  try {
    // 기존과 같은 한 번의 Provider 호출로 vector와 관측 metadata를 함께 확보한다.
    queryEmbedding = await createAiEmbeddingWithProvider({
      apiKey,
      dimensions: embeddingModel.dimensions,
      input: question,
      model: embeddingModel.model,
      provider: embeddingModel.provider,
    });
  } catch (error) {
    await notifyAiObserver(onObservation, {
      error,
      type: "embedding-failed",
    });
    throw error;
  }

  // embedding vector는 의도적으로 제외하고 metadata와 usage만 전달한다.
  await notifyAiObserver(onObservation, {
    metadata: queryEmbedding.metadata,
    type: "embedding-completed",
    usage: queryEmbedding.usage,
  });

  await onUsage?.(queryEmbedding.usage);

  /*
   * matchAiEmbeddings는 현재 활성 generation의 chunk만 대상으로
   * 거리순 Top-K를 반환합니다.
   *
   * excludeSourceIds가 지정된 경우 해당 Note들의 모든 chunk는
   * ranking 및 LIMIT 적용 전에 제외됩니다.
   */
  await notifyAiObserver(onObservation, {
    ...(excludeSourceIds === undefined ? {} : { excludeSourceIds }),
    limit,
    minSimilarity,
    modelConfigId: embeddingModel.id,
    ownerUserId,
    type: "search-requested",
  });

  let matches: AiEmbeddingMatchRow[];

  try {
    matches = await matchAiEmbeddings({
      excludeSourceIds,
      inputKind: NOTE_EMBEDDING_INPUT_KIND,
      limit,
      minSimilarity,
      modelConfigId: embeddingModel.id,
      ownerUserId,
      queryEmbedding: queryEmbedding.embedding,
      sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
    });
  } catch (error) {
    await notifyAiObserver(onObservation, {
      error,
      type: "search-failed",
    });
    throw error;
  }

  // hydration 전에 실제 DB가 반환한 match 순서를 그대로 전달한다.
  await notifyAiObserver(onObservation, {
    matches,
    type: "search-completed",
  });

  return {
    matches,
    usage: queryEmbedding.usage,
  };
}
