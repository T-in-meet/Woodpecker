/** v1 Foundation에서 지원하는 embedding 차원입니다. */
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
