/**
 * 현재 AI Foundation에서 지원하는 Embedding dimension입니다.
 *
 * 현재 ai_embeddings.embedding의 vector(1536) 계약에 맞춰
 * 1536 dimensions만 지원합니다.
 *
 * 향후 다른 dimensions의 Embedding Model을 지원할 경우
 * DB vector 타입, vector formatter, embedding cache 및
 * 유사도 검색 RPC 등의 관련 계약을 함께 확장해야 합니다.
 */
export const AI_EMBEDDING_DIMENSIONS = 1536;

/** 운영 로그와 목록 화면에 저장할 embedding 입력 preview 최대 길이입니다. */
export const AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH = 500;

/** Foundation이 알고 있는 embedding source type입니다. */
export const AI_EMBEDDING_SOURCE_TYPE = {
  NOTE: "note",
} as const;

/** Foundation이 알고 있는 embedding source type 타입입니다. */
export type AiEmbeddingSourceType =
  (typeof AI_EMBEDDING_SOURCE_TYPE)[keyof typeof AI_EMBEDDING_SOURCE_TYPE];
