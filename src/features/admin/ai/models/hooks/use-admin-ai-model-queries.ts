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
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // 모델 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
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
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // 모델 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
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
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // 모델 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
  });
}
