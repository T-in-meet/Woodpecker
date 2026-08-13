import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { AiModelCapability } from "@/features/ai/constants/models";

import { ADMIN_AI_MODELS_QUERY_KEY } from "../constants/query-keys";
import {
  getAdminAiModelDetail,
  getAdminAiModelOptions,
  getAdminAiModels,
} from "../queries";
import type { AdminAiModelListQuery } from "../types";

/**
 * 관리자 AI 모델 목록 Query 훅입니다.
 *
 * @param query 모델 목록 조회 조건
 * @returns 모델 목록 Query 결과
 */
export function useAdminAiModels(query: AdminAiModelListQuery) {
  return useQuery({
    queryKey: ADMIN_AI_MODELS_QUERY_KEY.list(query),
    queryFn: () => getAdminAiModels(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * 관리자 AI 모델 상세를 조회합니다.
 *
 * @param modelConfigId 모델 설정 ID
 * @returns 관리자 AI 모델 상세 Query
 */
export function useAdminAiModelDetail(modelConfigId: string) {
  return useQuery({
    queryKey: ADMIN_AI_MODELS_QUERY_KEY.detail(modelConfigId),
    queryFn: () => getAdminAiModelDetail(modelConfigId),
  });
}

/**
 * 지정한 capability의 활성 AI 모델 설정을 조회합니다.
 *
 * @param capability 조회할 AI 모델 capability
 * @returns AI 모델 설정 목록 Query 결과
 */
export function useAdminAiModelOptions(capability: AiModelCapability) {
  return useQuery({
    queryKey: ADMIN_AI_MODELS_QUERY_KEY.options(capability),
    queryFn: () => getAdminAiModelOptions(capability),
  });
}
