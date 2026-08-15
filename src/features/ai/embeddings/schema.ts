import { z } from "zod";

/**
 * `ai_embeddings` 테이블에서 조회한 cache 행의 런타임 스키마입니다.
 */
export const aiEmbeddingRowSchema = z.object({
  content_hash: z.string().min(1),
  created_at: z.string(),
  embedding: z.string(),
  id: z.string().uuid(),
  input_hash: z.string().min(1),
  input_kind: z.string().min(1),
  input_preview: z.string().min(1),
  input_text: z.string().min(1),
  model_config_id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  source_id: z.string().uuid(),
  source_type: z.string().min(1),
  token_count: z.number().int().nonnegative().nullable(),
});

/**
 * `match_ai_embeddings` RPC가 반환하는 검색 결과 행의 런타임 스키마입니다.
 */
export const aiEmbeddingMatchRowSchema = z.object({
  distance: z.number(),
  embedding_id: z.string().uuid(),
  similarity: z.number(),
  source_id: z.string().uuid(),
});
