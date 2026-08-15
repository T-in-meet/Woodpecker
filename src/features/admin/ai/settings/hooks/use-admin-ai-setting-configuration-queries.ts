"use client";

import { useQuery } from "@tanstack/react-query";

import { ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY } from "../constants/query-keys";
import { getAdminAiSettingConfigurations } from "../queries";

/**
 * 관리자 AI 설정의 Configuration 목록을 조회합니다.
 */
export function useAdminAiSettingConfigurations(settingId: string) {
  return useQuery({
    queryKey: ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY.bySetting(settingId),
    queryFn: () => getAdminAiSettingConfigurations(settingId),
    enabled: Boolean(settingId),
    retry: false,
  });
}
