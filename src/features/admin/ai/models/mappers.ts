import { z } from "zod";

import { adminAiModelListRpcRowSchema, aiModelConfigRowSchema } from "./schema";
import type { AdminAiModelListRow, AdminAiModelRow } from "./types";

/**
 * 모델 설정 DB row를 관리자 AI 모델 상세 행으로 변환합니다.
 *
 * @param row 모델 설정 DB row
 * @param embeddingReferenceCount 해당 모델을 참조하는 embedding 수
 * @returns 관리자 AI 모델 상세 행
 */
export function mapModelRow(
  row: z.infer<typeof aiModelConfigRowSchema>,
  embeddingReferenceCount: number,
): AdminAiModelRow {
  return {
    capability: row.capability,
    createdAt: row.created_at,
    dimensions: row.dimensions,
    displayName: row.display_name,
    distanceMetric: row.distance_metric,
    embeddingReferenceCount,
    id: row.id,
    isActive: row.is_active,
    model: row.model,
    notes: row.notes,
    provider: row.provider,
    updatedAt: row.updated_at,
  };
}

/**
 * 목록 RPC row를 관리자 AI 모델 목록 표시 모델로 변환합니다.
 *
 * @param row 모델 목록 RPC row
 * @returns 관리자 모델 목록 행
 */
export function mapModelListRpcRow(
  row: z.infer<typeof adminAiModelListRpcRowSchema>,
): AdminAiModelListRow {
  return {
    capability: row.capability,
    createdAt: row.created_at,
    displayName: row.display_name,
    embeddingReferenceCount: row.embedding_reference_count,
    id: row.id,
    isActive: row.is_active,
    model: row.model,
    provider: row.provider,
    updatedAt: row.updated_at,
  };
}
