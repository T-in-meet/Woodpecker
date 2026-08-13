import type { z } from "zod";

import type { AiModelProvider } from "../constants/models";
import type { aiEmbeddingMatchRowSchema, aiEmbeddingRowSchema } from "./schema";

/** DB에서 조회하고 검증한 AI embedding cache 행입니다. */
export type AiEmbeddingRow = z.infer<typeof aiEmbeddingRowSchema>;

/** `match_ai_embeddings` RPC에서 조회하고 검증한 검색 결과 행입니다. */
export type AiEmbeddingMatchRow = z.infer<typeof aiEmbeddingMatchRowSchema>;

/**
 * AI embedding cache 식별 정보와 embedding 생성 당시의 입력 snapshot입니다.
 *
 * cache 조회에는 식별 필드가 사용되고, 삽입 시에는 hash와 원문 및 preview가
 * 함께 저장되어 embedding 생성 입력을 추적할 수 있도록 합니다.
 */
export type AiEmbeddingInput = {
  ownerUserId: string;
  sourceType: string;
  sourceId: string;
  modelConfigId: string;
  inputKind: string;
  contentHash: string;
  inputHash: string;
  inputText: string;
  inputPreview: string;
};

/** Embedding 생성에 필요한 AI model 설정입니다. */
export type AiEmbeddingModelConfiguration = {
  id: string;
  provider: AiModelProvider;
  model: string;
  dimensions: number | null;
};

/** Embedding 실행에 필요한 최소 runtime 설정입니다. */
export type AiEmbeddingRuntimeConfiguration = {
  model: AiEmbeddingModelConfiguration;
};
