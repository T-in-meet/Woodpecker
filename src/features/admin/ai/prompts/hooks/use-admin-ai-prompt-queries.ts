import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ADMIN_AI_PROMPTS_QUERY_KEY } from "../constants/query-keys";
import {
  getAdminAiPromptFamilies,
  getAdminAiPromptFamilyDetail,
  getAdminAiPromptFamilyOptions,
  getAdminAiPromptVersionDetail,
  getAdminAiPromptVersionOptions,
} from "../queries";
import type { AdminAiPromptListQuery } from "../types";

/**
 * 관리자 AI prompt family 목록 Query 훅입니다.
 *
 * @param query prompt family 목록 조회 조건
 * @returns prompt family 목록 Query 결과
 */
export function useAdminAiPromptFamilies(query: AdminAiPromptListQuery) {
  return useQuery({
    queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.list(query),
    queryFn: () => getAdminAiPromptFamilies(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * 지정한 Prompt Family 상세 정보를 조회합니다.
 *
 * @param familyId 조회할 Prompt Family ID
 * @returns Prompt Family 상세 Query 결과
 */
export function useAdminAiPromptFamilyDetail(familyId: string) {
  return useQuery({
    queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.familyDetail(familyId),
    queryFn: () => getAdminAiPromptFamilyDetail(familyId),
  });
}

/**
 * 지정한 Prompt Version 상세 정보를 조회합니다.
 *
 * @param familyId Prompt Family ID
 * @param versionId 조회할 Prompt Version ID
 * @returns Prompt Version 상세 Query 결과
 */
export function useAdminAiPromptVersionDetail(
  familyId: string,
  versionId: string,
) {
  return useQuery({
    queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.versionDetail(familyId, versionId),
    queryFn: () => getAdminAiPromptVersionDetail(familyId, versionId),
  });
}

/**
 * 지정한 Agent에 속한 Prompt Family 선택 목록을 조회합니다.
 *
 * @param agentId Prompt Family가 속한 Agent ID
 * @returns Prompt Family 선택 목록 Query 결과
 */
export function useAdminAiPromptFamilyOptions(agentId: string) {
  return useQuery({
    enabled: agentId.length > 0,
    queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.familyOptions(agentId),
    queryFn: () => getAdminAiPromptFamilyOptions(agentId),
  });
}

/**
 * 지정한 Prompt Family에 속한 Published Version 선택 목록을 조회합니다.
 *
 * @param familyId Prompt Version이 속한 Family ID
 * @returns Published Prompt Version 선택 목록 Query 결과
 */
export function useAdminAiPromptVersionOptions(familyId: string) {
  return useQuery({
    enabled: familyId.length > 0,
    queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.versionOptions(familyId),
    queryFn: () => getAdminAiPromptVersionOptions(familyId),
  });
}
