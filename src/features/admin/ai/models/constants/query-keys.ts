import { AiModelCapability } from "@/features/ai/constants/models";

import { AdminAiModelListQuery } from "../types";

/** 관리자 AI 모델 Query Key입니다. */
export const ADMIN_AI_MODELS_QUERY_KEY = {
  /** 모든 관리자 AI 모델 Query의 최상위 Key */
  all: ["admin-ai-models"] as const,

  /**
   * 조회 조건별 모델 목록 Query Key를 생성합니다.
   *
   * @param query 모델 목록 조회 조건
   * @returns 조회 조건을 포함한 Query Key
   */
  list: (query: AdminAiModelListQuery) =>
    [...ADMIN_AI_MODELS_QUERY_KEY.all, query] as const,

  /**
   * 모델 상세 Query Key를 생성합니다.
   *
   * @param modelConfigId 모델 설정 ID
   * @returns 모델 상세 Query Key
   */
  detail: (modelConfigId: string) =>
    [...ADMIN_AI_MODELS_QUERY_KEY.all, "detail", modelConfigId] as const,

  /**
   * Capability별 활성 모델 선택 목록 Query Key를 생성합니다.
   *
   * @param capability 조회할 모델 Capability
   * @returns Capability를 포함한 모델 선택 목록 Query Key
   */
  options: (capability: AiModelCapability) =>
    [...ADMIN_AI_MODELS_QUERY_KEY.all, "options", capability] as const,
};
