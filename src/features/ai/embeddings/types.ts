import type { z } from "zod";

import type { aiEmbeddingMatchRowSchema, aiEmbeddingRowSchema } from "./schema";

/** DB에서 조회하고 검증한 AI embedding cache 행입니다. */
export type AiEmbeddingRow = z.infer<typeof aiEmbeddingRowSchema>;

/** `match_ai_embeddings` RPC에서 조회하고 검증한 검색 결과 행입니다. */
export type AiEmbeddingMatchRow = z.infer<typeof aiEmbeddingMatchRowSchema>;

/**
 * AI embedding row 저장에 필요한 식별 정보와 입력 snapshot입니다.
 *
 * generationId는 한 번의 재인덱싱에서 생성된 chunk 세트를 식별하고,
 * chunkIndex/chunkCount는 해당 generation 안에서의 위치와 전체 개수를 나타냅니다.
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
  generationId: string;
  chunkIndex: number;
  chunkCount: number;
};
