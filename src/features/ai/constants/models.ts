/** AI 모델이 제공하는 기능 범위입니다. */
export const AI_MODEL_CAPABILITY = {
  CHAT: "chat",
  EMBEDDING: "embedding",
} as const;

/** AI 모델 capability 값을 Zod enum 등에서 사용할 수 있는 배열 형태로 제공합니다. */
export const AI_MODEL_CAPABILITY_VALUES = Object.values(
  AI_MODEL_CAPABILITY,
) as [AiModelCapability, ...AiModelCapability[]];

/** 임베딩 검색에 사용할 거리 계산 방식입니다. */
export const AI_MODEL_DISTANCE_METRIC = {
  COSINE: "cosine",
  INNER_PRODUCT: "inner_product",
  L2: "l2",
} as const;

/** AI 모델 distance metric 값을 Zod enum 등에서 사용할 수 있는 배열 형태로 제공합니다. */
export const AI_MODEL_DISTANCE_METRIC_VALUES = Object.values(
  AI_MODEL_DISTANCE_METRIC,
) as [AiModelDistanceMetric, ...AiModelDistanceMetric[]];

/** Foundation에서 지원하는 AI Provider입니다. */
export const AI_MODEL_PROVIDER = {
  GOOGLE: "google",
  OPENAI: "openai",
} as const;

/** AI 모델 provider 값을 Zod enum 등에서 사용할 수 있는 배열 형태로 제공합니다. */
export const AI_MODEL_PROVIDER_VALUES = Object.values(AI_MODEL_PROVIDER) as [
  AiModelProvider,
  ...AiModelProvider[],
];

/** 기능 코드가 명시적으로 요청해야 하는 AI 모델 key입니다. */
export const AI_MODEL_KEY = {
  OPENAI_GPT_4O_MINI: "openai-gpt-4o-mini",
  OPENAI_TEXT_EMBEDDING_3_SMALL: "openai-text-embedding-3-small",
} as const;

/** AI 모델 capability 타입입니다. */
export type AiModelCapability =
  (typeof AI_MODEL_CAPABILITY)[keyof typeof AI_MODEL_CAPABILITY];

/** AI 모델 거리 계산 타입입니다. */
export type AiModelDistanceMetric =
  (typeof AI_MODEL_DISTANCE_METRIC)[keyof typeof AI_MODEL_DISTANCE_METRIC];

/** AI 모델 provider 타입입니다. */
export type AiModelProvider =
  (typeof AI_MODEL_PROVIDER)[keyof typeof AI_MODEL_PROVIDER];

/** Foundation seed와 기능 코드가 공유하는 AI 모델 key 타입입니다. */
export type AiModelKey = (typeof AI_MODEL_KEY)[keyof typeof AI_MODEL_KEY];
