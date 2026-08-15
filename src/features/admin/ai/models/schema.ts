import { z } from "zod";

import {
  AI_MODEL_CAPABILITY_VALUES,
  AI_MODEL_PROVIDER_VALUES,
} from "@/features/ai/constants/models";

import { nullableTextSchema, uuidSchema } from "../schema";

/** Embedding 모델에서 사용할 수 있는 거리 측정 방식입니다. */
const AI_MODEL_DISTANCE_METRIC_VALUES = [
  "cosine",
  "inner_product",
  "l2",
] as const;

/**
 * AI 모델 설정 생성 입력을 검증하고 정규화합니다.
 *
 * Provider와 Capability를 지원 범위로 제한하며,
 * Embedding 전용 설정은 Capability에 맞는 조합만 허용합니다.
 */
export const createModelSchema = z
  .object({
    capability: z.string().trim().pipe(z.enum(AI_MODEL_CAPABILITY_VALUES)),
    dimensions: z
      .string()
      .trim()
      // FormData의 빈 문자열은 nullable DB 필드와 맞추기 위해 null로 변환한다.
      .transform((value) => (value.length > 0 ? Number(value) : null))
      .pipe(z.number().int().positive().nullable()),
    displayName: z.string().trim().min(1),
    distanceMetric: nullableTextSchema.pipe(
      z.enum(AI_MODEL_DISTANCE_METRIC_VALUES).nullable(),
    ),
    isActive: z.boolean(),
    model: z.string().trim().min(1),
    notes: nullableTextSchema,
    provider: z.string().trim().pipe(z.enum(AI_MODEL_PROVIDER_VALUES)),
  })
  .superRefine((data, ctx) => {
    if (data.capability === "embedding") {
      // 현재 DB vector 컬럼과 검색 RPC는 1536차원 embedding을 전제로 한다.
      if (data.dimensions !== 1536) {
        ctx.addIssue({
          code: "custom",
          message: "Embedding 모델의 dimensions는 1536이어야 합니다.",
          path: ["dimensions"],
        });
      }

      if (data.distanceMetric === null) {
        ctx.addIssue({
          code: "custom",
          message: "Embedding 모델의 distance metric은 필수입니다.",
          path: ["distanceMetric"],
        });
      }

      return;
    }

    // Chat 모델에는 embedding 검색 전용 설정을 저장하지 않는다.
    if (data.dimensions !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Chat 모델에는 dimensions를 설정할 수 없습니다.",
        path: ["dimensions"],
      });
    }

    if (data.distanceMetric !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Chat 모델에는 distance metric을 설정할 수 없습니다.",
        path: ["distanceMetric"],
      });
    }
  });

/**
 * AI 모델 설정 수정 입력을 검증하고 정규화합니다.
 *
 * 생성 후 변경할 수 없는 Provider, Capability, 모델 식별 정보 등은
 * 수정 입력에 포함하지 않습니다.
 */
export const updateModelSchema = z.object({
  displayName: z.string().trim().min(1),
  isActive: z.boolean(),
  modelConfigId: uuidSchema,
  notes: nullableTextSchema,
});

/**
 * ai_model_configs 테이블에서 조회한 모델 설정 Row를 검증합니다.
 */
export const aiModelConfigRowSchema = z.object({
  capability: z.enum(AI_MODEL_CAPABILITY_VALUES),
  created_at: z.string(),
  dimensions: z.number().nullable(),
  display_name: z.string(),
  distance_metric: z.string().nullable(),
  id: z.string(),
  is_active: z.boolean(),
  model: z.string(),
  notes: z.string().nullable(),
  provider: z.enum(AI_MODEL_PROVIDER_VALUES),
  updated_at: z.string(),
});

/**
 * 관리자 AI 모델 목록 RPC의 개별 Row를 검증합니다.
 */
export const adminAiModelListRpcRowSchema = z.object({
  capability: z.enum(AI_MODEL_CAPABILITY_VALUES),
  created_at: z.string(),
  display_name: z.string(),
  embedding_reference_count: z.number(),
  id: z.string(),
  is_active: z.boolean(),
  model: z.string(),
  provider: z.enum(AI_MODEL_PROVIDER_VALUES),
  updated_at: z.string(),
});

/**
 * 관리자 AI 모델 목록 RPC의 최상위 결과 구조를 검증합니다.
 *
 * items는 개별 Row Schema로 별도 검증하므로 이 단계에서는 unknown으로 유지합니다.
 */
export const adminAiModelListRpcResultSchema = z
  .array(
    z.object({
      items: z.unknown(),
      total_count: z.number(),
    }),
  )
  .length(1);

/**
 * AI 설정 화면에서 사용하는 활성 모델 선택 항목 Row를 검증합니다.
 */
export const adminAiModelConfigOptionRowSchema = z.object({
  capability: z.enum(AI_MODEL_CAPABILITY_VALUES),
  display_name: z.string(),
  id: z.string().uuid(),
  is_active: z.boolean(),
  model: z.string(),
  provider: z.enum(AI_MODEL_PROVIDER_VALUES),
});
