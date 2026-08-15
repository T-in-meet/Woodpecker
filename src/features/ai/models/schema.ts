import { z } from "zod";

import {
  AI_MODEL_CAPABILITY,
  AI_MODEL_DISTANCE_METRIC,
  AI_MODEL_PROVIDER_VALUES,
} from "../constants/models";

/**
 * AI Model Config가 제공하는 AI 기능 유형을 검증합니다.
 *
 * Chat 모델과 Embedding 모델을 구분하며, Model Config의 capability 필드에 사용됩니다.
 */
export const aiModelCapabilitySchema = z.enum([
  AI_MODEL_CAPABILITY.CHAT,
  AI_MODEL_CAPABILITY.EMBEDDING,
]);

/**
 * AI Embedding 검색에 사용하는 vector distance metric을 검증합니다.
 *
 * Cosine, Inner Product, L2 distance를 지원합니다.
 */
export const aiModelDistanceMetricSchema = z.enum([
  AI_MODEL_DISTANCE_METRIC.COSINE,
  AI_MODEL_DISTANCE_METRIC.INNER_PRODUCT,
  AI_MODEL_DISTANCE_METRIC.L2,
]);

/**
 * AI Model Provider 값을 검증합니다.
 *
 * Provider 목록은 AI Model 상수에서 관리하며, schema는 해당 목록에 포함된 값만 허용합니다.
 */
export const aiModelProviderSchema = z.enum(AI_MODEL_PROVIDER_VALUES);

/**
 * DB에서 조회한 AI Model Config row의 런타임 구조를 검증합니다.
 *
 * Supabase 등 외부 경계에서 반환된 Model Config를 애플리케이션 타입으로
 * 사용하기 전에 필수 식별자, capability, provider, 상태 및 embedding 설정을 검증합니다.
 */
export const aiModelConfigRowSchema = z.object({
  capability: aiModelCapabilitySchema,
  created_at: z.string(),
  dimensions: z.number().int().positive().nullable(),
  display_name: z.string().min(1),
  distance_metric: aiModelDistanceMetricSchema.nullable(),
  id: z.string().uuid(),
  is_active: z.boolean(),
  model: z.string().min(1),
  notes: z.string().nullable(),
  provider: aiModelProviderSchema,
  updated_at: z.string(),
});
