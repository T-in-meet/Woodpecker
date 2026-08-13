"use client";

import { useQuery } from "@tanstack/react-query";

import { ADMIN_AI_SETTINGS_QUERY_KEY } from "../constants/query-keys";
import { getAdminAiSettingDetail, getAdminAiSettings } from "../queries";
import { AdminAiSettingListQuery } from "../types/ai-settings-list";

/**
 * 관리자 AI 설정 상세 조회 Query입니다.
 *
 * @param settingId 조회할 AI 설정 ID
 * @returns AI 설정 상세 Query 결과
 */
export function useAdminAiSettingDetail(settingId: string) {
  return useQuery({
    queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.detail(settingId),
    queryFn: () => getAdminAiSettingDetail(settingId),
    enabled: Boolean(settingId),
  });
}

/**
 * 관리자 AI 설정 목록을 조회합니다.
 *
 * @param query 검색, 필터, 정렬, 페이지네이션 조건
 * @returns AI 설정 목록 Query
 */
export function useAdminAiSettings(query: AdminAiSettingListQuery) {
  return useQuery({
    queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.list(query),
    queryFn: () => getAdminAiSettings(query),
    placeholderData: (previousData) => previousData,
  });
}
