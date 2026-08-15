import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";

import type { AdminAiModelRow } from "../types";

/**
 * 관리자 AI 모델 폼의 클라이언트 입력 값입니다.
 *
 * Server Action은 FormData 계약을 유지하므로 submit 시 이 값들을 FormData로 변환합니다.
 */
export type AdminAiModelFormValues = {
  provider: string;
  model: string;
  displayName: string;
  capability: string;
  dimensions: string;
  distanceMetric: string;
  isActive: string;
  notes: string;
};

/**
 * 생성 모드 여부를 판별합니다.
 *
 * @param model 모델 상세
 * @returns 생성 모드면 true
 */
export function isCreateMode(model: AdminAiModelRow | undefined) {
  return model === undefined;
}

/**
 * 현재 모델 상태에서 폼에 표시할 dimensions 값을 반환합니다.
 *
 * @param model 모델 상세
 * @returns RHF 기본값으로 사용할 dimensions 문자열
 */
export function getInitialDimensions(model: AdminAiModelRow | undefined) {
  if (model?.capability === "embedding") {
    return String(model.dimensions ?? AI_EMBEDDING_DIMENSIONS);
  }

  return "";
}

/**
 * AI 모델 폼 값을 Server Action 계약인 FormData로 변환합니다.
 *
 * @param values RHF에서 검증된 폼 값
 * @param model 수정 모드의 기존 모델
 * @returns AI 모델 저장 FormData
 */
export function buildAiModelFormData(
  values: AdminAiModelFormValues,
  model: AdminAiModelRow | undefined,
) {
  const formData = new FormData();

  if (model) {
    formData.set("modelConfigId", model.id);
  }

  formData.set("displayName", values.displayName);
  formData.set("isActive", values.isActive);
  formData.set("notes", values.notes);

  if (!model) {
    formData.set("provider", values.provider);
    formData.set("model", values.model);
    formData.set("capability", values.capability);
    formData.set("dimensions", values.dimensions);
    formData.set("distanceMetric", values.distanceMetric);
  }

  return formData;
}

/**
 * AI 모델 삭제가 차단되는 이유 목록을 계산합니다.
 *
 * @param model 삭제 대상 모델
 * @returns 삭제 차단 사유 목록
 */
export function getDeleteBlockedReasons(model: AdminAiModelRow | undefined) {
  return model
    ? [
        model.isActive ? "활성 상태인 모델은 삭제할 수 없습니다." : null,
        model.embeddingReferenceCount > 0
          ? `Embedding에서 ${model.embeddingReferenceCount}건 참조 중입니다.`
          : null,
      ].filter((reason): reason is string => reason !== null)
    : [];
}
